"use client";

import { useActionState, useCallback, useState } from "react";
import { uploadMemoryPhoto } from "@/app/actions";
import { PhotoInput } from "@/components/photo-upload";
import { initialActionState } from "@/lib/action-state";
import { MAX_MEMORY_PHOTOS } from "@/lib/photo-limits";
import { Field } from "@/components/ui";

export function MemoryPhotoForm({ albumId }: { albumId: string }) {
  const [state, formAction, pending] = useActionState(uploadMemoryPhoto, initialActionState);
  const [selectedCount, setSelectedCount] = useState(0);
  const [showCaption, setShowCaption] = useState(false);
  const selectionChanged = useCallback((count: number) => setSelectedCount(count), []);

  return (
    <form action={formAction} className="min-w-0 flex-1 space-y-2">
      <input type="hidden" name="album_id" value={albumId} />
      <div className="flex items-center justify-end gap-2">
        <PhotoInput
          multiple
          maxFiles={MAX_MEMORY_PHOTOS}
          uploadPending={pending}
          onSelectionCountChange={selectionChanged}
        />
        {selectedCount ? (
          <button type="submit" className="primary-button shrink-0 px-3 py-2 text-sm" disabled={pending}>
            {pending ? "Uploading…" : `Upload ${selectedCount} ${selectedCount === 1 ? "photo" : "photos"}`}
          </button>
        ) : null}
      </div>
      {selectedCount ? (
        <button
          type="button"
          className="text-xs font-bold text-primary underline"
          onClick={() => setShowCaption((visible) => !visible)}
          aria-expanded={showCaption}
        >
          {showCaption ? "Hide caption" : "Add caption"}
        </button>
      ) : null}
      {showCaption && selectedCount ? (
        <Field label="Caption for all photos (optional)" name="caption" placeholder="A little thing to remember" maxLength={200} />
      ) : null}
      <p role="status" aria-live="polite" className="text-xs text-danger">{state.error}</p>
    </form>
  );
}
