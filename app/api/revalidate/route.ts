import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");

  if (secret !== process.env.SANITY_REVALIDATE_SECRET) {
    return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
  }

  let body: { _type?: string; slug?: { current?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  if (body._type === "post") {
    revalidatePath("/blog");
    if (body.slug?.current) {
      revalidatePath(`/blog/${body.slug.current}`);
    }
  }

  if (body._type === "faqItem") {
    revalidatePath("/faq");
    revalidatePath("/en/faq");
  }

  return NextResponse.json({ revalidated: true, type: body._type });
}
