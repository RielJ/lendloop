import type { FunctionReturnType } from "convex/server";
import { Badge } from "@/components/ui/badge";
import type { api } from "@/convex/_generated/api";
import { isOverdue, todayUtc } from "@/convex/lib/rules";

export type LoanView = FunctionReturnType<typeof api.loans.mine>[number];

const STATUS_LABEL: Record<LoanView["status"], string> = {
  pending: "Pending",
  approved: "On loan",
  declined: "Declined",
  returned: "Returned",
};

export function LoanList({
  loans,
  empty,
  partyLabel,
  Actions,
}: {
  loans: LoanView[] | undefined;
  empty: string;
  partyLabel: string;
  /** Rendered beside each loan, e.g. owner buttons. */
  Actions?: React.ComponentType<{ loan: LoanView }>;
}) {
  if (loans === undefined) return <p className="text-muted-foreground">Loading…</p>;
  if (loans.length === 0) return <p className="text-muted-foreground">{empty}</p>;
  const today = todayUtc();

  return (
    <ul className="divide-y rounded-lg border">
      {loans.map((loan) => (
        <li key={loan._id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="truncate font-medium">{loan.toolName}</p>
            <p className="text-sm text-muted-foreground">
              {partyLabel} {loan.otherParty} · {loan.startDate} to {loan.endDate}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isOverdue(loan, today) ? (
              <Badge variant="destructive">Overdue</Badge>
            ) : (
              <Badge variant={loan.status === "pending" ? "secondary" : "outline"}>
                {STATUS_LABEL[loan.status]}
              </Badge>
            )}
            {Actions && <Actions loan={loan} />}
          </div>
        </li>
      ))}
    </ul>
  );
}
