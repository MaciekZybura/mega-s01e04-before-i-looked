import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/index.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const digest = readNight('runs', '2026-10-28');

  it('has 5 jobs sorted by job and counts the truncated last line as bad', () => {
    expect(digest).not.toBeNull();
    expect(digest?.night).toBe('2026-10-28');
    expect(digest?.badLines).toBe(1);
    expect(digest?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('aggregates runs, retries, last status, last error and times as in the log', () => {
    const sync = digest?.rows.find((r) => r.job === 'lane/sync');
    expect(sync).toEqual({
      job: 'lane/sync',
      owner: 'rook',
      runs: 8,
      retries: 1,
      lastStatus: 'ok',
      lastError: 'lock held',
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    });
    const refresh = digest?.rows.find((r) => r.job === 'fixtures/refresh');
    expect(refresh).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: 'upstream 503' });
    const backup = digest?.rows.find((r) => r.job === 'notes/backup');
    expect(backup).toMatchObject({ runs: 1, lastStatus: 'fail', lastError: 'quota exceeded', owner: 'lane-07' });
  });

  it('keeps a row whose owner is null', () => {
    const render = digest?.rows.find((r) => r.job === 'digest/render');
    expect(render).toMatchObject({ owner: null, runs: 1, lastStatus: 'ok', lastError: null });
  });
});

describe('readNight on a temp runs dir', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  const write = (night: string, lines: string[]) =>
    writeFileSync(join(dir, `${night}.jsonl`), lines.join('\n'), 'utf8');
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('returns null when the night has no file', () => {
    expect(readNight(dir, '2026-01-01')).toBeNull();
  });

  it('returns no rows and no bad lines for an empty or blank-only file', () => {
    write('2026-01-02', []);
    expect(readNight(dir, '2026-01-02')).toEqual({ night: '2026-01-02', rows: [], badLines: 0 });
    write('2026-01-03', ['', '   ', '\r', '']);
    expect(readNight(dir, '2026-01-03')).toEqual({ night: '2026-01-03', rows: [], badLines: 0 });
  });

  it('keeps rows with a null or missing owner', () => {
    write('2026-01-04', [
      JSON.stringify({ at: '2026-01-04T01:00:00+01:00', job: 'b/null', status: 'ok', owner: null }),
      JSON.stringify({ at: '2026-01-04T02:00:00+01:00', job: 'a/missing', status: 'fail', error: 'boom' }),
    ]);
    const digest = readNight(dir, '2026-01-04');
    expect(digest?.badLines).toBe(0);
    expect(digest?.rows.map((r) => [r.job, r.owner])).toEqual([
      ['a/missing', null],
      ['b/null', null],
    ]);
  });

  it('aggregates retries and keeps the error of the last line that carried one', () => {
    write('2026-01-05', [
      JSON.stringify({ at: '2026-01-05T01:00:00-05:00', job: 'x', status: 'retry', owner: 'ann', error: 'first' }),
      JSON.stringify({ at: '2026-01-05T01:05:00-05:00', job: 'x', status: 'retry', owner: 'ann', error: 'second' }),
      JSON.stringify({ at: '2026-01-05T01:10:00-05:00', job: 'x', status: 'retry', owner: 'ann' }),
      JSON.stringify({ at: '2026-01-05T01:15:00-05:00', job: 'x', status: 'fail', owner: 'ann' }),
    ]);
    expect(readNight(dir, '2026-01-05')?.rows).toEqual([
      {
        job: 'x',
        owner: 'ann',
        runs: 4,
        retries: 3,
        lastStatus: 'fail',
        lastError: 'second',
        firstAt: '2026-01-05T01:00:00-05:00',
        lastAt: '2026-01-05T01:15:00-05:00',
      },
    ]);
  });

  it('counts unparseable and wrong-shape lines as bad, never throws', () => {
    write('2026-01-06', [
      '{"at":"2026-01-06T01:00:00+01:00","job":"ok/job","status":"ok","owner":"rook"}',
      '{not json',
      '[1,2,3]',
      '42',
      'null',
      '{"job":"no/at","status":"ok","owner":"rook"}',
      '{"at":"2026-01-06T01:00:00+01:00","status":"ok"}',
      '{"at":"2026-01-06T01:00:00+01:00","job":"bad/status","status":"done"}',
      '{"at":5,"job":"bad/at","status":"ok"}',
    ]);
    const digest = readNight(dir, '2026-01-06');
    expect(digest?.badLines).toBe(8);
    expect(digest?.rows.map((r) => r.job)).toEqual(['ok/job']);
  });
});
