import { promises as fs } from "fs";
import path from "path";
import type { Memo } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const CACHE_FILE = path.join(DATA_DIR, "cache.json");

type CacheShape = {
  version: 1;
  memos: Record<string, Memo>; // key = normalized company name
};

function normalize(company: string): string {
  return company.trim().toLowerCase();
}

async function load(): Promise<CacheShape> {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw) as CacheShape;
    if (parsed.version !== 1) return { version: 1, memos: {} };
    return parsed;
  } catch {
    return { version: 1, memos: {} };
  }
}

async function save(data: CacheShape): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(CACHE_FILE, JSON.stringify(data, null, 2), "utf8");
}

export async function getCachedMemo(company: string): Promise<Memo | null> {
  const data = await load();
  return data.memos[normalize(company)] ?? null;
}

export async function setCachedMemo(memo: Memo): Promise<void> {
  const data = await load();
  data.memos[normalize(memo.company)] = memo;
  await save(data);
}

export async function listCachedMemos(): Promise<Memo[]> {
  const data = await load();
  return Object.values(data.memos);
}
