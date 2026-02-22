/**
 * Home: Regenera -- A scroll-driven cinematic experience
 *
 * 5 Scenes: The Silence -> The Proliferation -> The Search -> The Convergence -> The Spark
 * Scroll spacer: 1000vh
 * Organic audio: Procedural Web Audio API synthesis evolving per scene
 */

import { Suspense, useEffect, useRef } from "react";
import { useScrollProgress } from "@/hooks/useScrollProgress";
import { useMobileDetect } from "@/hooks/useMobileDetect";
import { useSceneAudio } from "@/hooks/useSceneAudio";
import { useMobileScroll } from "@/hooks/useMobileScroll";
import { preloadTextures } from "@/hooks/useTexture";
import Experience3D from "@/components/Experience3D";
import TextOverlay from "@/components/TextOverlay";
import AudioToggle from "@/components/AudioToggle";

function LoadingScreen() {
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0a0d08", zIndex: 50 }}>
      <div style={{ fontFamily: '"Playfair Display", serif', fontSize: "1.5rem", fontWeight: 400, letterSpacing: "0.1em", color: "rgba(74, 124, 89, 0.6)", animation: "pulse 2s ease-in-out infinite" }}>
        Loading
      </div>
    </div>
  );
}

export default function Home() {
  const progress = useScrollProgress();
  const device = useMobileDetect();
  const { isPlaying, toggleAudio } = useSceneAudio(progress);

  useMobileScroll({
    sensitivity: device.isMobile ? 4.5 : 2.5,
    friction: device.isIOS ? 0.92 : 0.90,
    momentumThreshold: 0.2,
    maxVelocity: device.isMobile ? 10 : 8,
  });

  // Progressive texture preloading tied to scroll position
  const preloaded = useRef(new Set<number>());
  useEffect(() => {
    // Immediate: hero + Scene I
    if (!preloaded.current.has(0)) {
      preloaded.current.add(0);
      preloadTextures(["/textures/hero-forest.jpg", "/textures/soil-macro.jpg"]);
    }
    // Scene II textures
    if (progress > 0.10 && !preloaded.current.has(1)) {
      preloaded.current.add(1);
      preloadTextures(["/textures/leaf-macro.jpg", "/textures/moss-bark.jpg", "/textures/fern-alpha.jpg", "/textures/foliage-bg.jpg"]);
    }
    // Scene III textures
    if (progress > 0.28 && !preloaded.current.has(2)) {
      preloaded.current.add(2);
      preloadTextures(["/textures/ice-fracture.jpg"]);
    }
    // Scene IV textures
    if (progress > 0.45 && !preloaded.current.has(3)) {
      preloaded.current.add(3);
      preloadTextures(["/textures/neural-fiber.jpg"]);
    }
    // Scene V textures
    if (progress > 0.62 && !preloaded.current.has(4)) {
      preloaded.current.add(4);
      preloadTextures(["/textures/spark-particle.jpg", "/textures/sunbeams.jpg"]);
    }
  }, [progress]);

  return (
    <div style={{ position: "relative", overscrollBehavior: "none", WebkitOverflowScrolling: "touch" }}>
      {/* Scroll spacer */}
      <div style={{ height: "1000vh", position: "relative" }} aria-hidden="true" />

      {/* 3D Experience */}
      <Suspense fallback={<LoadingScreen />}>
        <Experience3D progress={progress} isMobile={device.isMobile || device.isTablet} />
      </Suspense>

      {/* Text Overlay */}
      <TextOverlay progress={progress} isMobile={device.isMobile} />

      {/* Audio toggle */}
      <AudioToggle isPlaying={isPlaying} onToggle={toggleAudio} progress={progress} />

      {/* Vignette */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 5, background: "radial-gradient(ellipse at center, transparent 40%, rgba(10, 13, 8, 0.65) 100%)" }} />

      {/* Grain -- desktop only */}
      {!device.isMobile && (
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 6, opacity: 0.025, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`, backgroundRepeat: "repeat", backgroundSize: "256px 256px" }} />
      )}
    </div>
  );
}
