// Small inline icon set (stroke icons, 24x24 viewBox).
const paths: Record<string, string> = {
  dashboard: "M4 13h6V4H4zm10 7h6V11h-6zM4 20h6v-4H4zm10-11h6V4h-6z",
  chat: "M4 5h16v11H8l-4 4z",
  memory: "M12 3a6 6 0 0 0-6 6c0 2.2 1.2 3.6 2 4.5V17h8v-3.5c.8-.9 2-2.3 2-4.5a6 6 0 0 0-6-6zM9 21h6",
  learning: "M3 7l9-4 9 4-9 4zm4 2v5c0 1.5 2.2 3 5 3s5-1.5 5-3V9",
  research: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm5 12l5 5",
  knowledge: "M5 4h10l4 4v12H5zM15 4v4h4M8 12h8M8 16h6",
  evaluation: "M4 20V10m6 10V4m6 16v-7m4 7H2",
  autonomy: "M12 2v4m0 12v4M4.9 4.9l2.8 2.8m8.6 8.6 2.8 2.8M2 12h4m12 0h4M4.9 19.1l2.8-2.8m8.6-8.6 2.8-2.8M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm8 3-2-1 .5-2.2-1.6-1.6L14.7 7.7 13.6 5h-3.2l-1.1 2.7-2.2-.5-1.6 1.6.5 2.2L4 12l2 1-.5 2.2 1.6 1.6 2.2-.5 1.1 2.7h3.2l1.1-2.7 2.2.5 1.6-1.6L18 13z",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "M6 6l12 12M18 6 6 18",
  send: "M4 12l16-8-6 16-2-6z",
  plus: "M12 5v14M5 12h14",
  trash: "M5 7h14M10 7V4h4v3m-7 0 1 13h8l1-13",
  edit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  check: "M5 12l4 4 10-10",
  upload: "M12 16V4m0 0-4 4m4-4 4 4M4 20h16",
  refresh: "M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4",
  thumbUp: "M7 11v9H4v-9zm0 0 4-7c1.5 0 2 1 2 2v3h5a2 2 0 0 1 2 2l-1.5 7a2 2 0 0 1-2 2H7",
  thumbDown: "M7 13V4H4v9zm0 0 4 7c1.5 0 2-1 2-2v-3h5a2 2 0 0 0 2-2l-1.5-7a2 2 0 0 0-2-2H7",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  shield: "M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z",
  download: "M12 4v12m0 0-4-4m4 4 4-4M4 20h16",
};

export function Icon({ name, className = "h-5 w-5" }: { name: keyof typeof paths | string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round"
      strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={paths[name] || ""} />
    </svg>
  );
}
