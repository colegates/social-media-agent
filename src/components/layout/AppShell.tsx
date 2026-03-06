import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { MobileHeader } from './MobileHeader';

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
}

export function AppShell({ children, title }: AppShellProps) {
  return (
    <div className="bg-background min-h-screen">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="md:pl-64">
        {/* Mobile header */}
        <MobileHeader title={title} />

        {/* Page content */}
        <main className="pb-20 md:pb-0">{children}</main>
      </div>

      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>
  );
}
