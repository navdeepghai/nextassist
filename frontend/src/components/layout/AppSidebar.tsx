import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useFrappeAuth } from "frappe-react-sdk";
import {
  MessageSquare,
  Bot,
  Settings,
  History,
  Timer,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ExternalLink,
  Sun,
  Moon,
  Monitor,
  X,
  Menu,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

const NAV_ITEMS = [
  { label: "Chat", icon: MessageSquare, path: "/chat" },
  { label: "Sessions", icon: History, path: "/sessions" },
  { label: "Schedulers", icon: Timer, path: "/schedulers" },
  { label: "Providers", icon: Bot, path: "/providers" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

const THEME_OPTIONS = [
  { value: "light" as const, icon: Sun, label: "Light" },
  { value: "dark" as const, icon: Moon, label: "Dark" },
  { value: "system" as const, icon: Monitor, label: "System" },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("nextassist_nav_collapsed") === "true";
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout } = useFrappeAuth();
  const { theme, setTheme } = useTheme();

  // Track desktop vs mobile for collapsed behavior
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => {
      setIsDesktop(e.matches);
      if (e.matches) setMobileOpen(false);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // On mobile overlay, always show expanded
  const showCollapsed = collapsed && isDesktop;

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("nextassist_nav_collapsed", String(next));
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const isActive = (path: string) => {
    if (path === "/chat") {
      return location.pathname === "/chat" || location.pathname.startsWith("/chat/");
    }
    return location.pathname.startsWith(path);
  };

  const userInitials = currentUser
    ? currentUser
        .split("@")[0]
        .split(".")
        .map((p: string) => p[0]?.toUpperCase())
        .join("")
        .slice(0, 2)
    : "U";

  return (
    <>
      {/* Mobile hamburger — visible when sidebar is closed */}
      <button
        onClick={() => setMobileOpen(true)}
        className={`fixed top-3 left-3 z-30 p-2.5 rounded-xl bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur-sm border border-black/5 dark:border-white/5 md:hidden transition-opacity duration-200 ease-out ${
          mobileOpen ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5 text-[#86868B]" strokeWidth={1.5} />
      </button>

      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden transition-opacity duration-200 ease-out ${
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={`flex flex-col h-screen bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl border-r border-black/5 dark:border-white/5 shrink-0 transition-all duration-200 ease-out fixed top-0 left-0 z-50 w-[260px] ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:relative md:z-auto md:translate-x-0 ${
          collapsed ? "md:w-[60px]" : "md:w-[220px]"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-black/5 dark:border-white/5 shrink-0">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#007AFF] to-[#0071E3] flex items-center justify-center shrink-0">
            <MessageSquare className="w-3.5 h-3.5 text-white" strokeWidth={1.5} />
          </div>
          {!showCollapsed && (
            <span className="font-semibold text-sm text-[var(--na-text)] truncate flex-1">
              NextAssist
            </span>
          )}
          {/* Mobile close button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1 rounded-lg text-[#86868B] hover:text-[var(--na-text)] md:hidden ml-auto"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => handleNavigate(item.path)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors duration-200 ease-out ${
                  active
                    ? "bg-[#007AFF]/10 dark:bg-[#0A84FF]/12 text-[#007AFF] dark:text-[#0A84FF]"
                    : "text-[#86868B] hover:text-[var(--na-text)] hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
                } ${showCollapsed ? "justify-center" : "justify-start"}`}
                title={showCollapsed ? item.label : undefined}
              >
                <item.icon
                  size={20}
                  strokeWidth={1.5}
                  className={`shrink-0 ${active ? "text-[#007AFF] dark:text-[#0A84FF]" : ""}`}
                />
                {!showCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Theme toggle */}
        <div className="px-2 py-1">
          {showCollapsed ? (
            <button
              onClick={() => {
                const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
                setTheme(next);
              }}
              className="w-full flex items-center justify-center py-1.5 rounded-lg text-[#86868B] hover:text-[var(--na-text)] hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors duration-200 ease-out"
              title={`Theme: ${theme}`}
            >
              {theme === "dark" ? (
                <Moon size={18} strokeWidth={1.5} />
              ) : theme === "system" ? (
                <Monitor size={18} strokeWidth={1.5} />
              ) : (
                <Sun size={18} strokeWidth={1.5} />
              )}
            </button>
          ) : (
            <div className="flex items-center rounded-xl bg-[#F5F5F7] dark:bg-[#2C2C2E] p-1">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs transition-all duration-200 ease-out ${
                    theme === opt.value
                      ? "bg-white dark:bg-[#3A3A3C] text-[var(--na-text)] shadow-sm"
                      : "text-[#86868B] hover:text-[var(--na-text)]"
                  }`}
                  title={opt.label}
                >
                  <opt.icon size={14} strokeWidth={1.5} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Collapse toggle — desktop only */}
        <div className="px-2 py-1 hidden md:block">
          <button
            onClick={toggleCollapsed}
            className="w-full flex items-center justify-center py-1.5 rounded-lg text-[#86868B] hover:text-[var(--na-text)] hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors duration-200 ease-out"
          >
            {collapsed ? <ChevronRight size={18} strokeWidth={1.5} /> : <ChevronLeft size={18} strokeWidth={1.5} />}
          </button>
        </div>

        {/* User section */}
        <div className="relative border-t border-black/5 dark:border-white/5 px-2 py-2">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors duration-200 ease-out ${
              showCollapsed ? "justify-center" : "justify-start"
            }`}
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#007AFF] to-[#0071E3] flex items-center justify-center text-[10px] font-semibold text-white shrink-0">
              {userInitials}
            </div>
            {!showCollapsed && (
              <span className="text-xs text-[#86868B] truncate flex-1 text-left">
                {currentUser?.split("@")[0]}
              </span>
            )}
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div
                className={`absolute bg-white dark:bg-[#2C2C2E] rounded-2xl shadow-2xl py-1.5 z-50 min-w-[160px] border border-black/[0.04] dark:border-white/[0.06] ${
                  showCollapsed
                    ? "left-full bottom-0 ml-2"
                    : "bottom-full left-2 right-2 mb-1"
                }`}
              >
                <button
                  onClick={() => {
                    window.location.href = "/app";
                    setShowUserMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-[15px] text-[var(--na-text)] hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors duration-200 ease-out"
                >
                  <ExternalLink size={16} strokeWidth={1.5} />
                  Go to Desk
                </button>
                <button
                  onClick={() => {
                    logout();
                    setShowUserMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-[15px] text-[#FF3B30] dark:text-[#FF453A] hover:bg-[#FF3B30]/10 dark:hover:bg-[#FF453A]/10 transition-colors duration-200 ease-out"
                >
                  <LogOut size={16} strokeWidth={1.5} />
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
