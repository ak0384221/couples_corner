import { Suspense } from "react";
import { AppLoading } from "@/components/app-loading";
import { NavigationHistoryProvider } from "@/components/navigation-history";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-column overflow-hidden bg-page">
      <NavigationHistoryProvider>
        <Suspense fallback={<AppLoading />}>{children}</Suspense>
      </NavigationHistoryProvider>
    </div>
  );
}
