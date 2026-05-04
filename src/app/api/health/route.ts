import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { APP_BUILD_TAG, APP_VERSION } from "@/lib/version";

export async function GET() {
  const checks: Record<string, "ok" | "fail"> = {};
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("events").select("id", { count: "exact", head: true });
    checks.db = error ? "fail" : "ok";
  } catch (e) {
    logger.error("health.db_failed", e);
    checks.db = "fail";
  }

  const ok = Object.values(checks).every((v) => v === "ok");
  return NextResponse.json(
    {
      ok,
      version: APP_VERSION,
      build: APP_BUILD_TAG,
      checks,
      ts: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  );
}
