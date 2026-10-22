// src/components/Icons.jsx
// Custom geometric SVG marks. Line-based, 24×24 viewBox.

const Base = ({ children, size = 18, stroke = 1.5, className = "", style = {} }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const LogoMark = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.4" opacity="0.5" />
    <path
      d="M3.5 12 H7 l1.5 -3 l2 6 l2 -4 l1.5 1 H20.5"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

export const IconDashboard = (p) => (
  <Base {...p}>
    <rect x="3.5" y="3.5" width="7" height="9" rx="1" />
    <rect x="13.5" y="3.5" width="7" height="5" rx="1" />
    <rect x="3.5" y="15.5" width="7" height="5" rx="1" />
    <rect x="13.5" y="11.5" width="7" height="9" rx="1" />
  </Base>
);
export const IconPulse = (p) => (
  <Base {...p}>
    <path d="M3 12 H7 l2 -5 l3 10 l2 -7 l2 2 H21" />
  </Base>
);
export const IconCamera = (p) => (
  <Base {...p}>
    <rect x="3" y="6" width="14" height="12" rx="2" />
    <path d="M17 10 L21 7.5 V16.5 L17 14 Z" />
  </Base>
);
export const IconPill = (p) => (
  <Base {...p}>
    <rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-30 12 12)" />
    <path d="M8.5 6.8 L15.5 17.2" />
  </Base>
);
export const IconAlert = (p) => (
  <Base {...p}>
    <path d="M12 3 L21 19 H3 Z" />
    <path d="M12 10 V14" />
    <circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none" />
  </Base>
);
export const IconSettings = (p) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2 V5 M12 19 V22 M2 12 H5 M19 12 H22 M4.9 4.9 L7 7 M17 17 L19.1 19.1 M4.9 19.1 L7 17 M17 7 L19.1 4.9" />
  </Base>
);
export const IconUser = (p) => (
  <Base {...p}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M4.5 20 C5.5 15.5 9 14 12 14 C15 14 18.5 15.5 19.5 20" />
  </Base>
);
export const IconSend = (p) => (
  <Base {...p}>
    <path d="M3 12 L21 4 L15 21 L11.5 13 Z" />
  </Base>
);
export const IconPlay = (p) => (
  <Base {...p}>
    <path d="M7 4.5 L19 12 L7 19.5 Z" fill="currentColor" />
  </Base>
);
export const IconStop = (p) => (
  <Base {...p}>
    <rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" />
  </Base>
);
export const IconEdit = (p) => (
  <Base {...p}>
    <path d="M4 20 L4 16 L16 4 L20 8 L8 20 Z" />
    <path d="M13 7 L17 11" />
  </Base>
);
export const IconClose = (p) => (
  <Base {...p}>
    <path d="M5 5 L19 19 M19 5 L5 19" />
  </Base>
);
export const IconCheck = (p) => (
  <Base {...p}>
    <path d="M4 12 L10 18 L20 6" />
  </Base>
);
export const IconMail = (p) => (
  <Base {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3.5 7 L12 13 L20.5 7" />
  </Base>
);
export const IconReset = (p) => (
  <Base {...p}>
    <path d="M4 12 A8 8 0 1 0 6.5 6.5" />
    <path d="M3 4 V8 H7" />
  </Base>
);
export const IconHeart = (p) => (
  <Base {...p}>
    <path d="M12 20 C5 14.5 3 11 3 8 C3 5.5 5 4 7 4 C9 4 11 5.5 12 7.5 C13 5.5 15 4 17 4 C19 4 21 5.5 21 8 C21 11 19 14.5 12 20 Z" />
  </Base>
);
export const IconLung = (p) => (
  <Base {...p}>
    <path d="M12 4 V14" />
    <path d="M9 7 L9 11 C9 14.5 7 18 4.5 18 C3.5 18 3 17 3 16 V12 C3 9 5 7 9 7 Z" />
    <path d="M15 7 L15 11 C15 14.5 17 18 19.5 18 C20.5 18 21 17 21 16 V12 C21 9 19 7 15 7 Z" />
  </Base>
);
export const IconBrain = (p) => (
  <Base {...p}>
    <path d="M12 5 C10 3 6 4 6 8 C4 9 4 13 6 14 C6 18 10 19 12 17 Z" />
    <path d="M12 5 C14 3 18 4 18 8 C20 9 20 13 18 14 C18 18 14 19 12 17" />
    <path d="M12 5 V17" />
  </Base>
);
export const IconFlame = (p) => (
  <Base {...p}>
    <path d="M12 3 C12 7 16 8 16 13 C16 17 14 20 12 20 C10 20 8 17 8 13 C8 11 9 10 10 9 C10 11 11 12 12 12 C12 9 12 6 12 3 Z" />
  </Base>
);
export const IconSparkle = (p) => (
  <Base {...p}>
    <path d="M12 3 L13.5 10.5 L21 12 L13.5 13.5 L12 21 L10.5 13.5 L3 12 L10.5 10.5 Z" />
  </Base>
);
export const IconShield = (p) => (
  <Base {...p}>
    <path d="M12 3 L20 6 V12 C20 16.5 16.5 19.5 12 21 C7.5 19.5 4 16.5 4 12 V6 Z" />
    <path d="M9 12 L11 14 L15 10" />
  </Base>
);
export const IconSun = (p) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5 V5 M12 19 V21.5 M2.5 12 H5 M19 12 H21.5 M5.3 5.3 L7 7 M17 17 L18.7 18.7 M18.7 5.3 L17 7 M7 17 L5.3 18.7" />
  </Base>
);
export const IconMoon = (p) => (
  <Base {...p}>
    <path d="M20 14.5 A8.5 8.5 0 1 1 9.5 4 A7 7 0 0 0 20 14.5 Z" />
  </Base>
);
