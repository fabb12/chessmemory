import type { SVGProps } from 'react';

const PATHS = {
  home: 'M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10M10 19.5v-5h4v5',
  train: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.3l6-.7z',
  book: 'M5 4.5h10.5A2.5 2.5 0 0 1 18 7v12.5H7.5A2.5 2.5 0 0 1 5 17zM5 17a2.5 2.5 0 0 1 2.5-2.5H18M9 8.5h5',
  dna: 'M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9M8.5 6.5h7M8.5 17.5h7M9.5 12h5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  cross: 'M6 6l12 12M18 6L6 18',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.3 1 2.1h5c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 3z',
  eye: 'M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  brain: 'M9 4.5a3 3 0 0 0-3 3 3 3 0 0 0-1.5 5.3A3.2 3.2 0 0 0 9 17.8V4.5zM15 4.5a3 3 0 0 1 3 3 3 3 0 0 1 1.5 5.3 3.2 3.2 0 0 1-4.5 5V4.5zM9 9.5H7M15 9.5h2M9 14H7.5M15 14h1.5M12 4v16',
  chat: 'M4 5.5h16v10.5H10l-4.5 3.5V16H4z M8 9.5h8M8 12.5h5',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20 20',
  undo: 'M8 8H4V4M4.5 8a8 8 0 1 1-.5 6',
  play: 'M7 5l12 7-12 7z',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  flame: 'M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-1.8.7-3 1.7-4 .3 1.5 1.3 2.5 2.3 2.5C11 9 10.5 6 12 3z',
  calendar: 'M5 6.5h14V20H5zM5 10.5h14M8.5 4v4M15.5 4v4',
  wifiOff: 'M3 4l18 16M8.5 16.5a5 5 0 0 1 7 0M5.5 13.5a9 9 0 0 1 4-2.3M18.5 13.5a9 9 0 0 0-3-2M2.5 10.5a13 13 0 0 1 4-2.8M21.5 10.5a13 13 0 0 0-9-3.9M12 19.5h.01',
  download: 'M12 4v11M7.5 11l4.5 4.5 4.5-4.5M5 19.5h14',
  upload: 'M12 15.5v-11M7.5 9 12 4.5 16.5 9M5 19.5h14',
  trash: 'M5 7h14M10 7V4.5h4V7M7 7l1 12.5h8L17 7M10.5 10.5v6M13.5 10.5v6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 12h.01',
  camera: 'M4 8h3l1.5-2.5h7L17 8h3v11.5H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  flag: 'M5.5 21V4M5.5 4.5h11l-2 3.5 2 3.5h-11',
  cloud: 'M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.5A3.75 3.75 0 0 1 17.25 18.5z',
  logout: 'M14 4.5H5v15h9M10 12h10M16.5 8.5 20 12l-3.5 3.5',
  edit: 'M4.5 19.5h4l10-10-4-4-10 10zM13 7l4 4',
  sparkle: 'M12 4v4M12 16v4M4 12h4M16 12h4M6.5 6.5l2.5 2.5M15 15l2.5 2.5M17.5 6.5 15 9M9 15l-2.5 2.5',
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

/** Icone a tratto, decorative: il significato è sempre affidato anche al testo. */
export function Icon({ name, size = 20, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
