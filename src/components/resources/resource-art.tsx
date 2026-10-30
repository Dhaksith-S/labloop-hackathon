import {
  CircuitBoard,
  Camera,
  Gauge,
  LayoutGrid,
  Printer,
  Scissors,
  Bot,
  type LucideIcon,
} from "lucide-react";
import type { ResourceCategory } from "@/lib/domain";
import { cn } from "@/lib/utils";

const iconMap: Record<ResourceCategory, LucideIcon> = {
  "3d-printing": Printer,
  electronics: CircuitBoard,
  imaging: Camera,
  robotics: Bot,
  workspace: LayoutGrid,
  testing: Gauge,
  fabrication: Scissors,
};

export const categoryTint: Record<ResourceCategory, string> = {
  "3d-printing": "from-[#dcefe6] to-[#f1f7f2] dark:from-[#143129] dark:to-[#0f1b17]",
  electronics: "from-[#e2eaf4] to-[#f3f6f8] dark:from-[#172a3b] dark:to-[#0f171e]",
  imaging: "from-[#f6e9cf] to-[#fbf6ec] dark:from-[#382b14] dark:to-[#1a150d]",
  robotics: "from-[#e9e2f5] to-[#f6f3fa] dark:from-[#2a203c] dark:to-[#17121f]",
  workspace: "from-[#eee8da] to-[#f8f5ed] dark:from-[#302b1f] dark:to-[#191610]",
  testing: "from-[#f4dfd8] to-[#faf1ed] dark:from-[#3b211b] dark:to-[#1d1310]",
  fabrication: "from-[#dfe8e4] to-[#f2f6f4] dark:from-[#1c2e28] dark:to-[#101b17]",
};

export function CategoryIcon({
  category,
  className,
}: {
  category: ResourceCategory;
  className?: string;
}) {
  const Icon = iconMap[category];
  return <Icon className={className} aria-hidden />;
}

export function CategoryGlyph({ category }: { category: ResourceCategory }) {
  return (
    <span className="flex size-10 items-center justify-center rounded-xl border border-border/80 bg-card/80 text-foreground backdrop-blur-sm">
      <CategoryIcon category={category} className="size-[18px]" />
    </span>
  );
}

export function ResourceArt({
  category,
  index = 0,
  className,
  compact = false,
}: {
  category: ResourceCategory;
  index?: number;
  className?: string;
  compact?: boolean;
}) {
  const codes: Record<ResourceCategory, string> = {
    "3d-printing": "ADD",
    electronics: "ELX",
    imaging: "IMG",
    robotics: "ROB",
    workspace: "WKS",
    testing: "TST",
    fabrication: "FAB",
  };
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-gradient-to-br",
        categoryTint[category],
        compact ? "h-28" : "h-40",
        className,
      )}
      aria-hidden
    >
      <div className="absolute inset-0 dot-paper opacity-70" />
      <div className="absolute -right-6 -top-7 size-28 rounded-full border border-foreground/10" />
      <div className="absolute -bottom-10 -left-8 size-32 rounded-full border border-foreground/10" />
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-3">
        <span className="specimen-code">NST-{codes[category]}-{String(index + 1).padStart(2, "0")}</span>
        <span className="specimen-code opacity-60">LabLoop</span>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex size-16 items-center justify-center rounded-2xl border border-foreground/10 bg-card/45 backdrop-blur-[2px]">
          <CategoryIcon category={category} className="size-8 text-foreground/75" />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between px-4 pb-3">
        <span className="specimen-code">Verified listing</span>
        <span className="h-1.5 w-10 rounded-full bg-foreground/15" />
      </div>
    </div>
  );
}
