import { useState, useEffect } from "react";

export function useSlowConnection(delayMs = 100) {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSlow(true);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [delayMs]);

  return isSlow;
}
