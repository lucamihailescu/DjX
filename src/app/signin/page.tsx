import { redirect } from "next/navigation";
import { auth, signIn, isEntraEnabled } from "@/auth";

export const dynamic = "force-dynamic";

/**
 * Organization sign-in gate. Uses a server action so the OAuth handshake runs
 * entirely server-side (the client secret never reaches the browser).
 */
export default async function SignInPage() {
  // Gate disabled ⇒ nothing to sign into; send users to the app.
  if (!isEntraEnabled) redirect("/");
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-black/[0.96] antialiased">
      {/* grid backdrop, matching the Spotify login screen */}
      <div className="pointer-events-none absolute inset-0 [background-size:40px_40px] [background-image:linear-gradient(to_right,#171717_1px,transparent_1px),linear-gradient(to_bottom,#171717_1px,transparent_1px)]" />
      <div className="pointer-events-none absolute inset-0 bg-black [mask-image:radial-gradient(ellipse_at_center,transparent_10%,black)]" />

      <div className="relative z-10 mx-auto max-w-md px-6 text-center">
        <h1 className="bg-gradient-to-b from-neutral-50 to-neutral-400 bg-clip-text text-5xl font-bold text-transparent md:text-6xl">
          DjX
        </h1>
        <p className="mx-auto mt-5 max-w-sm text-base text-neutral-400">
          Sign in with your organization account to continue.
        </p>

        <form
          action={async () => {
            "use server";
            await signIn("microsoft-entra-id", { redirectTo: "/" });
          }}
          className="mt-10 flex justify-center"
        >
          <button
            type="submit"
            className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-neutral-100 transition hover:scale-[1.03] hover:bg-white/10"
          >
            <MicrosoftLogo />
            Sign in with Microsoft
          </button>
        </form>
      </div>
    </main>
  );
}

function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}
