#!/usr/bin/env node
// Downloads the generated kana voice clips (Kuon, ElevenLabs v4) into public/audio/<reading>.mp3.
// Run on any machine with Node 18+ and normal internet:   node scripts/fetch-voice.mjs
// Existing files are kept (pass --force to re-download). Then commit public/audio.
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const urls = JSON.parse(await readFile(join(root, 'scripts', 'voice-urls.json'), 'utf8'));
const out = join(root, 'public', 'audio');
const force = process.argv.includes('--force');
await mkdir(out, { recursive: true });

let ok = 0, skipped = 0;
const failed = [];
for (const [reading, url] of Object.entries(urls)) {
  const file = join(out, `${reading}.mp3`);
  if (!force && (await stat(file).then((s) => s.size > 1000, () => false))) { skipped++; continue; }
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1000) throw new Error(`only ${buf.length} bytes`);
    await writeFile(file, buf);
    ok++;
  } catch (e) {
    failed.push(`${reading}: ${e.message}`);
  }
}
console.log(`downloaded ${ok}, kept ${skipped}, failed ${failed.length}`);
if (failed.length) { console.log(failed.join('\n')); process.exit(1); }
