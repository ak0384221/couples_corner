"use client";

import { useActionState } from "react";
import { createAlbum } from "@/app/actions";
import { initialActionState } from "@/lib/action-state";
import { ErrorMessage, Field, SubmitButton } from "@/components/ui";

export function AlbumCreateForm() {
  const [state, formAction, pending] = useActionState(createAlbum, initialActionState);
  return (
    <form action={formAction} className="space-y-3">
      <Field label="Album title" name="title" placeholder="Our little adventures" required maxLength={80} />
      <Field label="Date" name="album_date" type="date" required />
      <ErrorMessage>{state.error}</ErrorMessage>
      <SubmitButton>{pending ? "Creating…" : "Create album"}</SubmitButton>
    </form>
  );
}
