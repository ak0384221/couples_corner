"use client";

import { useActionState, useState } from "react";
import { deleteAlbum, updateAlbum } from "@/app/actions";
import { initialActionState } from "@/lib/action-state";
import { ErrorMessage, Field } from "@/components/ui";

export function AlbumManagement({
  albumId,
  title,
  albumDate,
}: {
  albumId: string;
  title: string;
  albumDate: string;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateAlbum.bind(null, albumId),
    initialActionState,
  );
  const deleteAction = deleteAlbum.bind(null, albumId);

  return (
    <>
      <details className="action-menu">
        <summary className="icon-button action-menu-trigger" aria-label="Album options" title="Album options">
          <span aria-hidden="true">•••</span>
        </summary>
        <div className="action-menu-popover">
          <button type="button" className="action-menu-item" onClick={() => setEditing(true)}>
            Edit album
          </button>
          <form
            action={deleteAction}
            onSubmit={(event) => {
              if (!window.confirm(`Delete album "${title}" and all its photos? This cannot be undone.`)) {
                event.preventDefault();
              }
            }}
          >
            <button type="submit" className="action-menu-item text-danger">
              Delete album
            </button>
          </form>
        </div>
      </details>
      {editing ? (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditing(false);
          }}
        >
          <section
            className="w-full max-w-sm rounded-card border border-line bg-card p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-album-title"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="edit-album-title" className="text-lg font-bold">Edit album</h2>
              <button
                type="button"
                className="icon-button"
                onClick={() => setEditing(false)}
                aria-label="Close edit album"
              >
                ×
              </button>
            </div>
            <form action={formAction} className="space-y-3">
              <Field label="Album name" name="title" defaultValue={title} required maxLength={80} />
              <Field label="Date" name="album_date" type="date" defaultValue={albumDate} required />
              <ErrorMessage>{state.error}</ErrorMessage>
              {state.success ? <p role="status" className="text-sm font-bold text-primary">{state.success}</p> : null}
              <button type="submit" className="primary-button w-full" disabled={pending}>
                {pending ? "Saving…" : "Save changes"}
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
