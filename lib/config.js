import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.join(ROOT, 'data');

const parseEnv = (text) => {
  const out = {};
  for (const line of String(text).split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
};

const files = {};
const envFile = path.join(ROOT, '.env');
if (existsSync(envFile)) Object.assign(files, parseEnv(readFileSync(envFile, 'utf8')));
const jsonFile = path.join(ROOT, 'config.json');
if (existsSync(jsonFile)) {
  try {
    Object.assign(files, JSON.parse(readFileSync(jsonFile, 'utf8')));
  } catch (e) {
    console.error('[lucre] config.json is not valid JSON:', e.message);
  }
}

const env = { ...files, ...process.env };
const list = (v) => (Array.isArray(v) ? v : String(v ?? '').split(/[,\s]+/)).map((x) => String(x).trim()).filter(Boolean);

export const config = {
  token: String(env.YAPPER_BOT_TOKEN || env.TOKEN || files.token || '').trim(),
  ownerIds: list(env.OWNER_IDS ?? files.ownerIds),
  prefixes: list(env.PREFIXES ?? files.prefixes).length ? list(env.PREFIXES ?? files.prefixes) : ['/', '!'],
  status: {
    state: String(env.STATUS ?? files.status?.state ?? 'online'),
    activity: String(env.ACTIVITY ?? files.status?.activity ?? 'Lucre | /help'),
  },
  bio: String(env.BIO ?? files.bio ?? '').slice(0, 190),
  name: String(env.BOT_NAME ?? files.name ?? 'Lucre').slice(0, 32),
};
