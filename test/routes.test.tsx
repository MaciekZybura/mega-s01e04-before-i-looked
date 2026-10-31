import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { NightDigest } from '../src/digest/types.js';

const dir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir };
const app = createApp(config);

const line = (job: string, status: string, owner: string | null) =>
  JSON.stringify({ at: '2026-02-01T01:00:00+01:00', job, status, owner });
const write = (night: string, lines: string[]) =>
  writeFileSync(join(dir, `${night}.jsonl`), lines.join('\n'), 'utf8');

write('2026-02-01', [line('b/second', 'fail', 'ann'), line('a/first', 'ok', null)]);
write('2026-02-02', []);
write('2026-02-03', [line('a/ok', 'ok', 'ann'), '{not json']);

describe('GET /digest/:night', () => {
  it('renders a night: banner, sorted jobs, dash for null owner, warn on a fail', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await app.request('/digest/2026-02-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html.indexOf('a/first')).toBeGreaterThan(-1);
    expect(html.indexOf('a/first')).toBeLessThan(html.indexOf('b/second'));
    expect(html).toContain('<td>—</td>');
    expect(html).toContain('class="warn"');
  });

  it('answers 404 for a night with no file', async () => {
    expect((await app.request('/digest/2026-02-09')).status).toBe(404);
  });

  it('says nothing ran for an empty night', async () => {
    const res = await app.request('/digest/2026-02-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('still renders with a bad line and notes it', async () => {
    const res = await app.request('/digest/2026-02-03');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('1 line(s) did not parse');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns night, rows and badLines', async () => {
    const res = await app.request('/api/digest/2026-02-01');
    const body = (await res.json()) as NightDigest;
    expect(res.status).toBe(200);
    expect(body.night).toBe('2026-02-01');
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => r.job)).toEqual(['a/first', 'b/second']);
    expect(body.rows[0]?.owner).toBeNull();
  });

  it('answers 404 with an error body for a night with no file', async () => {
    const res = await app.request('/api/digest/2026-02-09');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night' });
  });

  it('has no rows for an empty night', async () => {
    const body = (await (await app.request('/api/digest/2026-02-02')).json()) as NightDigest;
    expect(body.rows).toEqual([]);
  });

  it('counts a bad line', async () => {
    const body = (await (await app.request('/api/digest/2026-02-03')).json()) as NightDigest;
    expect(body.badLines).toBe(1);
  });
});

describe('page and JSON agree', () => {
  it('list the same jobs in the same order', async () => {
    const html = await (await app.request('/digest/2026-02-01')).text();
    const body = (await (await app.request('/api/digest/2026-02-01')).json()) as NightDigest;
    const onPage = [...html.matchAll(/<td>([a-z]+\/[a-z]+)<\/td>/g)].map((m) => m[1]);
    expect(onPage).toEqual(body.rows.map((r) => r.job));
  });
});
