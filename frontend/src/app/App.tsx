import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AppRouter } from "./router";
import { queryClient } from "../lib/queryClient";
import { ThemeProvider } from './context/ThemeContext';
import { ThemeToggle } from './components/ui/ThemeToggle';
import { CommandPalette } from "../components/CommandPalette";
import ReportIssueButton from "../components/ui/ReportIssueButton";
import { NotificationProvider } from "../features/notifications/NotificationContext";
import { ScrollToTop } from "../components/ui/ScrollToTop";

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <NotificationProvider>
            <div className="min-h-screen bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 transition-colors duration-300">
              <header className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-slate-700">
                <h1 className="text-2xl font-bold">Open Source Contribution Atelier</h1>
                <ThemeToggle />
              </header>
              {/* Global Toast Configuration */}
              <Toaster
                position="top-right"
                toastOptions={{
                  className:
                    "bg-gray-900 text-white border border-gray-800 shadow-xl font-sans text-sm",
                  duration: 4000,
                  success: {
                    iconTheme: { primary: "#10B981", secondary: "#ffffff" },
                  },
                  error: {
                    iconTheme: { primary: "#EF4444", secondary: "#ffffff" },
                  },
                }}
              />
              <AppRouter />
              <ScrollToTop />
              <CommandPalette />
              <ReportIssueButton />
            </div>
          </NotificationProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
