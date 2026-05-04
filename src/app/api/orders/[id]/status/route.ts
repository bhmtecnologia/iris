import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24; // 24h (era 7d)

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  const searchId = url.searchParams.get("s");

  if (!searchId) {
    // Sem o searchId que o cliente recebeu, recusa.
    // Quem só tem o orderId (URL leakada, screenshot) não passa.
    return NextResponse.json({ error: "missing_search_token" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, status, photo_ids, search_id")
    .eq("id", id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Bind: o searchId tem que ser o mesmo que originou o pedido.
  if (order.search_id !== searchId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (order.status !== "paid") {
    return NextResponse.json({ status: order.status });
  }

  const { data: photos } = await admin
    .from("photos")
    .select("id, original_path")
    .in("id", order.photo_ids);

  const downloads = await Promise.all(
    (photos ?? []).map(async (p) => {
      const { data } = await admin.storage
        .from("originals")
        .createSignedUrl(p.original_path, SIGNED_URL_TTL_SECONDS);
      return data?.signedUrl ?? null;
    })
  );

  return NextResponse.json({
    status: "paid",
    downloads: downloads.filter((u): u is string => !!u),
  });
}
