// Phone-width column (about 430 px), centered on larger screens.
export function AppShell({ children }: { children: React.ReactNode }) {
  return <div className="app-column overflow-hidden bg-page">{children}</div>;
}
