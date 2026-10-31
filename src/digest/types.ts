// Plan 2026-10-29-morning-digest § 1. The contract every digest worker codes against.
// Commit this first: the page, the JSON, the board link and the tests start from here.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, after parsing at the edge (styleguide).
export type RunLine = {
  at: string; // ISO 8601 with the log's offset; never converted for display
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job for the night.
export type DigestRow = {
  job: string;
  owner: string | null; // null renders as "—", the row stays
  runs: number; // lines for this job
  retries: number; // lines with status "retry"
  lastStatus: RunStatus; // status of the last line, by order in the file
  lastError: string | null; // error of the last line that carried one
  firstAt: string;
  lastAt: string;
};

export type NightDigest = {
  night: string;
  rows: DigestRow[]; // sorted by job, so the page and the JSON agree by construction
  badLines: number; // lines that did not parse or had the wrong shape: counted, never thrown
};

// null = no file for that night (the page answers 404). An empty file = { rows: [], badLines: 0 }.
export function readNight(runsDir: string, night: string): NightDigest | null {
  void runsDir;
  void night;
  throw new Error('not implemented: see issue #2');
}
