import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // ✅ Fix: sync initial visibility

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Hide on auth pages
  if (location.pathname === "/login" || location.pathname === "/signup") {
    return null;
  }

  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      onClick={handleClick}
      aria-label="Scroll to top"
      className={`fixed bottom-6 right-6 z-40 p-3 rounded-full transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      } border-2 border-black bg-white text-black shadow-md hover:scale-105`}
    >
      ↑
    </button>
  );
}