import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";

export function Avatar({
  name,
  color,
  size = "md",
  className,
}: {
  name: string;
  color?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "size-7 text-[0.62rem]",
    md: "size-9 text-[0.7rem]",
    lg: "size-12 text-sm",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-black/5 font-bold text-white shadow-sm",
        sizes[size],
        className,
      )}
      style={{ backgroundColor: color ?? "#0b6b5f" }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ people }: { people: Array<{ name: string; color?: string }> }) {
  return (
    <div className="flex -space-x-2">
      {people.map((person) => (
        <Avatar
          key={person.name}
          name={person.name}
          color={person.color}
          size="sm"
          className="ring-2 ring-card"
        />
      ))}
    </div>
  );
}

export function Divider({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("h-px w-full bg-border", className)} role="separator" {...props} />;
}
