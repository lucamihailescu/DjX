import { redirect } from "next/navigation";
import { auth, isEntraEnabled } from "@/auth";
import { HomeClient } from "./home-client";

// Auth-dependent: never prerender. (Also a no-op when the gate is disabled.)
export const dynamic = "force-dynamic";

export default async function Page() {
  // Secure (authoritative) gate: validate the Entra session server-side. The
  // proxy only does an optimistic cookie pre-filter; this is the real check.
  if (isEntraEnabled) {
    const session = await auth();
    if (!session?.user) redirect("/signin");
  }
  return <HomeClient />;
}
