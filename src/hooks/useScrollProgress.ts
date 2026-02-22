import { useState, useEffect, useRef, useCallback } from "react";

export function useScrollProgress() {
  const [progress, setProgress] = useState(0);
  const rafId = useRef<number | null>(null);
  const lastProgress = useRef(0);

  const updateProgress = useCallback(() => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const raw = docHeight > 0 ? scrollTop / docHeight : 0;
    const clamped = Math.min(Math.max(raw, 0), 1);

    if (Math.abs(clamped - lastProgress.current) > 0.0001) {
      lastProgress.current = clamped;
      setProgress(clamped);
    }

    rafId.current = null;
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(updateProgress);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    updateProgress();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [updateProgress]);

  return progress;
}
