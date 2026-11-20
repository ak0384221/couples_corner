import { AppFrame } from "@/components/app-frame";

export default function AlbumLoading() {
  return (
    <AppFrame title="Memory album" backHref="/memories">
      <main className="skeleton-fade">
        <div className="ui-skeleton mb-4 h-20 rounded-card" />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 8 }, (_, index) => (
            <div className="ui-skeleton aspect-square rounded-card" key={index} />
          ))}
        </div>
      </main>
    </AppFrame>
  );
}
