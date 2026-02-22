import { useState, useEffect, useRef } from "react";

/**
 * Smooth scroll progress hook.
 *
 * Instead of mapping raw window.scrollY directly to progress (which creates
 * discrete jumps on every wheel tick), this runs a persistent RAF loop that
 * smoothly interpolates the visual progress toward the raw scroll target.
 *
 * The result: the 3D world moves fluidly regardless of input granularity,
 * and transitions between scenes feel cinematic rather than jerky.
 */
export function useScrollProgress() {
  const [progress, setProgress] = useState(0);
  const targetRef = useRef(0);
  const currentRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Track raw scroll position as the target
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      targetRef.current = docHeight > 0 ? Math.min(Math.max(scrollTop / docHeight, 0), 1) : 0;
    };

    // Continuous animation loop: smooth interpolation toward target
    const animate = () => {
      const target = targetRef.current;
      const current = currentRef.current;
      const diff = target - current;

      if (Math.abs(diff) > 0.00005) {
        // Adaptive lerp: faster when far from target, slower when close
        // This gives snappy response to big scrolls + silky smooth micro-movements
        const speed = Math.abs(diff) > 0.02 ? 0.12 : 0.08;
        const next = current + diff * speed;
        currentRef.current = next;

        // Only trigger React re-render when visually meaningful
        if (Math.abs(next - currentRef.current) > 0.00001 || Math.abs(diff) > 0.0001) {
          setProgress(next);
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initialize
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return progress;
}
