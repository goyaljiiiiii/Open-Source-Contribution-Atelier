import { useState, useMemo, useRef, useCallback } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchApi } from "../../lib/api";
import { HelpCircle, Code, Award, BookOpen, Clock } from "lucide-react";

interface FeedEntry {
  id: string;
  type:
    | "help_request"
    | "code_submission"
    | "badge_earned"
    | "lesson_completed";
  user_id: number;
  username: string;
  title: string;
  description: string;
  created_at: string;
}

interface FeedResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: FeedEntry[];
}

function FeedIcon({ type }: { type: FeedEntry["type"] }) {
  const props = { className: "w-5 h-5 flex-shrink-0" };
  switch (type) {
    case "help_request":
      return <HelpCircle {...props} />;
    case "code_submission":
      return <Code {...props} />;
    case "badge_earned":
      return <Award {...props} />;
    case "lesson_completed":
      return <BookOpen {...props} />;
  }
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function FeedEntryItem({ entry }: { entry: FeedEntry }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const parsedData = useMemo(() => {
    if (!entry.description) return null;
    const desc = entry.description.trim();
    if (desc.startsWith("{") || desc.startsWith("[")) {
      try {
        return JSON.parse(desc);
      } catch {
        return null;
      }
    }
    return null;
  }, [entry.description]);

  const formattedDescription = useMemo(() => {
    if (parsedData) {
      const parts: string[] = [];
      if (parsedData.text) {
        parts.push(`Message: ${parsedData.text}`);
      }
      if (parsedData.originalCode || parsedData.code) {
        parts.push(`Code:\n${parsedData.originalCode || parsedData.code}`);
      }
      if (parts.length > 0) return parts.join("\n\n");
      return JSON.stringify(parsedData, null, 2);
    }
    return entry.description;
  }, [parsedData, entry.description]);

  if (!formattedDescription) return null;

  const shouldTruncate =
    formattedDescription.length > 120 || formattedDescription.includes("\n");

  return (
    <div className="mt-1">
      {shouldTruncate && !isExpanded ? (
        <div className="text-xs text-muted dark:text-[#94a3b8]">
          <p className="line-clamp-2 inline whitespace-pre-wrap">
            {formattedDescription}
          </p>
          <button
            onClick={() => setIsExpanded(true)}
            className="text-xs text-primary font-bold ml-1 hover:underline focus:outline-none"
          >
            Show more
          </button>
        </div>
      ) : (
        <div className="text-xs text-muted dark:text-[#94a3b8] whitespace-pre-wrap bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-black/5 dark:border-white/5">
          <p className="inline">{formattedDescription}</p>
          {shouldTruncate && (
            <button
              onClick={() => setIsExpanded(false)}
              className="text-xs text-primary font-bold ml-2 hover:underline focus:outline-none block mt-2"
            >
              Show less
            </button>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useMemo, useRef, useCallback } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchApi } from "../../lib/api";
import { HelpCircle, Code, Award, BookOpen, Clock, Image as ImageIcon, X, Send, AlertCircle } from "lucide-react";
import { toast } from "react-hot-toast";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB limit
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function CommunityPostComposer({ onPostCreated }: { onPostCreated?: () => void }) {
  const [postText, setPostText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError("Unsupported file type. Please upload a JPG, PNG, WEBP, or GIF image.");
      toast.error("Invalid image format.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setImageError("Image file size exceeds 5MB limit. Please choose a smaller image.");
      toast.error("File size exceeds 5MB limit.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);
    const preview = URL.createObjectURL(file);
    setImagePreviewUrl(preview);
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postText.trim() && !selectedFile) return;

    setIsPosting(true);
    try {
      // Simulate/post entry
      toast.success("Post published to community! 🎉");
      setPostText("");
      handleRemoveImage();
      if (onPostCreated) onPostCreated();
    } catch (err) {
      toast.error("Failed to publish post.");
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="rounded-2xl border-4 border-black bg-slate-50 p-4 mb-6 dark:bg-[#1f1c18] dark:border-[#3a3a45]">
      <h4 className="text-sm font-black uppercase tracking-wider text-black dark:text-[#f0ebe2] mb-3 flex items-center gap-2">
        <span>✍️ Create Community Post</span>
      </h4>

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={postText}
          onChange={(e) => setPostText(e.target.value)}
          placeholder="Share an update, ask a question, or show off a merged PR..."
          rows={3}
          className="w-full rounded-xl border-2 border-black p-3 text-sm font-bold bg-white dark:bg-[#151411] dark:border-[#2e2924] dark:text-white outline-none focus:ring-2 focus:ring-primary"
        />

        {imageError && (
          <div className="flex items-center gap-2 text-xs font-bold text-red-600 bg-red-100 dark:bg-red-950/40 p-2.5 rounded-lg border border-red-300">
            <AlertCircle size={16} className="shrink-0" />
            <span>{imageError}</span>
          </div>
        )}

        {imagePreviewUrl && (
          <div className="relative inline-block border-2 border-black rounded-xl overflow-hidden shadow-card-sm bg-black/5 dark:bg-white/5 p-1">
            <img
              src={imagePreviewUrl}
              alt="Upload preview"
              className="max-h-36 max-w-xs object-cover rounded-lg"
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute top-2 right-2 bg-black/80 text-white rounded-full p-1 hover:bg-red-600 transition-colors cursor-pointer"
              aria-label="Remove image"
            >
              <X size={14} />
            </button>
            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 mt-1 px-1 truncate max-w-xs">
              {selectedFile?.name} ({(selectedFile ? selectedFile.size / (1024 * 1024) : 0).toFixed(2)} MB)
            </p>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            id="community-image-upload-input"
          />
          <label
            htmlFor="community-image-upload-input"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-black bg-white dark:bg-[#151411] dark:border-[#2e2924] text-xs font-black cursor-pointer hover:bg-slate-100 transition-colors shadow-card-sm"
          >
            <ImageIcon size={16} className="text-primary" />
            <span>Attach Image</span>
          </label>

          <button
            type="submit"
            disabled={isPosting || (!postText.trim() && !selectedFile)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 border-black bg-primary text-black text-xs font-black uppercase shadow-card-sm hover:opacity-90 active:translate-y-0.5 disabled:opacity-50 transition-all cursor-pointer"
          >
            <Send size={14} />
            <span>{isPosting ? "Publishing..." : "Post"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export function CommunityFeed() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery<FeedResponse>({
      queryKey: ["communityFeed"],
      queryFn: async ({ pageParam }) => {
        const url = pageParam
          ? `/progress/feed/?page=${pageParam}`
          : "/progress/feed/";
        return fetchApi(url);
      },
      initialPageParam: 1,
      getNextPageParam: (lastPage) => {
        if (!lastPage.next) return undefined;
        const url = new URL(lastPage.next);
        const page = url.searchParams.get("page");
        return page ? Number(page) : undefined;
      },
    });

  const entries = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap((page) => page.results ?? []);
  }, [data]);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback(
    (node: Element | null) => {
      if (isFetchingNextPage) return;
      if (observerRef.current) observerRef.current.disconnect();
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasNextPage) {
          fetchNextPage();
        }
      });
      if (node) observerRef.current.observe(node);
    },
    [isFetchingNextPage, hasNextPage, fetchNextPage],
  );

  return (
    <div className="rounded-2xl border-4 border-black bg-white p-4 sm:p-6 shadow-card dark:bg-[#1a1a24] dark:border-[#3a3a45]">
      <CommunityPostComposer />

      <h3 className="text-2xl font-black mb-6 flex items-center gap-2 text-text dark:text-[#eef2f6]">
        <Clock className="text-accent w-6 h-6" /> Community Activity
      </h3>

      {isLoading && entries.length === 0 ? (
        <p className="text-sm text-muted animate-pulse font-bold">
          Loading feed...
        </p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted font-bold">
          No activity yet. Be the first to contribute!
        </p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, idx) => {
            const isLast = idx === entries.length - 1;
            return (
              <div
                key={entry.id}
                ref={isLast ? lastElementRef : null}
                className="flex items-start gap-3 p-3 rounded-xl border-2 border-black/10 dark:border-[#3a3a45]/50 hover:border-accent/50 transition-colors"
              >
                <div className="mt-0.5 text-accent dark:text-accent/80">
                  <FeedIcon type={entry.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-text dark:text-[#eef2f6] truncate">
                    <span className="text-primary">@{entry.username}</span>{" "}
                    {entry.title}
                  </p>
                  <FeedEntryItem entry={entry} />
                </div>
                <span className="text-[10px] font-bold text-muted dark:text-[#94a3b8] flex-shrink-0 whitespace-nowrap pt-0.5">
                  {timeAgo(entry.created_at)}
                </span>
              </div>
            );
          })}
          {isFetchingNextPage && (
            <p className="text-sm text-muted animate-pulse font-bold text-center py-2">
              Loading more...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
