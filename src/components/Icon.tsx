import type { CSSProperties } from "react";
const paths: Record<string, string> = {
  menu: "M4 6h16M4 12h16M4 18h16",
  play: "m9 5 11 7-11 7z",
  pause: "M8 5v14M16 5v14",
  stop: "M6 6h12v12H6z",
  next: "m7 5 9 7-9 7zM18 5v14",
  prev: "m17 5-9 7 9 7zM6 5v14",
  restart: "M4 10a8 8 0 1 1 1 8M4 4v6h6",
  plus: "M12 5v14M5 12h14",
  search: "M20 20l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  loop: "M4 8h14l-3-3M20 16H6l3 3M20 8v5M4 16v-5",
  code: "m8 6-6 6 6 6m8-12 6 6-6 6M14 4l-4 16",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  upload: "M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5",
  music:
    "M9 18V5l11-2v13M9 9l11-2M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3M20 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3",
  chevron: "m6 9 6 6 6-6",
  trash: "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7",
  copy: "M9 9h11v12H9zM15 9V3H3v12h6",
  check: "m5 12 4 4L19 6",
  close: "m6 6 12 12M18 6 6 18",
  settings: "M4 7h16M4 17h16M8 4v6M16 14v6",
};
export function Icon({
  name,
  size = 18,
  style,
}: {
  name: string;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name] ?? paths.music} />
    </svg>
  );
}
