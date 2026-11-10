interface Props {
  size?: number;
  className?: string;
}

/**
 * MeritBridge bridge-arc logo mark.
 * Scalable SVG — uses a white arch + deck + pillars on the brand burgundy tile.
 */
export default function MeritBridgeLogo({ size = 32, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="MeritBridge logo - From RNS Rural Polytechnic"
      role="img"
      className={className}
      focusable="false"
    >
      <rect width="32" height="32" rx="6" fill="#9e2040" />
      {/* Arch */}
      <path
        d="M6 22 Q16 8 26 22"
        stroke="white"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* Deck */}
      <line x1="4" y1="22" x2="28" y2="22" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      {/* Pillars */}
      <line x1="9"  y1="22" x2="9"  y2="27" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <line x1="23" y1="22" x2="23" y2="27" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
