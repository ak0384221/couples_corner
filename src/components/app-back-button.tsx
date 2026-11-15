"use client";

import { useAppBack } from "@/components/navigation-history";

export function AppBackButton({ fallback }: { fallback: string }) {
  const goBack = useAppBack(fallback);

  return (
    <button className="icon-button" type="button" onClick={goBack} aria-label="Go back">
      ←
    </button>
  );
}
