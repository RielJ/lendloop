import { Dashboard } from "@/components/dashboard/Dashboard";
import { SiteHeader } from "@/components/SiteHeader";

export default function DashboardPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Dashboard />
      </main>
    </>
  );
}
