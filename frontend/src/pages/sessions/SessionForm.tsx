import { useState } from "react";
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { useParams, useNavigate } from "react-router-dom";
import { History, ExternalLink, Bot, User, Wrench, AlertCircle, Eye } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { FormView, FormSection, FormField, FormRow } from "@/components/form/FormView";
import { ChatPreviewModal } from "@/components/chat/ChatPreviewModal";
import { Session, Message } from "@/types";

const statusColors: Record<string, string> = {
  Active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "Limit Reached": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  Archived: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const roleIcons: Record<string, typeof Bot> = {
  user: User,
  assistant: Bot,
  tool: Wrench,
  system: AlertCircle,
};

const roleColors: Record<string, string> = {
  user: "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800",
  assistant: "bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700",
  tool: "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800",
  system: "bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800",
};

function formatTokens(n?: number): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function SessionForm() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: sessionsData, isLoading: sessionsLoading } = useFrappeGetCall<{
    message: Session[];
  }>("nextassist.api.session.list_sessions", { limit: 200 });

  const { data: messagesData, isLoading: messagesLoading } = useFrappeGetCall<{
    message: Message[];
  }>(
    sessionId ? "nextassist.api.chat.get_messages" : null,
    sessionId ? { session_id: sessionId } : undefined
  );

  const { call: deleteSessionApi } = useFrappePostCall(
    "nextassist.api.session.delete_session"
  );

  const session = (sessionsData?.message || []).find((s) => s.name === sessionId);
  const messages = messagesData?.message || [];
  const isLoading = sessionsLoading || messagesLoading;

  const handleDelete = async () => {
    if (!sessionId) return;
    if (!confirm(`Delete session "${session?.title || sessionId}"?`)) return;
    await deleteSessionApi({ session_id: sessionId });
    navigate("/sessions");
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!session) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-full text-center">
          <History className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Session not found</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            The session may have been deleted.
          </p>
          <button
            onClick={() => navigate("/sessions")}
            className="mt-4 text-sm text-blue-600 hover:text-blue-700"
          >
            Back to Sessions
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout fullWidth>
      <FormView
        title={session.title || "Untitled Session"}
        subtitle={`Session ${session.name}`}
        icon={<History className="w-5 h-5" />}
        backPath="/sessions"
        backLabel="Sessions"
        onDelete={handleDelete}
        meta={{
          created_at: session.creation,
          modified_at: session.modified,
        }}
        sidebar={
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Quick Actions</h3>
            </div>
            <div className="px-4 py-3 space-y-2">
              <button
                onClick={() => setPreviewOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <Eye className="w-4 h-4" />
                View Chat
              </button>
              <button
                onClick={() => navigate(`/chat/${sessionId}`)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open in Chat
              </button>
            </div>
          </div>
        }
      >
        {/* Details Section */}
        <FormSection title="Details">
          <FormRow>
            <FormField label="Title">
              <input
                type="text"
                value={session.title || ""}
                readOnly
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 dark:text-gray-100"
              />
            </FormField>
            <FormField label="User">
              <input
                type="text"
                value={session.user}
                readOnly
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 dark:text-gray-100"
              />
            </FormField>
          </FormRow>
          <FormRow>
            <FormField label="Status">
              <div className="flex items-center h-[38px]">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    statusColors[session.status] || "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                >
                  {session.status}
                </span>
              </div>
            </FormField>
            <FormField label="Total Tokens">
              <input
                type="text"
                value={formatTokens(session.total_tokens)}
                readOnly
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 dark:text-gray-100"
              />
            </FormField>
          </FormRow>
          <FormRow>
            <FormField label="Provider">
              <input
                type="text"
                value={session.provider || "—"}
                readOnly
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 dark:text-gray-100"
              />
            </FormField>
            <FormField label="Model">
              <input
                type="text"
                value={session.model || "—"}
                readOnly
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 dark:text-gray-100"
              />
            </FormField>
          </FormRow>
        </FormSection>

        {/* Messages Section */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Messages</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {messages.length} message{messages.length !== 1 ? "s" : ""} in this session
              </p>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => setPreviewOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                View Chat
              </button>
            )}
          </div>
          <div className="px-5 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500 dark:text-gray-400">No messages in this session.</p>
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto -mx-5 px-5 space-y-3">
              {messages.map((msg) => {
                const RoleIcon = roleIcons[msg.role] || AlertCircle;
                const colorClass = roleColors[msg.role] || "bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700";
                return (
                  <div
                    key={msg.name}
                    className={`rounded-lg border p-3 ${colorClass}`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <RoleIcon className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 capitalize">
                          {msg.role}
                        </span>
                        {msg.is_error && (
                          <span className="text-xs text-red-600 font-medium ml-1">
                            (error)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                        {msg.token_count != null && (
                          <span>{formatTokens(msg.token_count)} tokens</span>
                        )}
                        <span>
                          {new Date(msg.creation).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words line-clamp-4">
                      {msg.content || "(empty)"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>
      </FormView>

      {/* Chat Preview Modal */}
      <ChatPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        session={session}
        messages={messages}
        onOpenChat={() => navigate(`/chat/${sessionId}`)}
      />
    </AppLayout>
  );
}
