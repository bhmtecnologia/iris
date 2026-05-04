import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { CheckoutClient } from "./checkout-client";

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string; qrToken: string }>;
  searchParams: Promise<{ s?: string }>;
}) {
  const { orderId, qrToken } = await params;
  const { s: searchId } = await searchParams;

  if (!searchId) redirect(`/e/${qrToken}`);

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, total_cents, status, mp_qr_code, mp_qr_code_base64, photo_ids, event_id, search_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) notFound();

  // Anti-leak: o searchId tem que casar com o que originou o pedido.
  if (order.search_id !== searchId) notFound();

  return <CheckoutClient order={order} searchId={searchId} />;
}
