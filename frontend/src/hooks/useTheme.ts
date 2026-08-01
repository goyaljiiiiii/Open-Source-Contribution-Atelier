import { useContext } from "react";
import { ThemeContext, ThemeProvider } from "./ThemeContext";

export { ThemeProvider };

const THEME_KEY = "app-theme";
const THEME_KEY = 'theme-preference';

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check localStorage first
    const stored = localStorage.getItem(THEME_KEY) as 'light' | 'dark' | null;
    
    if (stored) {
      setTheme(stored);
      document.documentElement.className = stored;
    } else {
      // Check system preference
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const defaultTheme = systemPrefersDark ? 'dark' : 'light';
      setTheme(defaultTheme);
      document.documentElement.className = defaultTheme;
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
    document.documentElement.className = newTheme;
  };

  return { theme, toggleTheme, mounted };
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
