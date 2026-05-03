"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { createClient } from "@/lib/supabase/client";

type Status = "queued" | "uploading" | "done" | "error";
type Item = { name: string; size: number; status: Status; progress: number };

const CONCURRENCY = 4;

export function UploadDropzone({ eventId }: { eventId: string }) {
  const [items, setItems] = useState<Item[]>([]);

  const startUploads = useCallback(
    async (files: File[]) => {
      setItems((prev) => [
        ...prev,
        ...files.map((f) => ({ name: f.name, size: f.size, status: "queued" as Status, progress: 0 })),
      ]);

      const supabase = createClient();
      const queue = files.slice();

      async function worker() {
        while (queue.length) {
          const file = queue.shift();
          if (!file) break;
          setItems((p) => p.map((it) => (it.name === file.name ? { ...it, status: "uploading" } : it)));

          const res = await fetch("/api/upload/presign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId, filename: file.name, contentType: file.type }),
          });
          if (!res.ok) {
            setItems((p) => p.map((it) => (it.name === file.name ? { ...it, status: "error" } : it)));
            continue;
          }
          const { path, signedUrl } = (await res.json()) as { path: string; signedUrl: string; token: string };

          const { error } = await supabase.storage
            .from("originals")
            .uploadToSignedUrl(path, (await res.json().catch(() => ({ token: "" }))).token, file)
            .catch(async () => {
              // Fallback: direct PUT to signedUrl
              await fetch(signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
              return { error: null as Error | null };
            });

          if (error) {
            setItems((p) => p.map((it) => (it.name === file.name ? { ...it, status: "error" } : it)));
            continue;
          }

          await fetch("/api/upload/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId, path }),
          });

          setItems((p) =>
            p.map((it) => (it.name === file.name ? { ...it, status: "done", progress: 100 } : it))
          );
        }
      }

      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    },
    [eventId]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/jpeg": [".jpg", ".jpeg"] },
    onDrop: startUploads,
  });

  const done = items.filter((i) => i.status === "done").length;

  return (
    <div>
      <div
        {...getRootProps()}
        className={`p-12 rounded-xl border-2 border-dashed text-center cursor-pointer transition-colors ${
          isDragActive ? "border-[var(--foreground)]" : "border-[var(--border)]"
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-base">Arraste fotos aqui ou clique para selecionar</p>
        <p className="mt-2 text-xs text-[var(--muted)]">JPEG · alta resolução · upload paralelo</p>
      </div>

      {items.length > 0 && (
        <div className="mt-6 text-sm">
          <div className="mb-3 text-[var(--muted)]">
            {done} / {items.length} concluídos
          </div>
          <ul className="max-h-72 overflow-y-auto divide-y divide-[var(--border)]">
            {items.map((it, i) => (
              <li key={`${it.name}-${i}`} className="py-2 flex justify-between gap-4">
                <span className="truncate">{it.name}</span>
                <span className={`text-xs uppercase tracking-wider ${
                  it.status === "done" ? "text-green-600" :
                  it.status === "error" ? "text-red-500" :
                  "text-[var(--muted)]"
                }`}>{it.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
