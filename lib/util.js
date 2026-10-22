import path from 'node:path';

export const truncate = (s, n = 2000) => {
  const t = String(s ?? '');
  return t.length <= n ? t : `${t.slice(0, Math.max(0, n - 1))}…`;
};

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

export const title = (s) => String(s || '').replace(/(^|[\s_-])([a-z])/g, (_, a, b) => a + b.toUpperCase());

export const duration = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const bits = [];
  if (d) bits.push(`${d}d`);
  if (h) bits.push(`${h}h`);
  if (m) bits.push(`${m}m`);
  if (sec || !bits.length) bits.push(`${sec}s`);
  return bits.join(' ');
};

export const since = (iso) => {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 'unknown';
  return `${duration(Date.now() - t)} ago`;
};

/** "10m", "2h 30m", "1d", "45" -> minutes (null when it makes no sense). */
export const parseDuration = (text) => {
  const s = String(text ?? '').trim().toLowerCase();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  const re = /(\d+(?:\.\d+)?)\s*(ms|milliseconds?|s|sec|secs|seconds?|m|min|mins|minutes?|h|hr|hrs|hours?|d|day|days?|w|week|weeks?)\b/g;
  let total = 0;
  let found = false;
  let m;
  while ((m = re.exec(s))) {
    found = true;
    const n = Number(m[1]);
    const u = m[2];
    if (u.startsWith('ms') || u.startsWith('milli')) total += n / 1000;
    else if (u.startsWith('s')) total += n;
    else if (u.startsWith('m')) total += n * 60;
    else if (u.startsWith('h')) total += n * 3600;
    else if (u.startsWith('d')) total += n * 86400;
    else if (u.startsWith('w')) total += n * 604800;
  }
  if (!found) return null;
  const minutes = Math.round(total / 60);
  return minutes >= 1 ? minutes : null;
};

export const uuid = (text) => {
  const t = String(text ?? '').trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) return t;
  const m = /<@([0-9a-f-]{36})>/i.exec(t);
  return m ? m[1] : null;
};

export const mention = (id) => `<@${id}>`;

export const avatarUrl = (user) => {
  const p = user?.avatar_path;
  if (!p) return null;
  return p.startsWith('/') ? `https://www.yapper.website${p}` : `https://files.yapper.website/avatars/${p}`;
};

export const serverIconUrl = (server) => {
  const p = server?.icon_path;
  if (!p) return null;
  return p.startsWith('/') ? `https://www.yapper.website${p}` : `https://files.yapper.website/icons/${p}`;
};

export const nameOf = (user) => user?.display_name || user?.username || 'unknown';

/** All members of a server, paging through the API (500 a page). */
export const allMembers = async (bot, serverId, maxPages = 10) => {
  const out = [];
  let after = null;
  for (let i = 0; i < maxPages; i++) {
    const page = await bot.members(serverId, after);
    if (!page?.length) break;
    out.push(...page);
    after = page[page.length - 1].id;
    if (page.length < 500) break;
  }
  return out;
};

/** Find a person by mention, id or name. */
export const resolveUser = async (bot, serverId, text) => {
  const id = uuid(text);
  if (id) return { id };
  const q = String(text ?? '').trim().replace(/^@/, '').toLowerCase();
  if (!q) return null;
  const members = await allMembers(bot, serverId);
  const hit =
    members.find((m) => (m.username || '').toLowerCase() === q) ||
    members.find((m) => (m.display_name || '').toLowerCase() === q) ||
    members.find((m) => (m.nickname || '').toLowerCase() === q);
  return hit ? { id: hit.id, member: hit } : null;
};

/** A role by mention, id or name. */
export const resolveRole = async (bot, serverId, text) => {
  const roles = await bot.roles(serverId);
  const id = uuid(text);
  if (id) return roles.find((r) => r.id === id) || null;
  const q = String(text ?? '').trim().replace(/^@/, '').toLowerCase();
  if (!q) return null;
  return (
    roles.find((r) => (r.name || '').toLowerCase() === q) ||
    roles.find((r) => (r.name || '').toLowerCase().includes(q)) ||
    null
  );
};

export const cogName = (owner) => {
  if (!owner) return 'general';
  const label = owner.label || owner.name || '';
  return path.basename(String(label)).replace(/\.m?js$/i, '') || 'general';
};
