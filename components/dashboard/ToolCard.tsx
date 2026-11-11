import type { FunctionReturnType } from "convex/server";
import { BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { api } from "@/convex/_generated/api";
import { CATEGORIES, CONDITIONS } from "@/convex/lib/constants";

export type ToolView = FunctionReturnType<typeof api.tools.list>[number];

export function ToolCard({ tool, actions }: { tool: ToolView; actions?: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-medium">{tool.name}</h3>
          <p className="text-sm text-muted-foreground">
            {CATEGORIES[tool.category]} · {CONDITIONS[tool.condition]}
          </p>
        </div>
        <Badge variant={tool.available ? "secondary" : "outline"}>
          {tool.available ? "Available" : "On loan"}
        </Badge>
      </div>
      {tool.description && <p className="text-sm break-words text-pretty">{tool.description}</p>}
      <div className="mt-auto flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
          <span className="truncate">{tool.isMine ? "You" : tool.owner.name}</span>
          {tool.owner.trusted && (
            <span className="flex shrink-0 items-center gap-1 text-emerald-700">
              <BadgeCheck className="size-4" aria-hidden />
              Trusted Lender
            </span>
          )}
        </p>
        {actions}
      </div>
    </li>
  );
}
