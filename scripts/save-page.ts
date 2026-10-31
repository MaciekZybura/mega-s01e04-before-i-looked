// Save one rig page as a single self-contained HTML file (plan § 3 / § 4, ADR 0001, ADR 0003).
// Usage: tsx --env-file-if-exists=.env scripts/save-page.ts /digest/2026-10-28 preview/index.html
// Renders through app.request(), so the file is byte-for-byte what the server would send;
// the lane banner comes from LANE_ID / LANE_MARKER in the environment.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createApp } from '../src/app.js';

const [path = '/', out = 'preview/index.html'] = process.argv.slice(2);
const res = await createApp().request(path);
if (res.status !== 200) {
  console.error(`${path} answered ${res.status}`);
  process.exit(1);
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, await res.text());
console.log(`saved ${path} -> ${out} (marker: ${process.env.LANE_MARKER?.trim() || 'none'})`);
