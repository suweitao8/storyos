// StoryOS 品牌 logo：渐变圆角方块底 + 风格化白色 "S"。
// 内联 SVG 组件，渐变 id 加 storyos- 前缀防全局冲突。
export function InkosLogo({ className }: { readonly className?: string }) {
  return (
    <svg viewBox="0 0 512 512" fill="none" className={className} role="img" aria-label="StoryOS">
      <defs>
        <linearGradient id="storyos-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
        <linearGradient id="storyos-s" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#fef3c7" />
        </linearGradient>
        <filter id="storyos-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#000000" floodOpacity="0.15" />
        </filter>
      </defs>

      {/* Gradient rounded-square background */}
      <rect x="32" y="32" width="448" height="448" rx="112" fill="url(#storyos-bg)" filter="url(#storyos-shadow)" />

      {/* Stylized "S" — two opposing arcs forming an S-curve */}
      <path
        d="M340 175 C340 140, 305 120, 260 120 C205 120, 165 155, 165 200 C165 240, 200 260, 250 270 C300 280, 340 295, 340 335 C340 375, 300 405, 245 405 C195 405, 160 380, 160 345"
        stroke="url(#storyos-s)"
        strokeWidth="42"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
