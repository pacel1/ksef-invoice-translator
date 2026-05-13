import { NextResponse } from "next/server";
import { verifyPublicKsefQrUrl } from "@/lib/ksef/public-verification";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();
  const verificationUrl = typeof body.verificationUrl === "string" ? body.verificationUrl : "";

  if (!verificationUrl) {
    return NextResponse.json({ confirmed: false, error: "Missing KSeF verification URL." }, { status: 400 });
  }

  const result = await verifyPublicKsefQrUrl(verificationUrl);
  return NextResponse.json(result);
}
