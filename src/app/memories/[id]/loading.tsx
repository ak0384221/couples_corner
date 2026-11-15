export default function AlbumLoading() {
  return (
    <main className="min-h-dvh px-5 pb-28 pt-7">
      <div className="mb-6 h-10 w-2/3 animate-pulse rounded-field bg-line" />
      <div className="mb-4 h-20 animate-pulse rounded-card bg-line" />
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 8 }, (_, index) => (
          <div className="aspect-square animate-pulse rounded-field bg-line" key={index} />
        ))}
      </div>
    </main>
  );
}
