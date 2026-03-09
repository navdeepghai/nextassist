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
  { label: "Chat", icon: MessageSquare, path: "/chat", color: "text-blue-600" },
  { label: "Sessions", icon: History, path: "/sessions", color: "text-violet-600" },
  { label: "Schedulers", icon: Timer, path: "/schedulers", color: "text-orange-600" },
  { label: "Providers", icon: Bot, path: "/providers", color: "text-emerald-600" },
  { label: "Settings", icon: Settings, path: "/settings", color: "text-gray-600 dark:text-gray-400" },
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
        className={`fixed top-3 left-3 z-30 p-2 rounded-lg bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border border-gray-200 dark:border-gray-700 shadow-sm md:hidden transition-opacity duration-200 ${
          mobileOpen ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
      </button>

      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-200 ${
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={`flex flex-col h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 shrink-0 transition-all duration-200 fixed top-0 left-0 z-50 w-[260px] ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:relative md:z-auto md:translate-x-0 ${
          collapsed ? "md:w-[60px]" : "md:w-[220px]"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0">
            <MessageSquare className="w-3.5 h-3.5 text-white" />
          </div>
          {!showCollapsed && (
            <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate flex-1">
              NextAssist
            </span>
          )}
          {/* Mobile close button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 md:hidden ml-auto"
          >
            <X className="w-5 h-5" />
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
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200"
                } ${showCollapsed ? "justify-center" : "justify-start"}`}
                title={showCollapsed ? item.label : undefined}
              >
                <item.icon
                  className={`w-[18px] h-[18px] shrink-0 ${active ? item.color : ""}`}
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
              className="w-full flex items-center justify-center py-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              title={`Theme: ${theme}`}
            >
              {theme === "dark" ? (
                <Moon className="w-4 h-4" />
              ) : theme === "system" ? (
                <Monitor className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4" />
              )}
            </button>
          ) : (
            <div className="flex items-center rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-md text-xs transition-colors ${
                    theme === opt.value
                      ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                  title={opt.label}
                >
                  <opt.icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Collapse toggle — desktop only */}
        <div className="px-2 py-1 hidden md:block">
          <button
            onClick={toggleCollapsed}
            className="w-full flex items-center justify-center py-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* User section */}
        <div className="relative border-t border-gray-100 dark:border-gray-800 px-2 py-2">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
              showCollapsed ? "justify-center" : "justify-start"
            }`}
          >
            <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-300 shrink-0">
              {userInitials}
            </div>
            {!showCollapsed && (
              <span className="text-xs text-gray-600 dark:text-gray-400 truncate flex-1 text-left">
                {currentUser?.split("@")[0]}
              </span>
            )}
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div
                className={`absolute bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50 min-w-[160px] ${
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
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <ExternalLink className="w-4 h-4" />
                  Go to Desk
                </button>
                <button
                  onClick={() => {
                    logout();
                    setShowUserMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <LogOut className="w-4 h-4" />
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
