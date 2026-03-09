import { useState, useCallback, useMemo } from "react";
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { Message, StructuredResult } from "@/types";

export function useChat(sessionId: string | undefined) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [tokenWarning, setTokenWarning] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [realtimeResults, setRealtimeResults] = useState<
    Record<string, StructuredResult>
  >({});

  const { data, error, isLoading, mutate } = useFrappeGetCall<{
    message: Message[];
  }>(
    sessionId ? "nextassist.api.chat.get_messages" : null,
    sessionId ? { session_id: sessionId } : undefined
  );

  const { call: sendMessageApi } = useFrappePostCall(
    "nextassist.api.chat.send_message"
  );

  // Merge structured results from metadata (persisted) and realtime events
  const structuredResults = useMemo(() => {
    const results: Record<string, StructuredResult> = {};
    // Parse from persisted metadata (may be a string or already-parsed object)
    for (const msg of data?.message || []) {
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
          // ignore parse errors
        }
      }
    }
    // Overlay realtime results (takes priority for freshness)
    return { ...results, ...realtimeResults };
  }, [data?.message, realtimeResults]);

  const addStructuredResult = useCallback(
    (messageId: string, result: StructuredResult) => {
      setRealtimeResults((prev) => ({ ...prev, [messageId]: result }));
    },
    []
  );

  const sendMessage = useCallback(
    async (message: string, attachments?: any[]) => {
      if (!sessionId || !message.trim()) return;

      setIsStreaming(true);
      setStreamingContent("");

      try {
        const res = await sendMessageApi({
          session_id: sessionId,
          message,
          attachments: attachments ? JSON.stringify(attachments) : undefined,
        });
        const data = res?.message;
        // Backend returns limit_reached instead of throwing
        if (data?.limit_reached) {
          setLimitReached(true);
          setIsStreaming(false);
          return;
        }
        // Show token warning if returned by backend
        if (data?.token_warning) {
          setTokenWarning(data.token_warning);
        }
        await mutate();
      } catch (err: any) {
        console.error("Failed to send message:", err);
        setIsStreaming(false);
      }
    },
    [sessionId, sendMessageApi, mutate]
  );

  const appendStreamingToken = useCallback((content: string) => {
    setStreamingContent((prev) => prev + content);
  }, []);

  const completeStreaming = useCallback(async () => {
    setIsStreaming(false);
    setStreamingContent("");
    await mutate();
  }, [mutate]);

  const handleError = useCallback(async () => {
    setIsStreaming(false);
    setStreamingContent("");
    // Refetch messages to show the persisted error message
    await mutate();
  }, [mutate]);

  const handleLimitReached = useCallback(() => {
    setLimitReached(true);
    setIsStreaming(false);
    setStreamingContent("");
  }, []);

  const dismissTokenWarning = useCallback(() => {
    setTokenWarning(null);
  }, []);

  return {
    messages: data?.message || [],
    isLoading,
    error,
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
    refreshMessages: mutate,
  };
}
