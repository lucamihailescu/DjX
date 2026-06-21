import { NextResponse } from "next/server";
import { handlers, isEntraEnabled } from "@/auth";

// When the Entra gate is disabled, NextAuth has no provider/secret configured —
// serve a clean 404 instead of letting it 500 on a poked endpoint.
const disabled = () =>
  NextResponse.json({ error: "Authentication is not configured." }, { status: 404 });

export const GET = isEntraEnabled ? handlers.GET : disabled;
export const POST = isEntraEnabled ? handlers.POST : disabled;
