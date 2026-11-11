"use client";

import { useQuery } from "convex/react";
import { AllTools } from "@/components/dashboard/AllTools";
import { Incoming } from "@/components/dashboard/Incoming";
import { MyListings } from "@/components/dashboard/MyListings";
import { MyRequests } from "@/components/dashboard/MyRequests";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";

export function Dashboard() {
  const me = useQuery(api.users.me);

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
      </Tabs>
    </div>
  );
}
