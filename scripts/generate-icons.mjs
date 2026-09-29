import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
// Draws the app icon (an app window) straight into pixel buffers and writes
// PNGs, so no image tooling is needed. Run with `pnpm icons`. Keep it in step
// with src/components/logo.tsx; replace the drawing with your app's own mark.
import { deflateSync } from "node:zlib";

const OUT_DIR = join(import.meta.dirname, "..", "public", "icons");

const BLUE = [37, 99, 235];
const TITLE_BAR = [30, 58, 138];
const WINDOW = [255, 255, 255];
const LINE = [191, 219, 254];

/** Text lines in the window: the vertical centre of each, as a share of the icon. */
const LINE_ROWS = [0.47, 0.56, 0.65];

/**
 * Color at a point of the unit square (0–1). `maskable` keeps everything
 * inside the 80 % safe zone and fills the corners with the background.
 */
function shade({ x, y, maskable }) {
  // Rounded-square background; maskable icons are cropped by the platform.
  const radius = 0.22;
  const dx = Math.max(Math.abs(x - 0.5) - (0.5 - radius), 0);
  const dy = Math.max(Math.abs(y - 0.5) - (0.5 - radius), 0);
  if (!maskable && Math.hypot(dx, dy) > radius) {
    return null;
  }
  const s = maskable ? 0.8 : 1;
  const cx = (x - 0.5) / s + 0.5;
  const cy = (y - 0.5) / s + 0.5;

  // A window: a title bar over a white pane with a few lines of text.
  if (cx >= 0.2 && cx <= 0.8 && cy >= 0.24 && cy <= 0.76) {
    if (cy <= 0.36) {
      return TITLE_BAR;
    }
    if (cx >= 0.28 && cx <= 0.72 && LINE_ROWS.some((row) => Math.abs(cy - row) < 0.02)) {
      return LINE;
    }
    return WINDOW;
  }
  return BLUE;
}

function render({ size, maskable }) {
  const samples = 4;
  const pixels = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const x = (px + (sx + 0.5) / samples) / size;
          const y = (py + (sy + 0.5) / samples) / size;
          const color = shade({ x, y, maskable });
          if (color) {
            r += color[0];
            g += color[1];
            b += color[2];
            a += 255;
          }
        }
      }
      const count = samples * samples;
      const offset = (py * size + px) * 4;
      const coverage = a / count / 255;
      // Premultiplied averages divided back out, so edges blend cleanly.
      pixels[offset] = coverage ? Math.round(r / count / coverage) : 0;
      pixels[offset + 1] = coverage ? Math.round(g / count / coverage) : 0;
      pixels[offset + 2] = coverage ? Math.round(b / count / coverage) : 0;
      pixels[offset + 3] = Math.round(a / count);
    }
  }
  return pixels;
}

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

function encodePng({ size, pixels }) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const rows = [];
  for (let y = 0; y < size; y += 1) {
    rows.push(Buffer.from([0]), pixels.subarray(y * size * 4, (y + 1) * size * 4));
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const { name, size, maskable } of [
  { name: "icon-192.png", size: 192, maskable: false },
  { name: "icon-512.png", size: 512, maskable: false },
  { name: "icon-maskable-512.png", size: 512, maskable: true },
  { name: "apple-touch-icon.png", size: 180, maskable: true },
]) {
  writeFileSync(join(OUT_DIR, name), encodePng({ size, pixels: render({ size, maskable }) }));
  process.stdout.write(`wrote ${name}\n`);
}
