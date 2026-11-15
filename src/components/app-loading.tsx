export function AppLoading() {
  return (
    <main className="app-loading min-h-dvh px-5 pb-28 pt-7" aria-label="Loading your little corner">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Our little corner</p>
        <div className="mt-3 h-8 w-40 animate-pulse rounded-full bg-blush" />
      </div>
      <div className="space-y-4" aria-hidden="true">
        <div className="h-40 animate-pulse rounded-card border border-line bg-card" />
        <div className="h-24 animate-pulse rounded-card border border-line bg-card" />
      </div>
    </main>
  );
}
