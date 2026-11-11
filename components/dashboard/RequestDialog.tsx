"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import type { ToolView } from "@/components/dashboard/ToolCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import { todayUtc, validateLoanDates } from "@/convex/lib/rules";
import { errorMessage } from "@/lib/errors";

export function RequestDialog({ tool }: { tool: ToolView }) {
  const request = useMutation(api.loans.request);
  const today = todayUtc();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  async function onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid = validateLoanDates(startDate, endDate, todayUtc());
    if (invalid) return void toast.error(invalid);
    setPending(true);
    try {
      await request({ toolId: tool._id, startDate, endDate });
      toast.success(`Request sent to ${tool.owner.name}`);
      setOpen(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Request</Button>} />
      <DialogContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Borrow {tool.name}</DialogTitle>
            <DialogDescription>
              {tool.owner.name} will approve or decline. Loans last up to 30 days.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="loan-start">From</Label>
              <Input
                id="loan-start"
                type="date"
                min={today}
                value={startDate}
                required
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="loan-end">Until</Label>
              <Input
                id="loan-end"
                type="date"
                min={startDate}
                value={endDate}
                required
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Send request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
