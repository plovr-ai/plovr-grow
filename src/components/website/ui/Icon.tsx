type IconName =
  | "check"
  | "arrow-right"
  | "phone"
  | "star"
  | "close"
  | "menu"
  | "plus"
  | "minus";

interface IconProps {
  name: IconName;
  className?: string;
}

const paths: Record<IconName, string> = {
  check: "M5 13l4 4L19 7",
  "arrow-right": "M5 12h14M13 5l7 7-7 7",
  phone:
    "M3 5a2 2 0 012-2h2l2 5-2 1a11 11 0 005 5l1-2 5 2v2a2 2 0 01-2 2A16 16 0 013 5z",
  star: "M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z",
  close: "M6 6l12 12M18 6L6 18",
  menu: "M4 6h16M4 12h16M4 18h16",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
};

export function Icon({ name, className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
