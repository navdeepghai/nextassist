import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useChat } from "@/hooks/useChat";
import { useStreamingResponse } from "@/hooks/useStreamingResponse";
import { useSessions } from "@/hooks/useSessions";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { toast } from "sonner";

interface ChatContainerProps {
  sessionId: string | undefined;
}

export function ChatContainer({
  sessionId,
}: ChatContainerProps) {
  if (!sessionId) {
    return <EmptyState />;
  }

  return <ActiveChat sessionId={sessionId} />;
}

function EmptyState() {
  const navigate = useNavigate();
  const { createSession } = useSessions();

  const handleNewChat = async () => {
    const session = await createSession();
    if (session?.name) {
      navigate(`/chat/${session.name}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--na-card)] dark:bg-[var(--na-card)]">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-[#007AFF] to-[#0071E3] flex items-center justify-center shadow-lg shadow-[#007AFF]/20 dark:shadow-none">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-[var(--na-text)] mb-2">
            NextAssist
          </h2>
          <p className="text-[#86868B] text-sm mb-8 leading-relaxed">
            Start a conversation to get help with your data, analyze documents, or ask questions.
          </p>
          <button
            onClick={handleNewChat}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#007AFF] dark:bg-[#0A84FF] text-white text-sm font-medium rounded-xl hover:bg-[#0071E3] dark:hover:bg-[#409CFF] transition-colors shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            New Conversation
          </button>
        </div>
      </div>
    </div>
  );
}

interface ActiveChatProps {
  sessionId: string;
}

function ActiveChat({
  sessionId,
}: ActiveChatProps) {
  const navigate = useNavigate();
  const {
    messages,
    isLoading,
    isStreaming,
    streamingContent,
    structuredResults,
    tokenWarning,
    limitReached,
    sendMessage,
    appendStreamingToken,
    completeStreaming,
    handleError,
    handleLimitReached,
    addStructuredResult,
    dismissTokenWarning,
  } = useChat(sessionId);

  const { sessions, continueSession, updateSessionModel, refreshSessions } =
    useSessions();
  const currentSession = sessions.find((s) => s.name === sessionId);

  // Check if session was already marked as Limit Reached (persisted status)
  const isLimitReached =
    limitReached || currentSession?.status === "Limit Reached";

  const [isThinking, setIsThinking] = useState(false);
  const [activeToolCall, setActiveToolCall] = useState<string | undefined>();
  const [isContinuing, setIsContinuing] = useState(false);
  const [hasContinued, setHasContinued] = useState(false);

  // Show "Thinking" immediately when streaming starts (don't wait for WebSocket)
  const prevIsStreaming = useRef(false);
  useEffect(() => {
    if (isStreaming && !prevIsStreaming.current) {
      setIsThinking(true);
    }
    if (!isStreaming && prevIsStreaming.current) {
      setIsThinking(false);
      setActiveToolCall(undefined);
    }
    prevIsStreaming.current = isStreaming;
  }, [isStreaming]);

  useStreamingResponse({
    sessionId,
    onToken: (content) => {
      setIsThinking(false);
      appendStreamingToken(content);
    },
    onComplete: () => {
      setIsThinking(false);
      setActiveToolCall(undefined);
      completeStreaming();
    },
    onError: (error) => {
      setIsThinking(false);
      setActiveToolCall(undefined);
      handleError();
      toast.error(error);
    },
    onToolCall: (event) => {
      if (event.status === "calling") {
        setActiveToolCall(event.tool);
      } else {
        setActiveToolCall(undefined);
      }
    },
    onThinking: () => {
      setIsThinking(true);
    },
    onResult: addStructuredResult,
    onLimitReached: () => {
      setIsThinking(false);
      setActiveToolCall(undefined);
      handleLimitReached();
    },
  });

  const handleModelChange = useCallback(
    async (model: string) => {
      try {
        await updateSessionModel(sessionId, model);
      } catch {
        toast.error("Failed to switch model");
      }
    },
    [sessionId, updateSessionModel]
  );

  const handleContinue = useCallback(async () => {
    setIsContinuing(true);
    try {
      const newSession = await continueSession(sessionId);
      if (newSession?.name) {
        setHasContinued(true);
        await refreshSessions();
        navigate(`/chat/${newSession.name}`);
      }
    } catch (err) {
      console.error("Failed to continue session:", err);
      toast.error("Failed to create new chat");
    } finally {
      setIsContinuing(false);
    }
  }, [sessionId, continueSession, refreshSessions, navigate]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--na-card)] dark:bg-[var(--na-card)]">
      <ChatHeader
        sessionId={sessionId}
        model={currentSession?.model}
        provider={currentSession?.provider}
        messages={messages}
      />
      <MessageList
        messages={messages}
        streamingContent={streamingContent}
        isStreaming={isStreaming}
        isThinking={isThinking}
        activeToolCall={activeToolCall}
        structuredResults={structuredResults}
      />
      {tokenWarning && !isLimitReached && (
        <div className="mx-4 mb-2 flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
          <span className="flex-1">{tokenWarning}</span>
          <button
            onClick={dismissTokenWarning}
            className="shrink-0 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      )}
      {isLimitReached && !hasContinued ? (
        <div className="mx-4 mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
          <div className="flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-red-500">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4" />
              <path d="M12 16h.01" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-400">
                Context limit reached
              </p>
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                This conversation has exceeded the model's context window. Continue in a new chat to keep going.
              </p>
            </div>
          </div>
          <button
            onClick={handleContinue}
            disabled={isContinuing}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#007AFF] dark:bg-[#0A84FF] text-white text-sm font-medium rounded-lg hover:bg-[#0071E3] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isContinuing ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creating new chat...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
                Continue in New Chat
              </>
            )}
          </button>
        </div>
      ) : (
        <ChatInput
          onSend={sendMessage}
          disabled={isStreaming || isLoading}
          currentModel={currentSession?.model}
          onModelChange={handleModelChange}
        />
      )}
    </div>
  );
}
