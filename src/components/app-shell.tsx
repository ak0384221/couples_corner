import { Suspense } from "react";
import { AppLoading } from "@/components/app-loading";
import { BottomNavigation, BottomNavigationFallback } from "@/components/bottom-navigation";
import { NavigationHistoryProvider } from "@/components/navigation-history";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-column overflow-hidden bg-page">
      <Suspense fallback={<BottomNavigationFallback />}>
        <BottomNavigation />
      </Suspense>
      <Suspense fallback={<AppLoading />}>
        <NavigationHistoryProvider>{children}</NavigationHistoryProvider>
      </Suspense>
    </div>
  );
}
