import React, { useState, useRef, useEffect } from "react";
import { Globe, Check } from "lucide-react";
import { useTranslate } from "../../i18n/useTranslate";
import { FOCUS_RING } from "../../lib/a11yFocus";

export interface SupportedLocale {
  code: string;
  name: string;
  nativeName: string;
  dir?: "ltr" | "rtl";
}

export const SUPPORTED_LOCALES: SupportedLocale[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "zh-CN", name: "Chinese (Simplified)", nativeName: "简体中文" },
  { code: "pt-BR", name: "Portuguese (Brazil)", nativeName: "Português" },
  { code: "ar", name: "Arabic", nativeName: "العربية", dir: "rtl" },
];

interface LanguageSwitcherProps {
  iconSize?: number;
  className?: string;
  buttonClassName?: string;
}

export function LanguageSwitcher({
  iconSize = 16,
  className = "",
  buttonClassName = "p-2",
}: LanguageSwitcherProps) {
  const { locale, setLocale, isLoading } = useTranslate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLocale =
    SUPPORTED_LOCALES.find((l) => l.code === locale) ||
    SUPPORTED_LOCALES.find((l) => l.code === locale.split("-")[0]) ||
    SUPPORTED_LOCALES[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const handleSelectLocale = (code: string) => {
    setLocale(code);
    setIsOpen(false);
  };

  return (
    <div
      ref={dropdownRef}
      className={`relative inline-block text-left ${className}`}
      data-testid="language-switcher"
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={`Change language, current: ${currentLocale.nativeName}`}
        title={`Language: ${currentLocale.nativeName}`}
        className={`language-switcher-btn rounded-lg bg-surface-low text-muted hover:text-text border-2 border-black dark:border-[#2e2924] shadow-card-sm hover:-translate-y-0.5 active:translate-y-0 transition-all dark:bg-[#151411] dark:text-[#c4bbae] dark:hover:text-[#f0ebe2] flex items-center gap-1.5 font-bold text-xs ${FOCUS_RING} ${buttonClassName}`}
      >
        <Globe size={iconSize} aria-hidden="true" />
        <span className="uppercase text-[11px] font-mono tracking-wider">
          {currentLocale.code}
        </span>
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          aria-label="Select Language"
          className="absolute right-0 mt-2 w-48 rounded-xl border-2 border-black bg-white dark:bg-[#151411] dark:border-[#2e2924] shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-3 py-1.5 border-b border-black/10 dark:border-white/10 text-[10px] font-mono uppercase tracking-wider text-muted dark:text-[#9b8f80]">
            Select Language
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {SUPPORTED_LOCALES.map((lang) => {
              const isSelected =
                lang.code === locale ||
                (locale.startsWith(lang.code) && !locale.includes("-"));
              return (
                <button
                  key={lang.code}
                  role="menuitem"
                  onClick={() => handleSelectLocale(lang.code)}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                    isSelected
                      ? "bg-[#C3C0FF]/30 dark:bg-[#C3C0FF]/15 font-bold text-black dark:text-white"
                      : "text-slate-700 dark:text-[#c4bbae] hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                  disabled={isLoading}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{lang.nativeName}</span>
                    <span className="text-[10px] text-muted dark:text-[#9b8f80]">
                      {lang.name}
                    </span>
                  </div>
                  {isSelected && (
                    <Check size={14} className="text-primary shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default LanguageSwitcher;
