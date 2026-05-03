import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UploadDropzone } from "./upload-client";

export default async function UploadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!event) notFound();

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Upload — {event.name}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Arraste milhares de JPEGs. O processamento (marca d&apos;água + indexação facial) acontece em segundo plano.
      </p>
      <div className="mt-8">
        <UploadDropzone eventId={event.id} />
      </div>
    </main>
  );
}
