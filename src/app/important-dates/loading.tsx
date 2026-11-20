import { AppFrame } from "@/components/app-frame";

export default function ImportantDatesLoading() {
  return (
    <AppFrame title="Important dates" backHref="/">
      <main className="skeleton-fade space-y-5" aria-label="Loading important dates">
        <div className="ui-skeleton h-12 rounded-card" />
        <div className="space-y-4 rounded-card p-5">
          <div className="ui-skeleton h-12 rounded-field" />
          <div className="ui-skeleton h-12 rounded-field" />
          <div className="ui-skeleton h-12 rounded-full" />
        </div>
        <div className="ui-skeleton h-7 w-36 rounded-full" />
        <div className="ui-skeleton h-24 rounded-card" />
        <div className="ui-skeleton h-24 rounded-card" />
      </main>
    </AppFrame>
  );
}
