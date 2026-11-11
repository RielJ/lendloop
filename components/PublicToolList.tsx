"use client";

import { useQuery } from "convex/react";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import { CATEGORIES } from "@/convex/lib/constants";

export function PublicToolList() {
  const tools = useQuery(api.tools.listPublic);

  if (tools === undefined) {
    return (
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
        ))}
      </ul>
    );
  }

  if (tools.length === 0) {
    return <p className="text-muted-foreground">No tools listed yet. Be the first to lend one.</p>;
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((tool) => (
        <li
          key={tool._id}
          className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3"
        >
          <span className="truncate font-medium">{tool.name}</span>
          <Badge variant="secondary">{CATEGORIES[tool.category]}</Badge>
        </li>
      ))}
    </ul>
  );
}
