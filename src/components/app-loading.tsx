export function AppLoading() {
  return (
    <main className="app-loading skeleton-fade min-h-dvh px-5 pb-28 pt-7" aria-label="Loading Couply">
      <div className="love-header mb-6 flex items-start justify-between gap-3">
        <div className="ui-skeleton h-9 w-40 rounded-full" />
        <div className="ui-skeleton h-[42px] w-[42px] rounded-full" />
      </div>
      <div className="space-y-4" aria-hidden="true">
        <div className="ui-skeleton h-40 rounded-card" />
        <div className="ui-skeleton h-24 rounded-card" />
        <div className="grid grid-cols-2 gap-3">
          <div className="ui-skeleton h-24 rounded-card" />
          <div className="ui-skeleton h-24 rounded-card" />
        </div>
      </div>
    </main>
  );
}
