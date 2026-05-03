import sharp from "sharp";

const TEXT = "ÍRIS · PREVIEW";

export async function applyWatermark(input: Buffer | Uint8Array): Promise<Buffer> {
  const image = sharp(input).rotate();
  const meta = await image.metadata();
  const w = meta.width ?? 1200;
  const h = meta.height ?? 800;

  const fontSize = Math.round(Math.min(w, h) / 18);
  const tile = Math.round(Math.min(w, h) / 3);

  const svg = `
    <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="wm" patternUnits="userSpaceOnUse" width="${tile}" height="${tile}" patternTransform="rotate(-30)">
          <text x="0" y="${fontSize}" font-family="Helvetica, Arial, sans-serif"
                font-size="${fontSize}" font-weight="700" fill="rgba(255,255,255,0.35)"
                stroke="rgba(0,0,0,0.25)" stroke-width="1">${TEXT}</text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#wm)" />
    </svg>`;

  return image
    .resize({ width: Math.min(w, 1600), withoutEnlargement: true })
    .composite([{ input: Buffer.from(svg), blend: "over" }])
    .jpeg({ quality: 78 })
    .toBuffer();
}
