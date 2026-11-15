"use client";

import { useActionState, useCallback, useState } from "react";
import { uploadMemoryPhoto } from "@/app/actions";
import { PhotoInput } from "@/components/photo-upload";
import { initialActionState } from "@/lib/action-state";
import { MAX_MEMORY_PHOTOS } from "@/lib/photo-limits";

export function MemoryPhotoForm({ albumId }: { albumId: string }) {
  const [state, formAction, pending] = useActionState(uploadMemoryPhoto, initialActionState);
  const [selectedCount, setSelectedCount] = useState(0);
  const selectionChanged = useCallback((count: number) => setSelectedCount(count), []);

  return (
    <form action={formAction} className="min-w-0 space-y-3">
      <input type="hidden" name="album_id" value={albumId} />
      <PhotoInput
        multiple
        maxFiles={MAX_MEMORY_PHOTOS}
        uploadPending={pending}
        onSelectionCountChange={selectionChanged}
      />
      {selectedCount ? (
        <div className="flex justify-end">
          <button type="submit" className="primary-button shrink-0 px-4 py-2 text-sm shadow-sm" disabled={pending}>
            {pending ? "Uploading…" : `Upload ${selectedCount} ${selectedCount === 1 ? "photo" : "photos"} ↑`}
          </button>
        </div>
      ) : null}
      {selectedCount ? <p className="text-xs text-ink-soft">You can remove any photo before uploading.</p> : null}
      {state.error ? <p role="alert" className="text-sm font-semibold text-danger">{state.error}</p> : null}
    </form>
  );
}
