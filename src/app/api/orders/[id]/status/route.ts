import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, status, photo_ids")
    .eq("id", id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });

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
        .createSignedUrl(p.original_path, 60 * 60 * 24 * 7);
      return data?.signedUrl ?? null;
    })
  );

  return NextResponse.json({
    status: "paid",
    downloads: downloads.filter((u): u is string => !!u),
  });
}
