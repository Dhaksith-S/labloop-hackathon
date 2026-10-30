import Link from "next/link";
import { ArrowUpRight, Clock3, MapPin } from "lucide-react";
import type { ResourceWithRelations } from "@/lib/db-types";
import { CATEGORY_LABELS } from "@/lib/domain";
import { summarizeAvailability } from "@/lib/availability";
import { Badge } from "@/components/ui/badge";
import { ResourceArt } from "@/components/resources/resource-art";
import { cn } from "@/lib/utils";

export function ResourceCard({
  resource,
  index = 0,
  className,
}: {
  resource: ResourceWithRelations;
  index?: number;
  className?: string;
}) {
  const required = resource.requirements.filter((requirement) => requirement.is_required === 1);
  return (
    <Link
      href={`/resources/${resource.id}`}
      className={cn(
        "card-lift group flex flex-col overflow-hidden rounded-2xl border border-border bg-card",
        className,
      )}
    >
      <ResourceArt category={resource.category} index={index} compact />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="specimen-code">{CATEGORY_LABELS[resource.category]}</p>
            <h3 className="mt-1.5 text-[0.98rem] font-bold leading-snug tracking-[-0.015em]">
              {resource.name}
            </h3>
          </div>
          <ArrowUpRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
        </div>
        <p className="mt-2 line-clamp-2 text-[0.8rem] leading-relaxed text-muted-foreground">
          {resource.description}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.72rem] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3" /> {resource.location.split("·")[0].trim()}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock3 className="size-3" /> {summarizeAvailability(resource.availability)}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {resource.status === "paused" ? (
            <Badge tone="warning" dot>
              Paused
            </Badge>
          ) : (
            <Badge tone="success" dot>
              Available
            </Badge>
          )}
          {required.length > 0 ? (
            <Badge tone="outline">{required[0].label}</Badge>
          ) : (
            <Badge tone="outline">Open to members</Badge>
          )}
        </div>
      </div>
    </Link>
  );
}
