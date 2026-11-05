import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Recording } from "./mock";

/** The order the mock plays them in. Files live in mocks/recordings/<name>.sse. */
export const RECORDING_NAMES = ["plain", "code", "mixed", "long"] as const;

export async function loadRecordings(dir = path.join(process.cwd(), "mocks", "recordings")): Promise<Recording[]> {
  return Promise.all(
    RECORDING_NAMES.map(async (name) => ({ name, sse: await readFile(path.join(dir, `${name}.sse`), "utf8") })),
  );
}
