"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { RequestDialog } from "@/components/dashboard/RequestDialog";
import { ToolCard } from "@/components/dashboard/ToolCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import { CATEGORIES, type Category } from "@/convex/lib/constants";

const FILTER_ITEMS = { all: "All categories", ...CATEGORIES };
type Filter = keyof typeof FILTER_ITEMS;

const isFilter = (value: unknown): value is Filter =>
  typeof value === "string" && Object.hasOwn(FILTER_ITEMS, value);

export function AllTools() {
  const [filter, setFilter] = useState<Filter>("all");
  const category: Category | undefined = filter === "all" ? undefined : filter;
  const tools = useQuery(api.tools.list, { category });

  return (
    <div className="space-y-4">
      <Select
        items={FILTER_ITEMS}
        value={filter}
        onValueChange={(value) => isFilter(value) && setFilter(value)}
      >
        <SelectTrigger className="w-48" aria-label="Filter by category">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(FILTER_ITEMS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {tools === undefined ? (
        <p className="text-muted-foreground">Loading tools…</p>
      ) : tools.length === 0 ? (
        <p className="text-muted-foreground">No tools in this category yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <ToolCard
              key={tool._id}
              tool={tool}
              actions={!tool.isMine && tool.available ? <RequestDialog tool={tool} /> : undefined}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
