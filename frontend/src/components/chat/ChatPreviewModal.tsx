import { useMemo, useEffect } from "react";
import {
  X,
  Bot,
  User,
  Wrench,
  AlertCircle,
  Clock,
  Hash,
  Zap,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import { Message, Session, StructuredResult } from "@/types";
import { MessageBubble } from "./MessageBubble";

interface ChatPreviewModalProps {
  open: boolean;
  onClose: () => void;
  session: Session;
  messages: Message[];
  onOpenChat?: () => void;
}

const roleLabels: Record<string, { icon: typeof Bot; label: string; color: string }> = {
  user: { icon: User, label: "User", color: "text-blue-600 dark:text-blue-400" },
  assistant: { icon: Bot, label: "Assistant", color: "text-gray-600 dark:text-gray-400" },
  tool: { icon: Wrench, label: "Tool", color: "text-amber-600 dark:text-amber-400" },
  system: { icon: AlertCircle, label: "System", color: "text-purple-600 dark:text-purple-400" },
};

const statusColors: Record<string, string> = {
  Active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "Limit Reached": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  Archived: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

function formatTokens(n?: number): string {
  if (n == null) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDate(d?: string): string {
  if (!d) return "—";
  return new Date(d).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatPreviewModal({
  open,
  onClose,
  session,
  messages,
  onOpenChat,
}: ChatPreviewModalProps) {
  // Lock body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Build structured results map from metadata
  const structuredResults = useMemo(() => {
    const results: Record<string, StructuredResult> = {};
    for (const msg of messages) {
      if (msg.metadata) {
        try {
          const meta =
            typeof msg.metadata === "string"
              ? JSON.parse(msg.metadata)
              : msg.metadata;
          if (meta.structured_result) {
            results[msg.name] = meta.structured_result;
          }
        } catch {
          // ignore
        }
      }
    }
    return results;
  }, [messages]);

  // Message stats
  const stats = useMemo(() => {
    let userCount = 0;
    let assistantCount = 0;
    let toolCount = 0;
    let errorCount = 0;
    let totalTokens = 0;
    for (const m of messages) {
      if (m.role === "user") userCount++;
      else if (m.role === "assistant") assistantCount++;
      else if (m.role === "tool") toolCount++;
      if (m.is_error) errorCount++;
      totalTokens += m.token_count || 0;
    }
    return { userCount, assistantCount, toolCount, errorCount, totalTokens };
  }, [messages]);

  if (!open) return null;

  const visibleMessages = messages.filter((m) => m.role !== "system");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-[95vw] h-[90vh] max-w-7xl bg-gray-50 dark:bg-gray-950 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-gray-400" />
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {session.title || "Untitled Session"}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {messages.length} messages · {session.provider || "Unknown provider"} · {session.model || "Unknown model"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenChat && (
              <button
                onClick={onOpenChat}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in Chat
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body — 3-column layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar — Session info */}
          <div className="w-64 shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto hidden lg:block">
            {/* Session Details */}
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Session Details
              </h3>
            </div>
            <div className="px-4 py-3 space-y-3">
              <div>
                <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Status</p>
                <span
                  className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    statusColors[session.status] || "bg-gray-100 text-gray-600"
                  }`}
                >
                  {session.status}
                </span>
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">User</p>
                <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5">{session.user}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Provider</p>
                <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5">{session.provider || "—"}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Model</p>
                <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5">{session.model || "—"}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Created</p>
                <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5">{formatDate(session.creation)}</p>
              </div>
            </div>

            {/* Stats */}
            <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                Statistics
              </h3>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">Total Tokens</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                    {formatTokens(stats.totalTokens)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">User Messages</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                    {stats.userCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">AI Responses</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                    {stats.assistantCount}
                  </span>
                </div>
                {stats.toolCount > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs text-gray-500 dark:text-gray-400">Tool Calls</span>
                    </div>
                    <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                      {stats.toolCount}
                    </span>
                  </div>
                )}
                {stats.errorCount > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-xs text-gray-500 dark:text-gray-400">Errors</span>
                    </div>
                    <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                      {stats.errorCount}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Center — Chat messages */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 py-6 space-y-1">
              {visibleMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <MessageSquare className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No messages in this session.</p>
                </div>
              ) : (
                visibleMessages.map((msg) => (
                  <MessageBubble
                    key={msg.name}
                    message={msg}
                    structuredResult={structuredResults[msg.name]}
                  />
                ))
              )}
            </div>
          </div>

          {/* Right sidebar — Message timeline */}
          <div className="w-60 shrink-0 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto hidden xl:block">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Message Timeline
              </h3>
            </div>
            <div className="px-3 py-2">
              {visibleMessages.map((msg, i) => {
                const info = roleLabels[msg.role] || roleLabels.system;
                const Icon = info.icon;
                return (
                  <div key={msg.name} className="flex gap-2 py-1.5">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                          msg.is_error
                            ? "bg-red-100 dark:bg-red-900/30"
                            : "bg-gray-100 dark:bg-gray-800"
                        }`}
                      >
                        <Icon
                          className={`w-3 h-3 ${msg.is_error ? "text-red-500" : info.color}`}
                        />
                      </div>
                      {i < visibleMessages.length - 1 && (
                        <div className="w-px flex-1 bg-gray-200 dark:bg-gray-700 my-0.5" />
                      )}
                    </div>
                    <div className="min-w-0 pb-2">
                      <div className="flex items-center gap-1">
                        <span className={`text-[11px] font-medium ${info.color}`}>
                          {info.label}
                        </span>
                        {msg.is_error && (
                          <span className="text-[10px] text-red-500 font-medium">Error</span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        {msg.content?.slice(0, 60) || "(empty)"}
                        {(msg.content?.length || 0) > 60 ? "..." : ""}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {msg.token_count != null && msg.token_count > 0 && (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-0.5">
                            <Hash className="w-2.5 h-2.5" />
                            {formatTokens(msg.token_count)}
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(msg.creation).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
