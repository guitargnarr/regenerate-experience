/**
 * TextOverlay: All narrative text for Regenerate
 *
 * 5-act structure with scroll-driven opacity and Y-translation.
 * Typography: Playfair Display (display), Inter (body), IBM Plex Mono (accent).
 */

import type { CSSProperties, ReactNode } from "react";

interface TextOverlayProps {
  progress: number;
  isMobile: boolean;
}

/* === Typography helpers === */

const textShadow = "0 1px 4px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)";

function serif(size: string, weight: number = 400): CSSProperties {
  return { fontFamily: '"Playfair Display", serif', fontSize: size, fontWeight: weight, lineHeight: 1.4, textShadow };
}

function sans(size: string, weight: number = 300): CSSProperties {
  return { fontFamily: '"Inter", sans-serif', fontSize: size, fontWeight: weight, lineHeight: 1.7, textShadow };
}

function mono(size: string): CSSProperties {
  return { fontFamily: '"IBM Plex Mono", monospace', fontSize: size, fontWeight: 300, lineHeight: 1.6, textShadow };
}

/* === TextSection: fades in/out based on progress === */

function TextSection({ children, enterAt, exitAt, progress, style, heroMode }: {
  children: ReactNode;
  enterAt: number;
  exitAt: number;
  progress: number;
  style?: CSSProperties;
  heroMode?: boolean;
}) {
  const fadeInDuration = 0.03;
  const fadeOutDuration = 0.03;

  let opacity = 0;
  let yOffset = 24;

  if (heroMode) {
    // Hero: fully visible at 0, fades out normally
    if (progress <= exitAt) {
      const fadeOutProgress = Math.min(1, (exitAt - progress) / fadeOutDuration);
      const easeOut = fadeOutProgress * fadeOutProgress;
      opacity = easeOut;
      yOffset = -16 * (1 - easeOut);
    }
  } else if (progress >= enterAt && progress <= exitAt) {
    const fadeInProgress = Math.min(1, (progress - enterAt) / fadeInDuration);
    const fadeOutProgress = Math.min(1, (exitAt - progress) / fadeOutDuration);

    // Quadratic ease
    const easeIn = fadeInProgress * fadeInProgress;
    const easeOut = fadeOutProgress * fadeOutProgress;

    opacity = Math.min(easeIn, easeOut);
    yOffset = 24 * (1 - easeIn) - 16 * (1 - easeOut);
  }

  if (opacity < 0.01) return null;

  return (
    <div style={{
      opacity,
      transform: `translateY(${yOffset}px)`,
      transition: "none",
      position: "relative",
      padding: "1.2rem 1.5rem",
      borderRadius: "8px",
      background: "rgba(10, 13, 8, 0.55)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      boxShadow: "0 0 40px 20px rgba(10, 13, 8, 0.4)",
      ...style,
    }}>
      {children}
    </div>
  );
}

/* === Scroll Guide === */

function ScrollGuide({ progress }: { progress: number }) {
  // Scene numeral based on progress
  let numeral = "";
  if (progress < 0.03) numeral = "";
  else if (progress < 0.20) numeral = "I";
  else if (progress < 0.37) numeral = "II";
  else if (progress < 0.54) numeral = "III";
  else if (progress < 0.71) numeral = "IV";
  else if (progress < 0.88) numeral = "V";
  else numeral = "";

  if (progress > 0.92) return null;

  const angle = progress * Math.PI * 2;
  const r = 16;

  return (
    <div style={{
      position: "fixed", bottom: "2rem", right: "2rem", zIndex: 25,
      display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem",
    }}>
      <svg width="36" height="36" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(74,124,89,0.15)" strokeWidth="1.5" />
        <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(74,124,89,0.5)" strokeWidth="1.5"
          strokeDasharray={`${angle * r} ${Math.PI * 2 * r}`}
          strokeLinecap="round"
          transform="rotate(-90 18 18)"
        />
      </svg>
      {numeral && (
        <div style={{ ...mono("0.65rem"), color: "rgba(74,124,89,0.5)", letterSpacing: "0.15em" }}>
          {numeral}
        </div>
      )}
      {progress < 0.08 && (
        <svg width="12" height="12" viewBox="0 0 12 12" style={{ animation: "scrollArrowPulse 2s ease-in-out infinite" }}>
          <path d="M2 4L6 8L10 4" stroke="rgba(74,124,89,0.4)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}

/* === Transition Line === */

function TransitionLine({ progress, at }: { progress: number; at: number }) {
  const dist = Math.abs(progress - at);
  if (dist > 0.03) return null;
  const opacity = 1 - dist / 0.03;

  return (
    <div style={{
      position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
      width: "60px", height: "1px",
      background: `rgba(74, 124, 89, ${opacity * 0.3})`,
    }} />
  );
}

/* === MAIN EXPORT === */

export default function TextOverlay({ progress, isMobile }: TextOverlayProps) {
  const px = isMobile ? "1.5rem" : "3rem";
  const maxW = isMobile ? "90vw" : "640px";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10, pointerEvents: "none",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ maxWidth: maxW, padding: `0 ${px}`, textAlign: "center" }}>

        {/* === TITLE (Hero -- visible immediately on page load) === */}
        <TextSection enterAt={0.0} exitAt={0.06} progress={progress} heroMode>
          <div style={{ ...serif(isMobile ? "clamp(1.8rem, 6vw, 3rem)" : "clamp(2rem, 4vw, 3.5rem)", 700), color: "#6ea87e", letterSpacing: "0.08em", textShadow: "0 0 40px rgba(74, 124, 89, 0.4)" }}>
            REGENERATE
          </div>
          <div style={{ ...mono(isMobile ? "0.7rem" : "0.8rem"), color: "#a3c9a8", marginTop: "1rem", letterSpacing: "0.2em" }}>
            The story of what was already happening
          </div>
        </TextSection>

        {/* === ACT I: THE SILENCE === */}
        <TextSection enterAt={0.05} exitAt={0.12} progress={progress}>
          <div style={{ ...mono(isMobile ? "0.6rem" : "0.7rem"), color: "#a3c9a8", letterSpacing: "0.3em", marginBottom: "1.5rem" }}>
            I. THE SILENCE
          </div>
          <div style={{ ...sans(isMobile ? "0.95rem" : "1.1rem"), color: "#e4dcc8" }}>
            Nothing visible. Nothing measurable. Just the dark and the waiting.
          </div>
        </TextSection>

        <TextSection enterAt={0.10} exitAt={0.18} progress={progress}>
          <div style={{ ...serif(isMobile ? "1.1rem" : "1.3rem", 400), color: "#a3c9a8", fontStyle: "italic" }}>
            A seed doesn't know it's a seed.
          </div>
          <div style={{ ...serif(isMobile ? "1.1rem" : "1.3rem", 400), color: "#a3c9a8", fontStyle: "italic", marginTop: "0.5rem" }}>
            It only knows the dark.
          </div>
        </TextSection>

        {/* === ACT II: THE PROLIFERATION === */}
        <TextSection enterAt={0.21} exitAt={0.27} progress={progress}>
          <div style={{ ...mono(isMobile ? "0.6rem" : "0.7rem"), color: "#a3c9a8", letterSpacing: "0.3em", marginBottom: "1.5rem" }}>
            II. THE PROLIFERATION
          </div>
          <div style={{ ...sans(isMobile ? "0.95rem" : "1.1rem"), color: "#e4dcc8" }}>
            Then everything at once. Projects born from frustration, from need, from the 3 AM conviction that this thing had to exist. Most of them won't survive.
          </div>
        </TextSection>

        <TextSection enterAt={0.27} exitAt={0.35} progress={progress}>
          <div style={{ ...serif(isMobile ? "1.1rem" : "1.3rem", 400), color: "#c9a84c", fontStyle: "italic" }}>
            Growth that looks like chaos is still growth.
          </div>
        </TextSection>

        {/* === ACT III: THE SEARCH === */}
        <TextSection enterAt={0.38} exitAt={0.44} progress={progress}>
          <div style={{ ...mono(isMobile ? "0.6rem" : "0.7rem"), color: "#a3c9a8", letterSpacing: "0.3em", marginBottom: "1.5rem" }}>
            III. THE SEARCH
          </div>
          <div style={{ ...sans(isMobile ? "0.95rem" : "1.1rem"), color: "#e4dcc8" }}>
            The identities multiply. Builder, designer, strategist, beginner. Each one tried on and discarded. None of them quite fit.
          </div>
        </TextSection>

        <TextSection enterAt={0.44} exitAt={0.52} progress={progress}>
          <div style={{ ...serif(isMobile ? "1.1rem" : "1.3rem", 400), color: "#a3c9a8", fontStyle: "italic" }}>
            The search isn't wasted.
          </div>
          <div style={{ ...serif(isMobile ? "1.1rem" : "1.3rem", 400), color: "#a3c9a8", fontStyle: "italic", marginTop: "0.5rem" }}>
            Every identity you try on teaches the one you'll keep.
          </div>
        </TextSection>

        {/* === ACT IV: THE CONVERGENCE === */}
        <TextSection enterAt={0.55} exitAt={0.61} progress={progress}>
          <div style={{ ...mono(isMobile ? "0.6rem" : "0.7rem"), color: "#a3c9a8", letterSpacing: "0.3em", marginBottom: "1.5rem" }}>
            IV. THE CONVERGENCE
          </div>
          <div style={{ ...sans(isMobile ? "0.95rem" : "1.1rem"), color: "#e4dcc8" }}>
            The scattered pieces start recognizing each other. The tool connects to the need. The skill meets the moment. Not because someone planned it.
          </div>
        </TextSection>

        <TextSection enterAt={0.61} exitAt={0.69} progress={progress}>
          <div style={{ ...serif(isMobile ? "1.1rem" : "1.3rem", 400), color: "#c9a84c", fontStyle: "italic" }}>
            The strands found each other. Not because someone directed them, but because they were always part of the same helix.
          </div>
        </TextSection>

        {/* === ACT V: THE SPARK === */}
        <TextSection enterAt={0.72} exitAt={0.78} progress={progress}>
          <div style={{ ...mono(isMobile ? "0.6rem" : "0.7rem"), color: "#a3c9a8", letterSpacing: "0.3em", marginBottom: "1.5rem" }}>
            V. THE SPARK
          </div>
          <div style={{ ...sans(isMobile ? "0.95rem" : "1.1rem"), color: "#e4dcc8" }}>
            And then the pattern reveals itself. What looked like disorder was a system finding its shape. What felt like wandering was navigation.
          </div>
        </TextSection>

        <TextSection enterAt={0.78} exitAt={0.86} progress={progress}>
          <div style={{ ...serif(isMobile ? "1.1rem" : "1.3rem", 400), color: "#e2cc7a", fontStyle: "italic" }}>
            The chaos was never chaos. It was a system teaching itself to exist.
          </div>
        </TextSection>

        {/* === OUTRO === */}
        <TextSection enterAt={0.88} exitAt={1.01} progress={progress}>
          <div style={{ ...sans(isMobile ? "0.95rem" : "1.05rem"), color: "#e4dcc8", lineHeight: 1.8, maxWidth: "540px", margin: "0 auto" }}>
            Regeneration doesn't announce itself. It happens in the silence between efforts, in the projects that fail, in the work done for reasons you can't yet name.
          </div>
          <div style={{ ...sans(isMobile ? "0.95rem" : "1.05rem"), color: "#e4dcc8", lineHeight: 1.8, maxWidth: "540px", margin: "1.5rem auto 0", }}>
            You don't decide to become something new. You just keep building, and one day what you've built is a different person.
          </div>
        </TextSection>

        {/* Transition lines */}
        <TransitionLine progress={progress} at={0.19} />
        <TransitionLine progress={progress} at={0.36} />
        <TransitionLine progress={progress} at={0.53} />
        <TransitionLine progress={progress} at={0.70} />
        <TransitionLine progress={progress} at={0.87} />
      </div>

      <ScrollGuide progress={progress} />
    </div>
  );
}
