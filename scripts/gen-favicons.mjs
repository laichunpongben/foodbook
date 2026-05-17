#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
/**
 * gen-favicons.mjs — rasterize public/favicon.svg into the three pixel
 * variants Safari, iOS, and most link-preview crawlers default-fetch.
 *
 *   public/icon-32.png            32x32 PNG fallback
 *   public/apple-touch-icon.png   180x180, iOS home-screen + Safari tab
 *   public/favicon.ico            32x32 32-bit BGRA ICO (one-frame)
 *
 * Run after editing the SVG: `npm run favicons`.
 */
import sharp from "sharp";

const PUBLIC = new URL("../public/", import.meta.url);
const svg = await readFile(new URL("favicon.svg", PUBLIC));

// High DPI so the 32x32 downscale stays crisp against the SVG's 64-unit viewBox.
const SVG_RASTER_DENSITY = 384;
const renderAt = (size) => sharp(svg, { density: SVG_RASTER_DENSITY }).resize(size, size);

await renderAt(180)
  .png({ compressionLevel: 9 })
  .toFile(fileURLToPath(new URL("apple-touch-icon.png", PUBLIC)));
await renderAt(32)
  .png({ compressionLevel: 9 })
  .toFile(fileURLToPath(new URL("icon-32.png", PUBLIC)));

/* ----- ICO writer -----
 * ICO file = 6B file header + N×16B directory entries + N images.
 * Each image is a Windows DIB: BITMAPINFOHEADER (40B) + pixel data + AND mask.
 * Pixels are BGRA bottom-up. The AND mask is unused at 32-bit (alpha covers it)
 * but the byte block must be present and correctly sized for spec parsers. */
const ICO_FILE_HEADER_SIZE = 6;
const ICO_DIR_ENTRY_SIZE = 16;
const DIB_HEADER_SIZE = 40;
const BITS_PER_PIXEL = 32;
const SIZE = 32;

const rgba = await renderAt(SIZE).raw().toBuffer();
const pixels = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const src = (y * SIZE + x) * 4;
    const dst = ((SIZE - 1 - y) * SIZE + x) * 4;
    pixels[dst + 0] = rgba[src + 2]; // B
    pixels[dst + 1] = rgba[src + 1]; // G
    pixels[dst + 2] = rgba[src + 0]; // R
    pixels[dst + 3] = rgba[src + 3]; // A
  }
}
const andMask = Buffer.alloc((SIZE * SIZE) / 8);

const dib = Buffer.alloc(DIB_HEADER_SIZE);
dib.writeUInt32LE(DIB_HEADER_SIZE, 0); // biSize
dib.writeInt32LE(SIZE, 4); // biWidth
dib.writeInt32LE(SIZE * 2, 8); // biHeight (image + AND mask stacked)
dib.writeUInt16LE(1, 12); // biPlanes
dib.writeUInt16LE(BITS_PER_PIXEL, 14);
dib.writeUInt32LE(0, 16); // biCompression (BI_RGB)
dib.writeUInt32LE(pixels.length, 20); // biSizeImage

const image = Buffer.concat([dib, pixels, andMask]);

const header = Buffer.alloc(ICO_FILE_HEADER_SIZE);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type = ICO
header.writeUInt16LE(1, 4); // image count

const entry = Buffer.alloc(ICO_DIR_ENTRY_SIZE);
entry.writeUInt8(SIZE, 0); // width
entry.writeUInt8(SIZE, 1); // height
entry.writeUInt8(0, 2); // color palette
entry.writeUInt8(0, 3); // reserved
entry.writeUInt16LE(1, 4); // planes
entry.writeUInt16LE(BITS_PER_PIXEL, 6);
entry.writeUInt32LE(image.length, 8); // image size
entry.writeUInt32LE(ICO_FILE_HEADER_SIZE + ICO_DIR_ENTRY_SIZE, 12); // offset

await writeFile(
  fileURLToPath(new URL("favicon.ico", PUBLIC)),
  Buffer.concat([header, entry, image]),
);
