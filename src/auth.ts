import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

/**
 * Auth.js (NextAuth v5) with a single Microsoft Entra ID provider, used to gate
 * the whole app behind an organization sign-in. Credentials are read from env
 * automatically by Auth.js:
 *   AUTH_MICROSOFT_ENTRA_ID_ID      — app (client) ID
 *   AUTH_MICROSOFT_ENTRA_ID_SECRET  — client secret
 *   AUTH_MICROSOFT_ENTRA_ID_ISSUER  — https://login.microsoftonline.com/<TENANT_ID>/v2.0
 *                                     (tenant-specific URL ⇒ single-tenant)
 *   AUTH_SECRET                     — cookie/JWT encryption key
 *
 * The gate is OPT-IN: when AUTH_MICROSOFT_ENTRA_ID_ID is unset, `isEntraEnabled`
 * is false and the proxy + page checks no-op, so the app runs exactly as before
 * and no AUTH_SECRET is required.
 */
export const isEntraEnabled = Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_ID);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [MicrosoftEntraID],
  pages: { signIn: "/signin" },
});
