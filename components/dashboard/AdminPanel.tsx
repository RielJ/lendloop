"use client";

import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ToolCard, type ToolView } from "@/components/dashboard/ToolCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { isOverdue, todayUtc } from "@/convex/lib/rules";
import { errorMessage } from "@/lib/errors";

/** Rendered only for admins; every query and mutation here re-checks the role on the server. */
export function AdminPanel() {
  return (
    <div className="space-y-10">
      <Users />
      <Loans />
      <Listings />
    </div>
  );
}

function Users() {
  const users = useQuery(api.users.list);
  const setTrusted = useMutation(api.users.setTrusted);

  async function toggle(userId: Id<"users">, trusted: boolean) {
    try {
      await setTrusted({ userId, trusted });
      toast.success(trusted ? "Marked as Trusted Lender" : "Trusted Lender removed");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="font-medium">Neighbors</h2>
      {users === undefined ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Trusted Lender</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user._id}>
                <TableCell className="max-w-40 truncate">{user.name}</TableCell>
                <TableCell className="max-w-56 truncate">{user.email}</TableCell>
                <TableCell>{user.role === "admin" ? "Admin" : "Neighbor"}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant={user.trusted ? "secondary" : "outline"}
                    aria-pressed={user.trusted}
                    onClick={() => toggle(user._id, !user.trusted)}
                  >
                    {user.trusted ? "Trusted" : "Mark trusted"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

function Loans() {
  const loans = useQuery(api.loans.all);
  const today = todayUtc();
  return (
    <section className="space-y-3">
      <h2 className="font-medium">All loans</h2>
      {loans === undefined ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : loans.length === 0 ? (
        <p className="text-muted-foreground">No loans yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tool</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Borrower</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loans.map((loan) => (
              <TableRow key={loan._id}>
                <TableCell className="max-w-40 truncate">{loan.toolName}</TableCell>
                <TableCell className="max-w-32 truncate">{loan.owner}</TableCell>
                <TableCell className="max-w-32 truncate">{loan.borrower}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {loan.startDate} to {loan.endDate}
                </TableCell>
                <TableCell>
                  {isOverdue(loan, today) ? (
                    <Badge variant="destructive">Overdue</Badge>
                  ) : (
                    <Badge variant="outline" className="capitalize">
                      {loan.status}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

function Listings() {
  const tools = useQuery(api.tools.list, {});
  return (
    <section className="space-y-3">
      <h2 className="font-medium">All listings</h2>
      {tools === undefined ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : tools.length === 0 ? (
        <p className="text-muted-foreground">No listings yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <ToolCard key={tool._id} tool={tool} actions={<AdminRemove tool={tool} />} />
          ))}
        </ul>
      )}
    </section>
  );
}

function AdminRemove({ tool }: { tool: ToolView }) {
  const remove = useMutation(api.tools.remove);

  async function onRemove() {
    const warning = tool.available ? "" : " It is on loan; the loan stays in history.";
    if (!window.confirm(`Remove "${tool.name}" from LendLoop?${warning}`)) return;
    try {
      await remove({ toolId: tool._id });
      toast.success("Listing removed");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <Button size="sm" variant="ghost" className="text-destructive" onClick={onRemove}>
      Remove
    </Button>
  );
}
