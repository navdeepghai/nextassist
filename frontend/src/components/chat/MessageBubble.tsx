import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message, StructuredResult } from "@/types";
import { ResultRenderer } from "./ResultRenderer";

interface MessageBubbleProps {
  message: Message;
  structuredResult?: StructuredResult;
}

/** Strip thinking blocks and python code blocks from assistant display text. */
function cleanContent(content: string): string {
  let cleaned = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, "").trim();
  cleaned = cleaned.replace(/```python[\s\S]*?```/g, "").trim();
  return cleaned;
}

/** Extract python code block from content for "Show code" toggle. */
function extractCode(content: string): string | null {
  const match = content.match(/```python\n([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}

export function MessageBubble({ message, structuredResult }: MessageBubbleProps) {
  const [showCode, setShowCode] = useState(false);

  if (message.role === "tool") {
    return (
      <div className="flex justify-start mb-4">
        <div className="max-w-2xl bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2 text-xs font-mono text-gray-600 dark:text-gray-400">
          <span className="text-gray-400 dark:text-gray-500">Tool result:</span>
          <pre className="mt-1 whitespace-pre-wrap break-words">
            {message.content?.slice(0, 500)}
            {(message.content?.length || 0) > 500 ? "..." : ""}
          </pre>
        </div>
      </div>
    );
  }

  const isUser = message.role === "user";
  const isError = message.is_error;
  const isAssistant = message.role === "assistant";

  const displayContent = isAssistant
    ? cleanContent(message.content || "")
    : message.content || "";

  const codeBlock = isAssistant ? extractCode(message.content || "") : null;

  return (
    <div
      className={`flex mb-4 ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`${structuredResult?.chart ? "max-w-4xl w-full" : "max-w-2xl"} rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-blue-600 text-white"
            : isError
            ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
            : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200"
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <>
            {displayContent ? (
              <div className="markdown-content text-sm prose prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {displayContent}
                </ReactMarkdown>
              </div>
            ) : !structuredResult && codeBlock ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">Processing your request...</p>
            ) : null}

            {/* Structured result */}
            {structuredResult && <ResultRenderer result={structuredResult} />}

            {/* Show code toggle */}
            {codeBlock && (
              <div className="mt-2">
                <button
                  onClick={() => setShowCode(!showCode)}
                  className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                  {showCode ? "Hide code" : "Show code"}
                </button>
                {showCode && (
                  <pre className="mt-2 p-3 bg-gray-900 text-gray-100 text-xs rounded-lg overflow-x-auto">
                    <code>{codeBlock}</code>
                  </pre>
                )}
              </div>
            )}
          </>
        )}
        {message.model && !isUser && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{message.model}</p>
        )}
      </div>
    </div>
  );
}
