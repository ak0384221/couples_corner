import { AppFrame } from "@/components/app-frame";

export default function ProfileLoading() {
  return (
    <AppFrame title="Profile">
      <div className="space-y-4" aria-label="Loading profile">
        <div className="rounded-card border border-line bg-card p-6 text-center">
          <div className="mx-auto h-20 w-20 animate-pulse rounded-full bg-blush" />
          <div className="mx-auto mt-4 h-6 w-40 animate-pulse rounded-full bg-blush" />
          <div className="mx-auto mt-2 h-4 w-56 max-w-full animate-pulse rounded-full bg-blush" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="h-20 animate-pulse rounded-card border border-line bg-card" key={index} />
          ))}
        </div>
      </div>
    </AppFrame>
  );
}
