"use client";

import { useRef, useState } from "react";

async function shrinkToJpeg(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not prepare the photo.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  for (let quality = 0.88; quality >= 0.35; quality -= 0.08) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= 1_048_576) {
      return new File([blob], `${crypto.randomUUID()}.jpg`, { type: "image/jpeg" });
    }
  }
  throw new Error("This photo is still larger than 1 MB after compression. Try a smaller image.");
}

export function PhotoInput({ required = true }: { required?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("Photos are resized to 2,000 px and under 1 MB. Original stays on your phone.");
  const [busy, setBusy] = useState(false);

  async function compress(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const original = input.files?.[0];
    if (!original) return;
    setBusy(true);
    setStatus("Shrinking your photo…");
    try {
      const smaller = await shrinkToJpeg(original);
      const transfer = new DataTransfer();
      transfer.items.add(smaller);
      input.files = transfer.files;
      setStatus(`Ready · ${(smaller.size / 1024).toFixed(0)} KB JPEG`);
    } catch (error) {
      input.value = "";
      setStatus(error instanceof Error ? error.message : "Could not prepare this photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="field-label">
      <span>Choose a photo</span>
      <input ref={inputRef} className="field-input" type="file" name="photo" accept="image/*" required={required} onChange={compress} />
      <span aria-live="polite" className="text-xs text-ink-soft">{busy ? "Please wait…" : status}</span>
    </label>
  );
}
