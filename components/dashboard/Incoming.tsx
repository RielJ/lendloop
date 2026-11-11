"use client";

import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { LoanList, type LoanView } from "@/components/dashboard/LoanList";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { errorMessage } from "@/lib/errors";

export function Incoming() {
  const loans = useQuery(api.loans.incoming);
  return (
    <LoanList
      loans={loans}
      partyLabel="By"
      empty="No requests for your tools yet."
      Actions={OwnerLoanActions}
    />
  );
}

function OwnerLoanActions({ loan }: { loan: LoanView }) {
  const approve = useMutation(api.loans.approve);
  const decline = useMutation(api.loans.decline);
  const markReturned = useMutation(api.loans.markReturned);

  async function run(action: () => Promise<null>, done: string) {
    try {
      await action();
      toast.success(done);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  if (loan.status === "pending") {
    return (
      <>
        <Button size="sm" onClick={() => run(() => approve({ loanId: loan._id }), "Approved")}>
          Approve
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => run(() => decline({ loanId: loan._id }), "Declined")}
        >
          Decline
        </Button>
      </>
    );
  }
  if (loan.status === "approved") {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => run(() => markReturned({ loanId: loan._id }), "Marked returned")}
      >
        Mark returned
      </Button>
    );
  }
  return null;
}
