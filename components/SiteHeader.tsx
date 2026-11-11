"use client";

import { SignInButton, UserButton } from "@clerk/nextjs";
import { Authenticated, Unauthenticated } from "convex/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="font-semibold tracking-tight">
          LendLoop
        </Link>
        <Unauthenticated>
          <SignInButton mode="modal">
            <Button variant="outline">Sign in</Button>
          </SignInButton>
        </Unauthenticated>
        <Authenticated>
          <div className="flex items-center gap-3">
            <Button variant="ghost" render={<Link href="/dashboard" />}>
              Dashboard
            </Button>
            <UserButton />
          </div>
        </Authenticated>
      </div>
    </header>
  );
}
