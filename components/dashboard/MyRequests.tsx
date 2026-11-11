"use client";

import { useQuery } from "convex/react";
import { LoanList } from "@/components/dashboard/LoanList";
import { api } from "@/convex/_generated/api";

export function MyRequests() {
  const loans = useQuery(api.loans.mine);
  return (
    <LoanList
      loans={loans}
      partyLabel="From"
      empty="You haven't asked to borrow anything yet. Find a tool under All tools."
    />
  );
}
