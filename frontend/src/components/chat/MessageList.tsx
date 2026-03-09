import { useEffect, useRef } from "react";
import { Message, StructuredResult } from "@/types";
import { MessageBubble } from "./MessageBubble";
import { StreamingBubble } from "./StreamingBubble";

interface MessageListProps {
  messages: Message[];
  streamingContent: string;
  isStreaming: boolean;
  isThinking: boolean;
  activeToolCall?: string;
  structuredResults?: Record<string, StructuredResult>;
}

export function MessageList({
  messages,
  streamingContent,
  isStreaming,
  isThinking,
  activeToolCall,
  structuredResults,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, isThinking]);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-blue-900">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-1">
            Start a conversation
          </h2>
          <p className="text-gray-400 dark:text-gray-500 text-sm leading-relaxed">
            Ask me anything — I can help with questions, analyze documents, and
            interact with your data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="max-w-3xl mx-auto">
        {messages
          .filter((m) => m.role !== "system")
          .map((message) => (
            <MessageBubble
              key={message.name}
              message={message}
              structuredResult={structuredResults?.[message.name]}
            />
          ))}
        {isStreaming && (
          <StreamingBubble
            content={streamingContent}
            isThinking={isThinking}
            activeToolCall={activeToolCall}
          />
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
