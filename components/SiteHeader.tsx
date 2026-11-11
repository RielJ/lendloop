"use client";

import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Sign-in controls follow Clerk's session, not Convex's: if Convex can't get a token,
// the user must still see the avatar menu to sign out.
export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="font-semibold tracking-tight">
          LendLoop
        </Link>
        <Show when="signed-out">
          <SignInButton mode="modal">
            <Button variant="outline">Sign in</Button>
          </SignInButton>
        </Show>
        <Show when="signed-in">
          <div className="flex items-center gap-3">
            <Button variant="ghost" nativeButton={false} render={<Link href="/dashboard" />}>
              Dashboard
            </Button>
            <UserButton />
          </div>
        </Show>
      </div>
    </header>
  );
}
