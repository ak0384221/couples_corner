"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type GalleryPhoto = {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  caption: string | null;
};

export function PhotoGallery({ photos, albumTitle }: { photos: GalleryPhoto[]; albumTitle: string }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (activeIndex === null) {
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setActiveIndex(null);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setActiveIndex((index) => index === null ? null : Math.max(0, index - 1));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setActiveIndex((index) => index === null ? null : Math.min(photos.length - 1, index + 1));
      } else if (event.key === "Tab") {
        const focusable = document.querySelectorAll<HTMLButtonElement>("[data-photo-viewer] button:not(:disabled)");
        if (!focusable.length) return;
        const first = focusable.item(0);
        const last = focusable.item(focusable.length - 1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [activeIndex, photos.length]);

  useEffect(() => {
    if (activeIndex === null || photos.length < 2) return;
    for (const index of [activeIndex - 1, activeIndex + 1]) {
      if (index >= 0 && index < photos.length) {
        const photo = photos[index];
        if (!photo) continue;
        const preload = new window.Image();
        preload.src = photo.url;
      }
    }
  }, [activeIndex, photos]);

  function openViewer(index: number, event: React.MouseEvent<HTMLButtonElement>) {
    returnFocusRef.current = event.currentTarget;
    setActiveIndex(index);
  }

  const activePhoto = activeIndex === null ? null : photos[activeIndex];

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {photos.map((photo, index) => (
          <button
            type="button"
            className="relative block aspect-square overflow-hidden rounded-field bg-card"
            key={photo.id}
            onClick={(event) => openViewer(index, event)}
            aria-label={`Open photo ${index + 1} of ${photos.length}${photo.caption ? `: ${photo.caption}` : ""}`}
          >
            <Image
              src={photo.thumbnailUrl ?? photo.url}
              alt={photo.caption || `Photo ${index + 1} from ${albumTitle}`}
              fill
              sizes="(max-width: 640px) 50vw, 320px"
              unoptimized
              priority={index < 2}
              loading={index < 2 ? undefined : "lazy"}
              decoding="async"
              className="object-cover"
            />
          </button>
        ))}
      </div>
      {activePhoto && activeIndex !== null ? (
        <div
          data-photo-viewer
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 p-4 text-white"
          role="dialog"
          aria-modal="true"
          aria-label={`${albumTitle} photo viewer`}
          onClick={(event) => {
            if (event.target === event.currentTarget) setActiveIndex(null);
          }}
          onTouchStart={(event) => { touchStartX.current = event.changedTouches[0]?.clientX ?? null; }}
          onTouchEnd={(event) => {
            const start = touchStartX.current;
            const end = event.changedTouches[0]?.clientX;
            touchStartX.current = null;
            if (start === null || end === undefined || Math.abs(end - start) < 50) return;
            setActiveIndex((index) => index === null ? null : Math.max(0, Math.min(photos.length - 1, index + (end < start ? 1 : -1))));
          }}
        >
          <button
            ref={closeButtonRef}
            type="button"
            className="absolute right-4 top-4 z-10 rounded-full bg-white/15 px-4 py-2 text-2xl"
            onClick={() => setActiveIndex(null)}
            aria-label="Close photo viewer"
          >
            ×
          </button>
          <button
            type="button"
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 px-3 py-3 text-2xl disabled:opacity-30 sm:left-6"
            onClick={() => setActiveIndex((index) => index === null ? null : Math.max(0, index - 1))}
            disabled={activeIndex === 0}
            aria-label="Previous photo"
          >
            ‹
          </button>
          <div className="relative h-[75dvh] w-full max-w-5xl">
            <Image
              src={activePhoto.url}
              alt={activePhoto.caption || `Photo ${activeIndex + 1} from ${albumTitle}`}
              fill
              sizes="100vw"
              unoptimized
              priority
              decoding="async"
              className="object-contain"
            />
          </div>
          <button
            type="button"
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 px-3 py-3 text-2xl disabled:opacity-30 sm:right-6"
            onClick={() => setActiveIndex((index) => index === null ? null : Math.min(photos.length - 1, index + 1))}
            disabled={activeIndex === photos.length - 1}
            aria-label="Next photo"
          >
            ›
          </button>
          <div className="mt-3 max-w-3xl text-center">
            <p className="text-sm font-bold">{activeIndex + 1} / {photos.length}</p>
            {activePhoto.caption ? <p className="mt-1 text-sm text-white/80">{activePhoto.caption}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
