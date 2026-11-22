import { deflateSync } from 'node:zlib';
import type { Sprite } from './sprite';

const PAPER: [number, number, number] = [238, 228, 205];

function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const body = Buffer.concat([head.subarray(4), data]);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([head, data, tail]);
}

/** Contact sheet of sprites on a paper background, as PNG bytes. Dev/test helper (Node only). */
export function renderSheet(sprites: Sprite[], opts: { scale?: number; columns?: number } = {}): Buffer {
  const scale = opts.scale ?? 8;
  const columns = opts.columns ?? 4;
  const cell = 34 * scale; // room for a 32px sprite plus padding
  const rows = Math.max(1, Math.ceil(sprites.length / columns));
  const W = columns * cell;
  const H = rows * cell;
  const px = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) px.set(PAPER, i * 3);
  sprites.forEach((s, i) => {
    const ox = (i % columns) * cell + scale + ((32 - s.size) / 2) * scale;
    const oy = Math.floor(i / columns) * cell + scale + ((32 - s.size) / 2) * scale;
    s.rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === '.') continue;
        const hex = s.palette[row[x]].slice(1);
        const rgb = [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
        for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) px.set(rgb, ((oy + y * scale + dy) * W + ox + x * scale + dx) * 3);
      }
    });
  });
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) px.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
