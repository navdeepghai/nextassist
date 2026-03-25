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
    <div className="h-12 border-b border-black/5 dark:border-white/5 bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl flex items-center justify-between pl-14 md:pl-4 pr-4 shrink-0">
      <div className="flex items-center gap-3">
        {/* Model badge */}
        {model && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#007AFF]/10 dark:bg-[#0A84FF]/12 text-[13px] font-medium text-[#007AFF] dark:text-[#0A84FF]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34C759] dark:bg-[#30D158]" />
            {model}
          </span>
        )}

        {provider && (
          <span className="text-[13px] text-[#86868B]">{provider}</span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Token counter */}
        <div className="flex items-center gap-1.5 text-[13px] text-[#86868B]" title="Total tokens used in this conversation">
          <Coins className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span>{formatTokens(totalTokens)} tokens</span>
        </div>

        {/* Settings button — System Manager only */}
        {isSystemManager && (
          <a
            href="/nextassist/settings"
            className="p-2 text-[#86868B] hover:text-[var(--na-text)] rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-200 ease-out"
            title="Settings"
          >
            <Settings className="w-4 h-4" strokeWidth={1.5} />
          </a>
        )}
      </div>
    </div>
  );
}
