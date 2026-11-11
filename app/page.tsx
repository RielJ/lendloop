import { SignInButton } from "@clerk/nextjs";
import { PublicToolList } from "@/components/PublicToolList";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-12">
        <section className="mb-12 max-w-2xl">
          <h1 className="text-4xl font-semibold tracking-tight text-balance">
            Borrow what you need. Lend what you don&apos;t.
          </h1>
          <p className="mt-3 text-lg text-muted-foreground text-pretty">
            LendLoop is a tool-lending board for your neighborhood. List the drill you use twice a
            year, borrow the ladder you need once.
          </p>
          <div className="mt-6">
            <SignInButton mode="modal">
              <Button size="lg">Sign in to lend or borrow</Button>
            </SignInButton>
          </div>
        </section>
        <section>
          <h2 className="mb-4 text-sm font-medium text-muted-foreground">Available now</h2>
          <PublicToolList />
        </section>
      </main>
    </>
  );
}
