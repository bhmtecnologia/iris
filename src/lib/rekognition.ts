import {
  RekognitionClient,
  CreateCollectionCommand,
  DeleteCollectionCommand,
  IndexFacesCommand,
  SearchFacesByImageCommand,
} from "@aws-sdk/client-rekognition";
import { nanoid } from "nanoid";
import { STUB_REKOGNITION } from "./dev-stubs";
import { createAdminClient } from "./supabase/admin";

const client = STUB_REKOGNITION
  ? null
  : new RekognitionClient({
      region: process.env.AWS_REGION ?? "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

export function collectionIdForEvent(eventId: string) {
  return `evt_${eventId.replace(/-/g, "")}`;
}

export async function createCollection(eventId: string) {
  const id = collectionIdForEvent(eventId);
  if (STUB_REKOGNITION) return id;
  await client!.send(new CreateCollectionCommand({ CollectionId: id }));
  return id;
}

export async function deleteCollection(eventId: string) {
  const id = collectionIdForEvent(eventId);
  if (STUB_REKOGNITION) return;
  await client!.send(new DeleteCollectionCommand({ CollectionId: id }));
}

export async function indexFaces(
  eventId: string,
  photoId: string,
  imageBytes: Uint8Array
) {
  if (STUB_REKOGNITION) {
    // Pretend we found one face per photo. The "FaceId" maps back to the photo.
    return [`stub-${photoId}-${nanoid(6)}`];
  }
  const out = await client!.send(
    new IndexFacesCommand({
      CollectionId: collectionIdForEvent(eventId),
      ExternalImageId: photoId,
      Image: { Bytes: imageBytes },
      DetectionAttributes: ["DEFAULT"],
      MaxFaces: 30,
      QualityFilter: "AUTO",
    })
  );
  return (out.FaceRecords ?? [])
    .map((f) => f.Face?.FaceId)
    .filter((x): x is string => !!x);
}

export async function searchByImage(
  eventId: string,
  imageBytes: Uint8Array,
  threshold = 90
) {
  if (STUB_REKOGNITION) {
    // Demo behaviour: return every processed photo of the event so the journey
    // is end-to-end testable without any real face match.
    void imageBytes;
    void threshold;
    const admin = createAdminClient();
    const { data } = await admin
      .from("photos")
      .select("id")
      .eq("event_id", eventId)
      .not("processed_at", "is", null)
      .limit(50);
    return (data ?? []).map((p) => ({
      faceId: `stub-${p.id}`,
      photoId: p.id,
      similarity: 95,
    }));
  }
  const out = await client!.send(
    new SearchFacesByImageCommand({
      CollectionId: collectionIdForEvent(eventId),
      Image: { Bytes: imageBytes },
      FaceMatchThreshold: threshold,
      MaxFaces: 200,
    })
  );
  return (out.FaceMatches ?? [])
    .map((m) => ({
      faceId: m.Face?.FaceId,
      photoId: m.Face?.ExternalImageId,
      similarity: m.Similarity,
    }))
    .filter(
      (m): m is { faceId: string; photoId: string; similarity: number } =>
        !!m.faceId && !!m.photoId && typeof m.similarity === "number"
    );
}
