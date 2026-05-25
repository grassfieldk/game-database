import { load } from "cheerio";
import { logError, logResults, logStart, saveJson } from "./common.ts";

const TARGET_URL = "https://gamerch.com/sceptersword/936700";
const OUTPUT_DIR = new URL("../../data/tsueken/", import.meta.url);
const OUTPUT_FILE = new URL("skills.json", OUTPUT_DIR);

type SkillRecord = {
  name: string;
  rarity: string;
  type: string;
  category: string;
  cooldown?: number | string;
  damage?: string;
  description?: string;
};

function extractSkillName(rawTitle: string): string {
  const trimmed = rawTitle.trim();
  const withoutPrefix = trimmed.replace(/^【[^】]*】/, "");
  return withoutPrefix.replace(/の性能.*$/u, "").trim() || trimmed;
}

function parseNumberOrString(input: string): number | string {
  const match = input.match(/-?\d+(?:\.\d+)?/);
  if (match) {
    return Number(match[0]);
  }
  return input;
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Bun/1.0)",
    },
  });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return await response.text();
}

async function collectEntries(): Promise<string[]> {
  const html = await fetchHtml(TARGET_URL);
  const $ = load(html);
  const links: string[] = [];
  $("td.mu__table--col2 a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;
    try {
      const absolute = new URL(href, TARGET_URL).toString();
      links.push(absolute);
    } catch {}
  });
  return Array.from(new Set(links));
}

async function parseSkillPage(url: string): Promise<SkillRecord | null> {
  const html = await fetchHtml(url);
  const $ = load(html);
  const infoCell = $("td.mu__table--col2")
    .filter((_, element) => $(element).text().includes("クールタイム"))
    .first();
  if (!infoCell.length) {
    return null;
  }
  const extracted = (infoCell.html() ?? "")
    .split(/<hr[^>]*>/i)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const [headerSegment, detailSegment, ...descriptionSegments] = extracted;
  if (!headerSegment || !detailSegment) {
    return null;
  }
  const headerParts = headerSegment
    .split("／")
    .map((segment) => segment.replace(/\s+/gu, " ").trim())
    .filter(Boolean);
  const [rarity = "", type = "", category = ""] = headerParts;
  const detailFragments = detailSegment
    .split(/<br\s*\/?>/i)
    .map((fragment) => load(fragment).text().trim())
    .filter(Boolean);
  let cooldown: number | string | undefined;
  let damage: string | undefined;
  for (const fragment of detailFragments) {
    const [label, ...valueParts] = fragment.split("：");
    if (!label || valueParts.length === 0) continue;
    const value = valueParts.join("：").trim();
    if (label === "クールタイム") {
      cooldown = parseNumberOrString(value);
    } else if (label === "ダメージ") {
      damage = value;
    }
  }
  const description = descriptionSegments
    .map((segment) => load(segment).text().replace(/\s+/gu, " ").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
  const titleText = $("h1").first().text();
  const name = extractSkillName(titleText);
  return {
    name,
    rarity,
    type,
    category,
    cooldown,
    damage,
    description,
  };
}

async function fetchDetail(url: string): Promise<SkillRecord | null> {
  return await parseSkillPage(url);
}

function buildPayload(record: SkillRecord | null): SkillRecord | null {
  return record;
}

async function persistJson(records: SkillRecord[]): Promise<void> {
  await saveJson(OUTPUT_FILE, records);
}

async function main(): Promise<void> {
  const topic = "tsueken skills";
  logStart(topic);
  try {
    const links = await collectEntries();
    const records: SkillRecord[] = [];
    let skippedCount = 0;
    for (const link of links) {
      try {
        const detail = await fetchDetail(link);
        const payload = buildPayload(detail);
        if (payload) {
          records.push(payload);
        } else {
          skippedCount += 1;
        }
      } catch (error) {
        skippedCount += 1;
        logError(`Failed to fetch ${link}`, error);
      }
    }
    await persistJson(records);
    logResults("skills", records.length, skippedCount, "without details");
  } catch (error) {
    logError("Unable to fetch tsueken skills", error);
    process.exitCode = 1;
  }
}

void main();
