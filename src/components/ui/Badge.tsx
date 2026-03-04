interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "neutral";
  className?: string;
}

const variants = {
  default: "bg-accent/10 text-accent",
  success: "bg-green-100 text-green-800",
  neutral: "bg-surface text-muted",
};

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
