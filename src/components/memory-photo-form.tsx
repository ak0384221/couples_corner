"use client";

import { useActionState } from "react";
import { uploadMemoryPhoto } from "@/app/actions";
import { initialActionState } from "@/lib/action-state";
import { PhotoInput } from "@/components/photo-upload";
import { ErrorMessage, Field, SubmitButton } from "@/components/ui";

export function MemoryPhotoForm({ albumId }: { albumId: string }) {
  const [state, formAction, pending] = useActionState(uploadMemoryPhoto, initialActionState);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="album_id" value={albumId} />
      <PhotoInput />
      <Field label="Caption (optional)" name="caption" placeholder="A little thing to remember" maxLength={200} />
      <ErrorMessage>{state.error}</ErrorMessage>
      <SubmitButton>{pending ? "Saving photo…" : "Add photo"}</SubmitButton>
    </form>
  );
}
