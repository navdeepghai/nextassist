import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";

interface AppLayoutProps {
  children: ReactNode;
  fullWidth?: boolean;
}

export function AppLayout({ children, fullWidth }: AppLayoutProps) {
  return (
    <div className="flex h-screen bg-[var(--na-bg)]">
      <AppSidebar />
      <div className={`flex-1 min-w-0 ${fullWidth ? "" : "overflow-y-auto"}`}>
        {children}
      </div>
    </div>
  );
}
