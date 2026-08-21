import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CompositionEvent,
} from "react";

interface DiscussionSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

export function DiscussionSearchInput({
  value,
  onChange,
  placeholder = "Search feed posts...",
  debounceMs = 300,
}: DiscussionSearchInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const isComposingRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const clearScheduledChange = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleChange = useCallback(
    (next: string) => {
      clearScheduledChange();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        onChange(next);
      }, debounceMs);
    },
    [clearScheduledChange, onChange, debounceMs],
  );

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setInputValue(next);
    if (
      isComposingRef.current ||
      (event.nativeEvent as InputEvent).isComposing
    ) {
      return;
    }
    scheduleChange(next);
  };

  const handleCompositionStart = () => {
    isComposingRef.current = true;
    clearScheduledChange();
  };

  const handleCompositionEnd = (event: CompositionEvent<HTMLInputElement>) => {
    isComposingRef.current = false;
    scheduleChange(event.currentTarget.value);
  };

  return (
    <input
      type="text"
      placeholder={placeholder}
      value={inputValue}
      onChange={handleChange}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      className="w-full pl-9 pr-3 py-1.5 text-xs font-bold bg-gray-50 dark:bg-slate-900 border-2 border-black dark:border-[#3a3a45] rounded-xl focus:outline-none focus:border-accent text-text dark:text-[#eef2f6]"
    />
  );
}
