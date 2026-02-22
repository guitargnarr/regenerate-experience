import { useState, useEffect } from "react";

interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isTouch: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
}

export function useMobileDetect(): DeviceInfo {
  const [device, setDevice] = useState<DeviceInfo>(() => getDeviceInfo());

  useEffect(() => {
    const handleResize = () => setDevice(getDeviceInfo());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return device;
}

function getDeviceInfo(): DeviceInfo {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
  const width = typeof window !== "undefined" ? window.innerWidth : 1024;
  const height = typeof window !== "undefined" ? window.innerHeight : 768;
  const pixelRatio = typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1;

  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && isTouch);
  const isAndroid = /Android/.test(ua);
  const isMobile = (isTouch && width < 768) || /Mobi|Android/i.test(ua);
  const isTablet = isTouch && width >= 768 && width < 1024;

  return { isMobile, isTablet, isTouch, isIOS, isAndroid, screenWidth: width, screenHeight: height, pixelRatio };
}
