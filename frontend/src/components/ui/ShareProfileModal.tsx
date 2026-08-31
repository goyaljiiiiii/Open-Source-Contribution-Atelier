import React, { useState } from "react";
import {
  X,
  Copy,
  Check,
  Share2,
  QrCode,
  Globe,
  Github,
  Linkedin,
  Twitter,
  MessageCircle,
  ExternalLink,
  Code,
  Download,
  Sparkles,
} from "lucide-react";
import { useToast } from "../../features/ui/ToastContext";

interface ShareProfileModalProps {
  username: string;
  isOpen: boolean;
  onClose: () => void;
  bio?: string;
  avatarUrl?: string | null;
}

export function ShareProfileModal({
  username,
  isOpen,
  onClose,
  bio,
  avatarUrl,
}: ShareProfileModalProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedBadge, setCopiedBadge] = useState(false);
  const [activeTab, setActiveTab] = useState<"link" | "embed" | "qr">("link");
  let addToast = (_msg: string, _type?: string) => {};
  try {
    const toastObj = useToast();
    addToast = toastObj.addToast;
  } catch {
    // Fallback for isolated unit tests without ToastProvider
  }

  if (!isOpen) return null;

  const profileUrl = `${window.location.origin}/u/${encodeURIComponent(username)}`;

  const badgeMarkdown = `[![Atelier Profile](https://img.shields.io/badge/Atelier-${encodeURIComponent(
    username,
  )}-6366f1?style=for-the-badge&logo=github)](${profileUrl})`;

  const badgeHtml = `<a href="${profileUrl}"><img src="https://img.shields.io/badge/Atelier-${encodeURIComponent(
    username,
  )}-6366f1?style=for-the-badge&logo=github" alt="${username}'s Atelier Profile" /></a>`;

  const handleCopy = (text: string, type: "link" | "badge") => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        void navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }

      if (type === "link") {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
        addToast("Profile link copied to clipboard! 🚀", "success");
      } else {
        setCopiedBadge(true);
        setTimeout(() => setCopiedBadge(false), 2500);
        addToast("Badge Markdown copied for GitHub README! 📝", "success");
      }
    } catch (err) {
      addToast("Failed to copy automatically. Please select text manually.", "error");
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${username}'s Atelier Developer Profile`,
          text: bio || `Check out ${username}'s developer achievements on Atelier!`,
          url: profileUrl,
        });
        addToast("Profile shared successfully!", "success");
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          addToast("Share cancelled or not supported.", "info");
        }
      }
    }
  };

  const shareLinks = [
    {
      name: "Twitter / X",
      icon: Twitter,
      color: "bg-[#1DA1F2]/10 text-[#1DA1F2] border-[#1DA1F2]/30 hover:bg-[#1DA1F2] hover:text-white",
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        `Check out my Open Source Developer profile on Atelier! 🚀\n${profileUrl}`,
      )}`,
    },
    {
      name: "LinkedIn",
      icon: Linkedin,
      color: "bg-[#0A66C2]/10 text-[#0A66C2] border-[#0A66C2]/30 hover:bg-[#0A66C2] hover:text-white",
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
        profileUrl,
      )}`,
    },
    {
      name: "WhatsApp",
      icon: MessageCircle,
      color: "bg-[#25D366]/10 text-[#25D366] border-[#25D366]/30 hover:bg-[#25D366] hover:text-white",
      url: `https://api.whatsapp.com/send?text=${encodeURIComponent(
        `Check out ${username}'s developer profile on Atelier: ${profileUrl}`,
      )}`,
    },
  ];

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    profileUrl,
  )}&format=svg&color=0f172a&bgcolor=ffffff`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-[#12121a]">
        {/* CLOSE BUTTON */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Close modal"
        >
          <X size={20} />
        </button>

        {/* HEADER */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-md">
            <Share2 size={24} />
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Share Profile
            </h3>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Spread the word about your achievements & rank
            </p>
          </div>
        </div>

        {/* PROFILE CARD PREVIEW */}
        <div className="mb-6 flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-[#1a1a26]">
          <div className="h-12 w-12 overflow-hidden rounded-xl border border-indigo-500/30 bg-indigo-500/10 flex items-center justify-center font-black text-indigo-600 dark:text-indigo-400 text-lg">
            {avatarUrl ? (
              <img src={avatarUrl} alt={username} className="h-full w-full object-cover" />
            ) : (
              username.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-900 dark:text-white text-sm truncate">
                @{username}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                <Sparkles size={10} /> Verified Developer
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {profileUrl}
            </p>
          </div>
        </div>

        {/* TAB BUTTONS */}
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/60 mb-5 text-xs font-bold">
          <button
            onClick={() => setActiveTab("link")}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all ${
              activeTab === "link"
                ? "bg-white text-indigo-600 shadow-sm dark:bg-[#252538] dark:text-indigo-400"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <Globe size={14} /> Direct Link
          </button>
          <button
            onClick={() => setActiveTab("embed")}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all ${
              activeTab === "embed"
                ? "bg-white text-indigo-600 shadow-sm dark:bg-[#252538] dark:text-indigo-400"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <Code size={14} /> README Badge
          </button>
          <button
            onClick={() => setActiveTab("qr")}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all ${
              activeTab === "qr"
                ? "bg-white text-indigo-600 shadow-sm dark:bg-[#252538] dark:text-indigo-400"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <QrCode size={14} /> QR Code
          </button>
        </div>

        {/* TAB 1: DIRECT LINK & SOCIALS */}
        {activeTab === "link" && (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Profile Web Address
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={profileUrl}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-mono text-slate-800 dark:border-slate-800 dark:bg-[#181824] dark:text-slate-200 focus:outline-none"
                />
                <button
                  onClick={() => handleCopy(profileUrl, "link")}
                  className={`flex items-center gap-1.5 shrink-0 px-4 py-2 text-xs font-extrabold rounded-xl transition-all shadow-sm ${
                    copiedLink
                      ? "bg-emerald-600 text-white"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white"
                  }`}
                >
                  {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedLink ? "Copied!" : "Copy"}</span>
                </button>
              </div>
            </div>

            {/* NATIVE SHARE IF AVAILABLE */}
            {typeof navigator !== "undefined" && "share" in navigator && (
              <button
                onClick={handleNativeShare}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/80 text-indigo-700 dark:border-indigo-900/40 dark:bg-indigo-950/40 dark:text-indigo-300 font-extrabold text-xs transition-colors"
              >
                <Share2 size={15} /> Use Device Share Drawer
              </button>
            )}

            {/* SOCIAL BUTTONS */}
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
                Share directly to platforms:
              </p>
              <div className="grid grid-cols-3 gap-2">
                {shareLinks.map((s) => {
                  const Icon = s.icon;
                  return (
                    <a
                      key={s.name}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border font-bold text-xs transition-all ${s.color}`}
                    >
                      <Icon size={14} />
                      <span>{s.name}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: README BADGE EMBED */}
        {activeTab === "embed" && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                GitHub README Markdown Snippet
              </label>
              <div className="relative">
                <textarea
                  readOnly
                  rows={2}
                  value={badgeMarkdown}
                  className="w-full rounded-xl border border-slate-200 bg-slate-900 p-3 font-mono text-[11px] text-emerald-400 focus:outline-none resize-none"
                />
                <button
                  onClick={() => handleCopy(badgeMarkdown, "badge")}
                  className={`absolute top-2 right-2 flex items-center gap-1 px-2.5 py-1 text-[11px] font-extrabold rounded-lg transition-all ${
                    copiedBadge
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-700 hover:bg-slate-600 text-white"
                  }`}
                >
                  {copiedBadge ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedBadge ? "Copied!" : "Copy"}</span>
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-[#181824]">
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">
                Live Badge Preview:
              </p>
              <div className="flex justify-center py-2">
                <img
                  src={`https://img.shields.io/badge/Atelier-${encodeURIComponent(
                    username,
                  )}-6366f1?style=for-the-badge&logo=github`}
                  alt="Badge preview"
                  className="h-7"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: QR CODE */}
        {activeTab === "qr" && (
          <div className="flex flex-col items-center justify-center space-y-4 py-2">
            <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-md dark:border-slate-700">
              <img
                src={qrImageUrl}
                alt={`${username}'s profile QR Code`}
                className="h-44 w-44 rounded-lg object-contain"
              />
            </div>
            <p className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400 max-w-xs">
              Scan with a smartphone camera to instantly navigate to @{username}'s profile.
            </p>
          </div>
        )}

        {/* FOOTER */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-extrabold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
