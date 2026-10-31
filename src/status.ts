import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { lastBeat, type Beat } from './heartbeat.js';
import { readNight } from './digest/index.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightCounts[];
};

// Counts are jobs by last status; null (shown as —) when the night cannot be read.
export type NightCounts =
  | { night: string; ok: number; retry: number; fail: number }
  | { night: string; ok: null; retry: null; fail: null };

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

function countNight(runsDir: string, night: string): NightCounts {
  try {
    const digest = readNight(runsDir, night);
    if (!digest) return { night, ok: null, retry: null, fail: null };
    const count = (s: string) => digest.rows.filter((r) => r.lastStatus === s).length;
    return { night, ok: count('ok'), retry: count('retry'), fail: count('fail') };
  } catch {
    return { night, ok: null, retry: null, fail: null };
  }
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((n) => countNight(config.runsDir, n)),
  };
}
