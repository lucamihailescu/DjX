import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next 16 renamed Middleware to Proxy (same functionality, file is `proxy.ts`).
//
// Opt-in gate: only active when the Entra client id is configured. When it's
// unset, this no-ops, so an unconfigured deploy is completely unaffected (and
// no NextAuth/AUTH_SECRET is touched at the edge).
const GATE_ENABLED = Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_ID);

// Auth.js session-cookie names (dev vs. secure/prod). Their presence is an
// OPTIMISTIC signal only — per the Next 16 guidance, Proxy does a fast cookie
// pre-filter and the authoritative session check happens in the server
// component (see src/app/page.tsx), which validates and decrypts the token.
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

export function proxy(req: NextRequest) {
  if (!GATE_ENABLED) return NextResponse.next();
  const signedIn = SESSION_COOKIES.some((c) => req.cookies.has(c));
  if (!signedIn) {
    return NextResponse.redirect(new URL("/signin", req.nextUrl.origin));
  }
  return NextResponse.next();
}

export const config = {
  // Gate everything EXCEPT the auth endpoints, the sign-in page, Next internals,
  // and static assets — matching those would redirect-loop or break asset loads.
  matcher: [
    "/((?!api/auth|signin|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:png|svg|ico|webmanifest|txt|js)$).*)",
  ],
};
