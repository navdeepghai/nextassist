import { useFrappeGetCall } from "frappe-react-sdk";
import { useNavigate } from "react-router-dom";
import { Zap, Activity, MessageSquare, Clock } from "lucide-react";

interface UsageSummary {
  total_tokens: number;
  total_sessions: number;
  active_sessions: number;
  last_used_at: string | null;
}

interface RecentSession {
  id: string;
  title: string;
  user_email: string;
  status: string;
  last_message_at: string | null;
  total_tokens: number;
}

interface UsageData {
  summary: UsageSummary;
  recent_sessions: RecentSession[];
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

const STATUS_DOT: Record<string, string> = {
  Active: "bg-green-500",
  "Limit Reached": "bg-yellow-500",
  Archived: "bg-gray-400",
};

export function ProviderUsageSidebar({ providerName }: { providerName: string }) {
  const navigate = useNavigate();

  const { data, isLoading } = useFrappeGetCall<{ message: UsageData }>(
    "nextassist.api.provider.get_provider_usage",
    { provider_name: providerName }
  );

  const usage = data?.message;

  if (isLoading) {
    return (
      <div className="space-y-5">
        {/* Skeleton cards */}
        {[1, 2].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
            <div className="px-4 py-3 space-y-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!usage) return null;

  const { summary, recent_sessions } = usage;

  const stats = [
    { icon: Zap, label: "Tokens Burned", value: formatTokens(summary.total_tokens) },
    { icon: Activity, label: "Active Sessions", value: String(summary.active_sessions) },
    { icon: MessageSquare, label: "Total Sessions", value: String(summary.total_sessions) },
    {
      icon: Clock,
      label: "Last Used",
      value: summary.last_used_at ? timeAgo(summary.last_used_at) : "Never",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Usage Stats Card */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Usage Stats</h3>
        </div>
        <div className="px-4 py-3 space-y-3">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <s.icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                <span className="text-xs text-gray-600 dark:text-gray-400">{s.label}</span>
              </div>
              <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Sessions Card */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Recent Sessions</h3>
        </div>
        {recent_sessions.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              No sessions have used this provider yet.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {recent_sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => navigate(`/chat/${session.id}`)}
                className="w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[session.status] || "bg-gray-400"}`}
                  />
                  <span className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                    {session.title || "Untitled"}
                  </span>
                </div>
                <div className="ml-4 mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                  <span className="truncate max-w-[100px]">{session.user_email}</span>
                  <span>·</span>
                  <span>{formatTokens(session.total_tokens)} tok</span>
                  {session.last_message_at && (
                    <>
                      <span>·</span>
                      <span>{timeAgo(session.last_message_at)}</span>
                    </>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
