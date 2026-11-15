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
    const originals = selected.slice(0, multiple ? maxFiles : 1);
    if (selected.length > originals.length) {
      setStatus(`Choose up to ${maxFiles} photos. The first ${maxFiles} will be prepared.`);
    } else {
      setStatus("");
    }
    for (const url of previewUrls.current) URL.revokeObjectURL(url);
    previewUrls.current.clear();
    syncInputs([]);
    input.value = "";
    const prepared: ProcessedPhoto[] = originals.map((file) => ({
      file,
      thumbnail: file,
      previewUrl: "",
      progress: 0,
    }));
    const results = [...prepared];
    setPhotos(prepared);
    setBusy(true);
    let nextIndex = 0;
    const updateProgress = (index: number, progress: number) => {
      setPhotos((current) => current.map((photo, photoIndex) => photoIndex === index ? { ...photo, progress } : photo));
    };
    const worker = async () => {
      while (nextIndex < originals.length) {
        const index = nextIndex++;
        const original = originals[index];
        const initialResult = results[index];
        if (!original || !initialResult) continue;
        try {
          const file = await shrinkToJpeg(original, (progress) => updateProgress(index, progress));
          updateProgress(index, 96);
          const thumbnail = multiple ? await makeThumbnail(file) : file;
          const previewUrl = URL.createObjectURL(file);
          previewUrls.current.add(previewUrl);
          results[index] = { ...initialResult, file, thumbnail, previewUrl, progress: 100 };
          setPhotos((current) => current.map((photo, photoIndex) => photoIndex === index
            ? results[index] ?? photo
            : photo));
        } catch (error) {
          results[index] = {
            ...initialResult,
            error: error instanceof Error ? error.message : "Could not prepare this photo.",
          };
          setPhotos((current) => current.map((photo, photoIndex) => photoIndex === index
            ? results[index] ?? photo
            : photo));
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(2, originals.length) }, worker));
    syncInputs(results);
    setBusy(false);
    if (results.some((photo) => photo.error)) {
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
    <div className={multiple ? "space-y-2" : ""}>
      <label className={multiple
        ? `secondary-button relative inline-flex cursor-pointer items-center justify-center px-3 py-2 text-sm ${busy || uploadPending ? "pointer-events-none opacity-60" : ""}`
        : "field-label"}
      >
        {multiple ? "+ Add photos" : <span>Choose a photo</span>}
        <input
          ref={inputRef}
          className={multiple ? "absolute inset-0 h-full w-full cursor-pointer opacity-0" : "field-input"}
          type="file"
          name="photo"
          accept="image/*"
          required={!multiple && required}
          multiple={multiple}
          disabled={busy || uploadPending}
          onChange={compress}
        />
      </label>
      {multiple ? <input ref={thumbnailInputRef} className="hidden" type="file" name="thumbnail" multiple aria-hidden="true" tabIndex={-1} /> : null}
      {!multiple ? (
        <span aria-live="polite" className="block text-xs text-ink-soft">
          {busy ? "Please wait…" : status || "Photos are resized to 1,600 px and 400 KB or less. Original stays on your phone."}
        </span>
      ) : null}
      {photos.length ? (
        <ul className="flex flex-wrap gap-2" aria-label="Selected photos">
          {photos.map((photo, index) => (
            <li className="relative h-12 w-12 overflow-hidden rounded-field bg-blush" key={`${photo.file.name}-${index}`}>
              {photo.previewUrl ? <Image src={photo.previewUrl} alt={photo.file.name} fill unoptimized className="object-cover" /> : null}
              {photo.progress < 100 && !photo.error ? <progress className="absolute inset-x-1 bottom-1 h-1 w-10" value={photo.progress} max={100} aria-label={`Preparing ${photo.file.name}`} /> : null}
              {photo.error ? <span className="absolute inset-0 grid place-items-center bg-card/90 text-[10px] text-danger" aria-label={`${photo.file.name} could not be prepared`}>Error</span> : null}
              {multiple ? (
                <button type="button" className="absolute -right-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full bg-ink text-xs text-white" aria-label={`Remove ${photo.file.name}`} onClick={() => removePhoto(index)} disabled={busy || uploadPending}>×</button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {multiple && status ? <p role="status" className="text-xs text-danger">{status}</p> : null}
      {multiple && busy ? <p aria-live="polite" className="text-xs text-ink-soft">Preparing photos…</p> : null}
    </div>
  );
}
