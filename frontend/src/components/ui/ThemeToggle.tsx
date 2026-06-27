import { Sun, Moon, Monitor, Eye } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { motion } from "framer-motion";

interface ThemeToggleProps {
  iconSize?: number;
  className?: string;
  buttonClassName?: string;
}

export function ThemeToggle({
  iconSize = 16,
  className = "",
  buttonClassName = "",
}: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  const options = [
    { id: "light", icon: Sun, label: "Light Mode" },
    { id: "dark", icon: Moon, label: "Dark Mode" },
    { id: "system", icon: Monitor, label: "System Preference" },
  ];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Animated Segmented Control for Core Themes */}
      <div className="relative flex items-center p-1 bg-surface-low dark:bg-[#151411] rounded-full border-2 border-black dark:border-[#2e2924] shadow-card-sm overflow-hidden">
        {options.map((opt) => {
          const isActive = theme === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setTheme(opt.id as "light" | "dark" | "system")}
              className={`relative z-10 flex items-center justify-center w-9 h-9 rounded-full transition-colors duration-200 ${
                isActive
                  ? "text-white dark:text-black"
                  : "text-muted hover:text-text dark:text-[#c4bbae] dark:hover:text-[#f0ebe2]"
              }`}
              title={opt.label}
              aria-label={opt.label}
            >
              {isActive && (
                <motion.div
                  layoutId="activeThemePill"
                  className="absolute inset-0 bg-black dark:bg-[#f0ebe2] rounded-full"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <opt.icon
                size={iconSize}
                className="relative z-20 transition-transform duration-300 hover:scale-110 active:scale-95"
              />
            </button>
          );
        })}
      </div>

      {/* High Contrast Toggle */}
      <button
        className={`relative flex items-center justify-center w-11 h-11 rounded-full border-2 border-black dark:border-[#2e2924] shadow-card-sm transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 ${
          theme === "high-contrast"
            ? "bg-primary text-white border-primary shadow-[0_0_15px_rgba(var(--color-primary),0.5)]"
            : "bg-surface-low text-muted hover:text-text dark:bg-[#151411] dark:text-[#c4bbae] dark:hover:text-[#f0ebe2]"
        } ${buttonClassName}`}
        onClick={() =>
          setTheme(theme === "high-contrast" ? "system" : "high-contrast")
        }
        aria-label="Toggle High Contrast Mode"
        title="High Contrast Mode"
      >
        <Eye
          size={iconSize + 2}
          className={`transition-transform duration-300 ${
            theme === "high-contrast" ? "scale-110" : "scale-100"
          }`}
        />
        {theme === "high-contrast" && (
          <motion.div
            className="absolute inset-0 rounded-full bg-white opacity-20"
            layoutId="highContrastPulse"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </button>
    </div>
  );
}
