/**
 * AudioToggle: Mute/unmute button for organic audio engine.
 */

interface AudioToggleProps {
  isPlaying: boolean;
  onToggle: () => void;
  progress: number;
}

export default function AudioToggle({ isPlaying, onToggle, progress }: AudioToggleProps) {
  if (progress < 0.01) return null;

  return (
    <button
      onClick={onToggle}
      aria-label={isPlaying ? "Mute audio" : "Unmute audio"}
      style={{
        position: "fixed",
        bottom: "2rem",
        left: "2rem",
        zIndex: 25,
        width: "36px",
        height: "36px",
        borderRadius: "50%",
        border: "1px solid rgba(74, 124, 89, 0.3)",
        background: "rgba(10, 13, 8, 0.6)",
        backdropFilter: "blur(8px)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "border-color 0.3s ease",
        pointerEvents: "auto",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        {isPlaying ? (
          <>
            <rect x="2" y="3" width="3" height="8" rx="0.5" fill="rgba(74, 124, 89, 0.7)" />
            <path d="M7 4C8.5 5 8.5 9 7 10" stroke="rgba(74, 124, 89, 0.5)" strokeWidth="1" fill="none" />
            <path d="M9 2.5C11.5 4.5 11.5 9.5 9 11.5" stroke="rgba(74, 124, 89, 0.35)" strokeWidth="1" fill="none" />
          </>
        ) : (
          <>
            <rect x="2" y="3" width="3" height="8" rx="0.5" fill="rgba(74, 124, 89, 0.4)" />
            <line x1="6" y1="3" x2="12" y2="11" stroke="rgba(212, 145, 138, 0.6)" strokeWidth="1.5" strokeLinecap="round" />
          </>
        )}
      </svg>
    </button>
  );
}
