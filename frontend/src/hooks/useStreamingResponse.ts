import { useEffect } from "react";
import { useFrappeEventListener } from "frappe-react-sdk";
import {
  StreamingChunk,
  StreamingComplete,
  StructuredResult,
  ToolCallEvent,
} from "@/types";

interface UseStreamingResponseProps {
  sessionId: string | undefined;
  onToken: (content: string) => void;
  onComplete: () => void;
  onError: (error: string) => void;
  onToolCall?: (event: ToolCallEvent) => void;
  onThinking?: () => void;
  onResult?: (messageId: string, result: StructuredResult) => void;
  onLimitReached?: () => void;
}

export function useStreamingResponse({
  sessionId,
  onToken,
  onComplete,
  onError,
  onToolCall,
  onThinking,
  onResult,
  onLimitReached,
}: UseStreamingResponseProps) {
  useFrappeEventListener("nextassist_thinking", (data: any) => {
    if (data.session === sessionId && onThinking) {
      onThinking();
    }
  });

  useFrappeEventListener("nextassist_token", (data: StreamingChunk) => {
    if (data.session === sessionId) {
      onToken(data.content);
    }
  });

  useFrappeEventListener("nextassist_complete", (data: StreamingComplete) => {
    if (data.session === sessionId) {
      onComplete();
    }
  });

  useFrappeEventListener("nextassist_error", (data: any) => {
    if (data.session === sessionId) {
      onError(data.error || "An error occurred");
    }
  });

  useFrappeEventListener("nextassist_tool_call", (data: ToolCallEvent) => {
    if (data.session === sessionId && onToolCall) {
      onToolCall(data);
    }
  });

  useFrappeEventListener(
    "nextassist_result",
    (data: { session: string; message_id: string; result: StructuredResult }) => {
      if (data.session === sessionId && onResult) {
        onResult(data.message_id, data.result);
      }
    }
  );

  useFrappeEventListener("nextassist_limit_reached", (data: any) => {
    if (data.session === sessionId && onLimitReached) {
      onLimitReached();
    }
  });
}
