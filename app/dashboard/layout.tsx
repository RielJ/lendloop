import { auth } from "@clerk/nextjs/server";

// Redirects signed-out visitors to sign in. Data access is enforced by Convex.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await auth.protect();
  return children;
}
