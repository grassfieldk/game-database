import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

function resolvePath(target: string | URL): string {
  return target instanceof URL ? target.pathname : target;
}

export async function ensureDirectory(target: string | URL) {
  await mkdir(resolvePath(target), { recursive: true });
}

export async function saveJson(target: string | URL, data: unknown) {
  const path = resolvePath(target);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function logStart(topic: string) {
  console.log(`[fetcher] start ${topic}`);
}

export function logResults(
  topic: string,
  saved: number,
  skipped?: number,
  skipReason = "already downloaded",
) {
  const base = `[fetcher] saved ${saved} ${topic}`;
  const suffix =
    skipped === undefined ? "" : `, skipped ${skipped} ${skipReason}`;
  console.log(base + suffix);
}

export function logError(message: string, error?: unknown) {
  if (error) {
    console.error(`[fetcher] ${message}`, error);
  } else {
    console.error(`[fetcher] ${message}`);
  }
}
