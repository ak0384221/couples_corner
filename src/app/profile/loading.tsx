import { AppFrame } from "@/components/app-frame";

export default function ProfileLoading() {
  return (
    <AppFrame title="Profile" className="profile-page-frame">
      <div className="skeleton-fade space-y-4" aria-label="Loading profile">
        <div className="rounded-card p-6 text-center">
          <div className="profile-skeleton-rings">
            <div className="ui-skeleton h-20 w-20 rounded-full" />
          </div>
          <div className="ui-skeleton mx-auto mt-4 h-6 w-40 rounded-full" />
          <div className="ui-skeleton mx-auto mt-2 h-4 w-56 max-w-full rounded-full" />
        </div>
        <div className="profile-stats grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="ui-skeleton h-28 rounded-card" key={index} />
          ))}
        </div>
        <div className="ui-skeleton h-12 rounded-full" />
      </div>
    </AppFrame>
  );
}
