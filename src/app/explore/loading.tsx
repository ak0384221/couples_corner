import { AppFrame } from "@/components/app-frame";

export default function ExploreLoading() {
  return (
    <AppFrame title="Explore">
      <main className="explore-page skeleton-fade" aria-label="Loading Explore">
        <div className="ui-skeleton mb-5 h-12 rounded-card" />
        <div className="ui-skeleton mb-5 h-16 rounded-card" />
        <div className="space-y-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="ui-skeleton h-40 rounded-card" key={index} />
          ))}
        </div>
      </main>
    </AppFrame>
  );
}
