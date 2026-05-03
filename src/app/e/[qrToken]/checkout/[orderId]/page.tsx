import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { CheckoutClient } from "./checkout-client";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ orderId: string; qrToken: string }>;
}) {
  const { orderId } = await params;
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, total_cents, status, mp_qr_code, mp_qr_code_base64, photo_ids, event_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) notFound();

  return <CheckoutClient order={order} />;
}
