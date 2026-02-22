import { useEffect, useRef, useCallback } from "react";

interface MobileScrollConfig {
  sensitivity?: number;
  friction?: number;
  momentumThreshold?: number;
  maxVelocity?: number;
}

export function useMobileScroll(config: MobileScrollConfig = {}) {
  const { sensitivity = 2.5, friction = 0.92, momentumThreshold = 0.3, maxVelocity = 8 } = config;

  const touchStartY = useRef(0);
  const touchLastY = useRef(0);
  const touchLastTime = useRef(0);
  const velocity = useRef(0);
  const momentumRaf = useRef<number | null>(null);
  const isTouching = useRef(false);
  const isMultiTouch = useRef(false);

  const cancelMomentum = useCallback(() => {
    if (momentumRaf.current !== null) {
      cancelAnimationFrame(momentumRaf.current);
      momentumRaf.current = null;
    }
  }, []);

  const startMomentum = useCallback(() => {
    const animate = () => {
      if (isTouching.current) return;
      velocity.current *= friction;
      if (Math.abs(velocity.current) < 0.1) { velocity.current = 0; return; }
      window.scrollBy(0, -velocity.current);
      momentumRaf.current = requestAnimationFrame(animate);
    };
    cancelMomentum();
    momentumRaf.current = requestAnimationFrame(animate);
  }, [friction, cancelMomentum]);

  useEffect(() => {
    const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) { isMultiTouch.current = true; return; }
      isMultiTouch.current = false;
      isTouching.current = true;
      cancelMomentum();
      const touch = e.touches[0];
      touchStartY.current = touch.clientY;
      touchLastY.current = touch.clientY;
      touchLastTime.current = performance.now();
      velocity.current = 0;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isMultiTouch.current || e.touches.length > 1) return;
      const touch = e.touches[0];
      const now = performance.now();
      const deltaY = touch.clientY - touchLastY.current;
      const deltaTime = now - touchLastTime.current;
      if (deltaTime > 0) {
        const instantVelocity = deltaY / deltaTime;
        velocity.current = velocity.current * 0.7 + instantVelocity * 0.3;
        velocity.current = Math.max(-maxVelocity, Math.min(maxVelocity, velocity.current));
      }
      window.scrollBy(0, -deltaY * sensitivity);
      touchLastY.current = touch.clientY;
      touchLastTime.current = now;
      const scrollTop = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollTop > 0 && scrollTop < maxScroll) { e.preventDefault(); }
      else if (scrollTop <= 0 && deltaY > 0) { return; }
      else if (scrollTop >= maxScroll && deltaY < 0) { return; }
      else { e.preventDefault(); }
    };

    const handleTouchEnd = () => {
      if (isMultiTouch.current) { isMultiTouch.current = false; return; }
      isTouching.current = false;
      const frameVelocity = velocity.current * 16;
      if (Math.abs(velocity.current) > momentumThreshold) {
        velocity.current = frameVelocity;
        startMomentum();
      }
    };

    const handleTouchCancel = () => { isTouching.current = false; isMultiTouch.current = false; cancelMomentum(); };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    document.addEventListener("touchcancel", handleTouchCancel, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchCancel);
      cancelMomentum();
    };
  }, [sensitivity, friction, momentumThreshold, maxVelocity, cancelMomentum, startMomentum]);
}
