"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import type { ToolView } from "@/components/dashboard/ToolCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { CATEGORIES, CONDITIONS, type Category, type Condition } from "@/convex/lib/constants";
import { DESCRIPTION_MAX, NAME_MAX, validateToolInput } from "@/convex/lib/rules";
import { errorMessage } from "@/lib/errors";

const isCategory = (value: unknown): value is Category =>
  typeof value === "string" && Object.hasOwn(CATEGORIES, value);
const isCondition = (value: unknown): value is Condition =>
  typeof value === "string" && Object.hasOwn(CONDITIONS, value);

/** Create a listing, or edit one when `tool` is given. */
export function ToolFormDialog({
  tool,
  trigger,
}: {
  tool?: ToolView;
  trigger: React.ReactElement;
}) {
  const create = useMutation(api.tools.create);
  const update = useMutation(api.tools.update);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState(tool?.name ?? "");
  const [category, setCategory] = useState<Category>(tool?.category ?? "power_tools");
  const [condition, setCondition] = useState<Condition>(tool?.condition ?? "good");
  const [description, setDescription] = useState(tool?.description ?? "");

  async function onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = { name, category, condition, description };
    const invalid = validateToolInput(input);
    if (invalid) return void toast.error(invalid);
    setPending(true);
    try {
      if (tool) await update({ toolId: tool._id, ...input });
      else await create(input);
      toast.success(tool ? "Listing updated" : "Tool listed");
      setOpen(false);
      if (!tool) {
        setName("");
        setDescription("");
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{tool ? "Edit listing" : "List a tool"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="tool-name">Name</Label>
            <Input
              id="tool-name"
              value={name}
              maxLength={NAME_MAX}
              required
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select
                items={CATEGORIES}
                value={category}
                onValueChange={(v) => isCategory(v) && setCategory(v)}
              >
                <SelectTrigger className="w-full" aria-label="Category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORIES).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Condition</Label>
              <Select
                items={CONDITIONS}
                value={condition}
                onValueChange={(v) => isCondition(v) && setCondition(v)}
              >
                <SelectTrigger className="w-full" aria-label="Condition">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONDITIONS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tool-description">Description (optional)</Label>
            <Textarea
              id="tool-description"
              value={description}
              maxLength={DESCRIPTION_MAX}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {tool ? "Save" : "List tool"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
