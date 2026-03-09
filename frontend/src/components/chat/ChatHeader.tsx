import { Message } from "@/types";
import { useMemo } from "react";
import { Coins, Settings } from "lucide-react";

interface ChatHeaderProps {
  sessionId: string;
  model?: string;
  provider?: string;
  messages: Message[];
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

export function ChatHeader({
  model,
  provider,
  messages,
}: ChatHeaderProps) {
  const totalTokens = useMemo(
    () => messages.reduce((sum, m) => sum + (m.token_count || 0), 0),
    [messages]
  );

  const isSystemManager =
    // @ts-ignore — frappe global
    window.frappe?.boot?.user?.roles?.includes("System Manager") ?? false;

  return (
    <div className="h-12 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center justify-between pl-14 md:pl-4 pr-4 shrink-0">
      <div className="flex items-center gap-3">
        {/* Model badge */}
        {model && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-600 dark:text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            {model}
          </span>
        )}

        {provider && (
          <span className="text-xs text-gray-400 dark:text-gray-500">{provider}</span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Token counter */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500" title="Total tokens used in this conversation">
          <Coins className="w-3.5 h-3.5" />
          <span>{formatTokens(totalTokens)} tokens</span>
        </div>

        {/* Settings button — System Manager only */}
        {isSystemManager && (
          <a
            href="/nextassist/settings"
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  );
}
