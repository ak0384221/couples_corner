"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { MAX_MEMORY_PHOTOS, MAX_PHOTO_BYTES, MAX_THUMBNAIL_BYTES } from "@/lib/photo-limits";

type ProcessedPhoto = {
  file: File;
  thumbnail: File;
  previewUrl: string;
  progress: number;
  error?: string;
};

async function canvasJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("This browser could not prepare the photo.");
  return blob;
}

async function shrinkToJpeg(file: File, onProgress: (progress: number) => void): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    let scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not prepare the photo.");
    let attempt = 0;

    while (true) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (let quality = 0.84; quality >= 0.36; quality -= 0.08) {
        const blob = await canvasJpeg(canvas, quality);
        onProgress(Math.min(94, 20 + attempt * 5));
        attempt += 1;
        if (blob.size <= MAX_PHOTO_BYTES) {
          return new File([blob], `${crypto.randomUUID()}.jpg`, { type: "image/jpeg" });
        }
      }

      const currentSide = Math.max(canvas.width, canvas.height);
      if (currentSide <= 1000) break;
      scale *= Math.max(0.85, 1000 / currentSide);
    }
  } finally {
    bitmap.close();
  }
  throw new Error("This photo is still larger than 400 KB at 1,000 px. Try a smaller image.");
}

async function makeThumbnail(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    let scale = Math.min(1, 400 / Math.max(bitmap.width, bitmap.height));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not prepare the thumbnail.");

    while (true) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (let quality = 0.82; quality >= 0.3; quality -= 0.1) {
        const blob = await canvasJpeg(canvas, quality);
        if (blob.size <= MAX_THUMBNAIL_BYTES) {
          return new File([blob], `${crypto.randomUUID()}.jpg`, { type: "image/jpeg" });
        }
      }
      if (Math.max(canvas.width, canvas.height) <= 250) {
        const blob = await canvasJpeg(canvas, 0.2);
        if (blob.size <= MAX_PHOTO_BYTES) {
          return new File([blob], `${crypto.randomUUID()}.jpg`, { type: "image/jpeg" });
        }
        break;
      }
      scale *= 0.8;
    }
  } finally {
    bitmap.close();
  }
  throw new Error("Could not make a small thumbnail for this photo.");
}

export function PhotoInput({
  required = true,
  multiple = false,
  maxFiles = MAX_MEMORY_PHOTOS,
  uploadPending = false,
  onSelectionCountChange,
}: {
  required?: boolean;
  multiple?: boolean;
  maxFiles?: number;
  uploadPending?: boolean;
  onSelectionCountChange?: (count: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const previewUrls = useRef(new Set<string>());
  const [photos, setPhotos] = useState<ProcessedPhoto[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    onSelectionCountChange?.(busy ? 0 : photos.filter((photo) => photo.progress === 100 && !photo.error).length);
  }, [busy, onSelectionCountChange, photos]);

  useEffect(() => () => {
    for (const url of previewUrls.current) URL.revokeObjectURL(url);
  }, []);

  function syncInputs(items: ProcessedPhoto[]) {
    const photoTransfer = new DataTransfer();
    const thumbnailTransfer = new DataTransfer();
    for (const photo of items) {
      if (photo.error) continue;
      photoTransfer.items.add(photo.file);
      thumbnailTransfer.items.add(photo.thumbnail);
    }
    if (inputRef.current) inputRef.current.files = photoTransfer.files;
    if (thumbnailInputRef.current) thumbnailInputRef.current.files = thumbnailTransfer.files;
  }

  async function compress(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const selected = Array.from(input.files ?? []);
    if (!selected.length) return;
    const remaining = multiple ? Math.max(0, maxFiles - photos.length) : 1;
    if (remaining === 0) {
      setStatus(`You can add up to ${maxFiles} photos to this batch.`);
      input.value = "";
      return;
    }
    const originals = selected.slice(0, remaining);
    if (selected.length > originals.length) {
      setStatus(`Only ${remaining} more ${remaining === 1 ? "photo can" : "photos can"} be added. The first ${remaining} will be prepared.`);
    } else {
      setStatus("");
    }
    if (!multiple) {
      for (const url of previewUrls.current) URL.revokeObjectURL(url);
      previewUrls.current.clear();
      syncInputs([]);
    }
    input.value = "";
    const prepared: ProcessedPhoto[] = originals.map((file) => ({
      file,
      thumbnail: file,
      previewUrl: "",
      progress: 0,
    }));
    const offset = multiple ? photos.length : 0;
    const finalPhotos = multiple ? [...photos, ...prepared] : [...prepared];
    setPhotos([...finalPhotos]);
    setBusy(true);
    let nextIndex = 0;
    const updateProgress = (index: number, progress: number) => {
      const photoIndex = index + offset;
      setPhotos((current) => current.map((photo, currentIndex) => currentIndex === photoIndex ? { ...photo, progress } : photo));
    };
    const worker = async () => {
      while (nextIndex < originals.length) {
        const index = nextIndex++;
        const original = originals[index];
        const photoIndex = index + offset;
        const initialResult = prepared[index];
        if (!original || !initialResult) continue;
        try {
          const file = await shrinkToJpeg(original, (progress) => updateProgress(index, progress));
          updateProgress(index, 96);
          const thumbnail = multiple ? await makeThumbnail(file) : file;
          const previewUrl = URL.createObjectURL(file);
          previewUrls.current.add(previewUrl);
          finalPhotos[photoIndex] = { ...initialResult, file, thumbnail, previewUrl, progress: 100 };
          setPhotos((current) => current.map((photo, currentIndex) => currentIndex === photoIndex
            ? finalPhotos[photoIndex] ?? photo
            : photo));
        } catch (error) {
          finalPhotos[photoIndex] = {
            ...initialResult,
            error: error instanceof Error ? error.message : "Could not prepare this photo.",
          };
          setPhotos((current) => current.map((photo, currentIndex) => currentIndex === photoIndex
            ? finalPhotos[photoIndex] ?? photo
            : photo));
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(2, originals.length) }, worker));
    syncInputs(finalPhotos);
    setBusy(false);
    if (finalPhotos.some((photo) => photo.error)) {
      setStatus("Some photos could not be prepared. Remove them or choose smaller images.");
    }
  }

  function removePhoto(index: number) {
    const removed = photos[index];
    if (removed?.previewUrl) {
      URL.revokeObjectURL(removed.previewUrl);
      previewUrls.current.delete(removed.previewUrl);
    }
    const next = photos.filter((_, photoIndex) => photoIndex !== index);
    setPhotos(next);
    syncInputs(next);
    setStatus("");
  }

  return (
    <div className={multiple ? "w-full space-y-3" : ""}>
      {multiple ? (
        photos.length ? (
          <section className="space-y-3 rounded-card border border-line bg-card p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold">{photos.length} of {maxFiles} selected</p>
                <p className="text-xs text-ink-soft">Photos are private and compressed before upload.</p>
              </div>
              <label className={`secondary-button relative ml-auto inline-flex min-h-10 shrink-0 cursor-pointer px-3 py-2 text-xs ${busy || uploadPending ? "pointer-events-none opacity-60" : ""}`}>
                Add more
                <input
                  ref={inputRef}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  type="file"
                  name="photo"
                  accept="image/*"
                  multiple
                  disabled={busy || uploadPending || photos.length >= maxFiles}
                  onChange={compress}
                />
              </label>
            </div>
            <ul className="grid grid-cols-3 gap-2" aria-label="Selected photos">
              {photos.map((photo, index) => (
                <li className="overflow-hidden rounded-field border border-line bg-page" key={`${photo.file.name}-${index}`}>
                  <div className="relative aspect-square bg-blush">
                    {photo.previewUrl ? <Image src={photo.previewUrl} alt={photo.file.name} fill unoptimized className="object-cover" /> : <div className="grid h-full place-items-center text-2xl text-primary">♡</div>}
                    <button
                      type="button"
                      className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/70 text-lg leading-none text-white shadow"
                      aria-label={`Remove ${photo.file.name}`}
                      onClick={() => removePhoto(index)}
                      disabled={busy || uploadPending}
                    >
                      ×
                    </button>
                    {photo.progress < 100 && !photo.error ? (
                      <div className="absolute inset-x-2 bottom-2 h-1.5 overflow-hidden rounded-full bg-white/70" role="progressbar" aria-label={`Preparing ${photo.file.name}`} aria-valuenow={photo.progress} aria-valuemin={0} aria-valuemax={100}>
                        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${photo.progress}%` }} />
                      </div>
                    ) : null}
                    {photo.error ? <span className="absolute inset-0 grid place-items-center bg-black/65 p-2 text-center text-xs font-bold text-white">Could not prepare</span> : null}
                  </div>
                  <div className="p-2">
                    <p className="truncate text-[11px] font-bold">{photo.file.name}</p>
                    <p className={`mt-0.5 text-[10px] ${photo.error ? "text-danger" : "text-ink-soft"}`}>
                      {photo.error ? "Remove and try again" : photo.progress === 100 ? `${Math.max(1, Math.round(photo.file.size / 1024))} KB · Ready` : `Preparing · ${photo.progress}%`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            {status ? <p role="status" className="text-xs text-danger">{status}</p> : null}
          </section>
        ) : (
          <label className={`secondary-button relative ml-auto inline-flex cursor-pointer items-center justify-center px-3 py-2 text-sm ${busy || uploadPending ? "pointer-events-none opacity-60" : ""}`}>
            + Add photos
            <input
              ref={inputRef}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              type="file"
              name="photo"
              accept="image/*"
              multiple
              disabled={busy || uploadPending}
              onChange={compress}
            />
          </label>
        )
      ) : (
        <label className="field-label">
          <span>Choose a photo</span>
          <input ref={inputRef} className="field-input" type="file" name="photo" accept="image/*" required={required} disabled={busy || uploadPending} onChange={compress} />
        </label>
      )}
      {multiple ? <input ref={thumbnailInputRef} className="hidden" type="file" name="thumbnail" multiple aria-hidden="true" tabIndex={-1} /> : null}
      {!multiple ? (
        <span aria-live="polite" className="block text-xs text-ink-soft">
          {busy ? "Please wait…" : status || "Photos are resized to 1,600 px and 400 KB or less. Original stays on your phone."}
        </span>
      ) : null}
      {multiple && busy ? <p aria-live="polite" className="text-xs font-semibold text-primary">Preparing your photos. You can keep editing the album while this finishes.</p> : null}
    </div>
  );
}
