import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface StreamingBubbleProps {
  content: string;
  isThinking: boolean;
  activeToolCall?: string;
}

function cleanStreamingContent(text: string): string {
  // Remove complete <thinking>...</thinking> blocks
  let cleaned = text.replace(/<thinking>[\s\S]*?<\/thinking>/g, "").trim();
  // Remove incomplete opening <thinking> tag at the end (still streaming)
  cleaned = cleaned.replace(/<thinking>[\s\S]*$/, "").trim();
  // Remove complete python code blocks
  cleaned = cleaned.replace(/```python[\s\S]*?```/g, "").trim();
  // Remove incomplete python code block at the end (still streaming)
  cleaned = cleaned.replace(/```python[\s\S]*$/, "").trim();
  return cleaned;
}

export function StreamingBubble({
  content,
  isThinking,
  activeToolCall,
}: StreamingBubbleProps) {
  const displayContent = content ? cleanStreamingContent(content) : "";

  if (!displayContent && !isThinking && !activeToolCall) return null;

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-2xl rounded-2xl px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200">
        {isThinking && !content && !activeToolCall && (
          <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce [animation-delay:0ms]"></span>
              <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce [animation-delay:150ms]"></span>
              <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce [animation-delay:300ms]"></span>
            </div>
            Thinking...
          </div>
        )}
        {activeToolCall && (
          <div className="flex items-center gap-2 text-sm text-amber-600 mb-2">
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Calling tool: {activeToolCall}
          </div>
        )}
        {displayContent && (
          <div className="markdown-content text-sm prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {displayContent}
            </ReactMarkdown>
            <span className="inline-block w-1.5 h-4 bg-blue-500 animate-pulse ml-0.5 align-text-bottom"></span>
          </div>
        )}
      </div>
    </div>
  );
}
