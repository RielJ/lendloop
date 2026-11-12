"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { AdminPanel } from "@/components/dashboard/AdminPanel";
import { AllTools } from "@/components/dashboard/AllTools";
import { Incoming } from "@/components/dashboard/Incoming";
import { MyListings } from "@/components/dashboard/MyListings";
import { MyRequests } from "@/components/dashboard/MyRequests";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";

export function Dashboard() {
  const me = useQuery(api.users.me);
  const { isLoading, isAuthenticated } = useConvexAuth();

  // Clerk signed the user in, but Convex rejected or never got the token.
  if (!isLoading && !isAuthenticated) {
    return (
      <p className="text-muted-foreground">
        You&apos;re signed in, but LendLoop couldn&apos;t verify your session. Check that the Convex
        integration is active in Clerk and that CLERK_JWT_ISSUER_DOMAIN matches your Clerk app (see
        README.md, Run it locally).
      </p>
    );
  }

  // EnsureUser creates the row right after sign-in; until then `me` is null.
  if (!me) return <p className="text-muted-foreground">Loading your account…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Hi, {me.name}</h1>
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All tools</TabsTrigger>
          <TabsTrigger value="mine">My listings</TabsTrigger>
          <TabsTrigger value="requests">My requests</TabsTrigger>
          <TabsTrigger value="incoming">Incoming</TabsTrigger>
          {me.role === "admin" && <TabsTrigger value="admin">Admin</TabsTrigger>}
        </TabsList>
        <TabsContent value="all" className="pt-4">
          <AllTools />
        </TabsContent>
        <TabsContent value="mine" className="pt-4">
          <MyListings />
        </TabsContent>
        <TabsContent value="requests" className="pt-4">
          <MyRequests />
        </TabsContent>
        <TabsContent value="incoming" className="pt-4">
          <Incoming />
        </TabsContent>
        {me.role === "admin" && (
          <TabsContent value="admin" className="pt-4">
            <AdminPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
