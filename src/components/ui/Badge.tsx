interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "neutral";
  className?: string;
}

const variants = {
  default: "bg-primary/10 text-primary",
  success: "bg-green-100 text-green-800",
  neutral: "bg-neutral-100 text-neutral-600",
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
