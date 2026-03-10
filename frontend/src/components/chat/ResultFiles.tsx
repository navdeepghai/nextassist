import { FileResult } from "@/types";

interface ResultFilesProps {
  files: FileResult[];
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function FileIcon({ type }: { type: string }) {
  const iconProps = {
    xmlns: "http://www.w3.org/2000/svg",
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (type) {
    case "image":
      return (
        <svg {...iconProps} className="text-green-600">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
      );
    case "pdf":
      return (
        <svg {...iconProps} className="text-red-600">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
    case "video":
      return (
        <svg {...iconProps} className="text-purple-600">
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" />
        </svg>
      );
    default:
      return (
        <svg {...iconProps} className="text-gray-500 dark:text-gray-400">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
  }
}

export function ResultFiles({ files }: ResultFilesProps) {
  if (!files.length) return null;

  // Separate images from other files
  const images = files.filter((f) => f.display_type === "image");
  const otherFiles = files.filter((f) => f.display_type !== "image");

  return (
    <div className="space-y-3">
      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {images.map((file) => (
            <a
              key={file.name}
              href={file.view_url || file.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-blue-300 transition-colors"
            >
              <img
                src={file.view_url || file.file_url}
                alt={file.file_name}
                className="w-full h-32 object-cover"
              />
              <div className="px-2 py-1 bg-white dark:bg-gray-900 text-xs text-gray-600 dark:text-gray-400 truncate">
                {file.file_name}
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Other files list */}
      {otherFiles.length > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
          {otherFiles.map((file) => (
            <a
              key={file.name}
              href={file.view_url || file.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <FileIcon type={file.display_type} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 dark:text-gray-200 truncate">
                  {file.file_name}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {file.display_type.toUpperCase()}
                  {file.file_size ? ` \u00B7 ${formatFileSize(file.file_size)}` : ""}
                  {file.attached_to_name ? ` \u00B7 ${file.attached_to_name}` : ""}
                </p>
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-gray-400 dark:text-gray-500 shrink-0"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
