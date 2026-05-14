import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { InvalidPackageSizeError, priceForPackage } from "@/lib/billing/pricing";

export const runtime = "nodejs";

const querySchema = z.object({
  packageSize: z.coerce.number()
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ packageSize: url.searchParams.get("packageSize") });
  if (!parsed.success) {
    return NextResponse.json({ error: "packageSize is required" }, { status: 400 });
  }
  try {
    const quote = priceForPackage(parsed.data.packageSize);
    return NextResponse.json(quote, {
      headers: { "Cache-Control": "public, max-age=300" }
    });
  } catch (error) {
    if (error instanceof InvalidPackageSizeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[api/billing/price] unexpected:", error);
    return NextResponse.json({ error: "Unable to price package" }, { status: 500 });
  }
}
