import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listInvoices } from "@/lib/invoice/recent-invoices";

export const runtime = "nodejs";

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 50;

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const pageRaw = searchParams.get("page");
  const perPageRaw = searchParams.get("perPage");
  const search = searchParams.get("search") ?? undefined;
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  const page = pageRaw ? Number(pageRaw) : 1;
  const perPage = perPageRaw ? Math.min(Number(perPageRaw), MAX_PER_PAGE) : DEFAULT_PER_PAGE;

  if (!Number.isInteger(page) || page < 1) {
    return NextResponse.json({ error: "Invalid page" }, { status: 400 });
  }
  if (!Number.isInteger(perPage) || perPage < 1) {
    return NextResponse.json({ error: "Invalid perPage" }, { status: 400 });
  }

  const result = await listInvoices(userData.user.id, { page, perPage, search, from, to });
  return NextResponse.json(result);
}
