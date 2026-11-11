"use client";

import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ToolCard, type ToolView } from "@/components/dashboard/ToolCard";
import { ToolFormDialog } from "@/components/dashboard/ToolFormDialog";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { errorMessage } from "@/lib/errors";

export function MyListings() {
  const tools = useQuery(api.tools.mine);

  return (
    <div className="space-y-4">
      <ToolFormDialog trigger={<Button>List a tool</Button>} />
      {tools === undefined ? (
        <p className="text-muted-foreground">Loading your listings…</p>
      ) : tools.length === 0 ? (
        <p className="text-muted-foreground">You haven&apos;t listed anything yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <ToolCard key={tool._id} tool={tool} actions={<OwnerActions tool={tool} />} />
          ))}
        </ul>
      )}
    </div>
  );
}

function OwnerActions({ tool }: { tool: ToolView }) {
  const remove = useMutation(api.tools.remove);

  async function onRemove() {
    if (!window.confirm(`Remove "${tool.name}"? Pending requests for it will be declined.`)) return;
    try {
      await remove({ toolId: tool._id });
      toast.success("Listing removed");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="flex shrink-0 gap-1">
      <ToolFormDialog
        tool={tool}
        trigger={
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        }
      />
      <Button
        variant="ghost"
        size="sm"
        disabled={!tool.available}
        title={tool.available ? undefined : "Mark it returned before removing it"}
        onClick={onRemove}
      >
        Remove
      </Button>
    </div>
  );
}
