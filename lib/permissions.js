/**
 * Permission helpers. Yapper gives roles a few top level flags (manage_server, manage_messages)
 * and everything else in a `perms` object, so we merge both and look names up leniently.
 * The API is still the final word: anything the bot is not allowed to do comes back as 403.
 */

const ALIASES = {
  manage_server: ['manage_server', 'administrator', 'admin', 'manage_server_permissions'],
  manage_messages: ['manage_messages', 'manage_message'],
  kick: ['kick', 'kick_members'],
  ban: ['ban', 'ban_members'],
  timeout: ['timeout', 'mute', 'moderate', 'moderator', 'moderate_members'],
  manage_roles: ['manage_roles', 'roles', 'manage_role'],
  manage_nicknames: ['manage_nicknames', 'manage_nickname', 'nicknames'],
  manage_channels: ['manage_channels', 'channels', 'manage_channel'],
  move_members: ['move_members', 'move', 'move_member'],
  manage_webhooks: ['manage_webhooks', 'webhooks'],
  send_messages: ['send_messages', 'messages', 'send_message'],
  view_channels: ['view_channels', 'read_channels', 'view_channel'],
};

export const rolePerms = (role) => {
  const perms = { ...(role?.perms || {}) };
  if (role?.manage_server) perms.manage_server = true;
  if (role?.manage_messages) perms.manage_messages = true;
  return perms;
};

export const hasPerm = (perms, name) => {
  if (!perms) return false;
  for (const key of ALIASES[name] || [name]) if (perms[key] === true) return true;
  return false;
};

/** Permissions of a member, plus their highest role position. */
export const memberPerms = async (bot, serverId, userId) => {
  const [roles, member] = await Promise.all([
    bot.roles(serverId),
    bot.member(serverId, userId).catch(() => null),
  ]);
  const mine = (member?.roles || []).map((id) => roles.find((r) => r.id === id)).filter(Boolean);
  const perms = {};
  let position = -1;
  for (const role of mine) {
    Object.assign(perms, rolePerms(role));
    position = Math.max(position, role.position ?? 0);
  }
  return { perms, roles: mine, position, member };
};

/** The bot's own permissions in a server. */
export const botPerms = async (bot, serverId) => {
  const me = bot.me?.id;
  if (!me) return { perms: {}, position: -1, member: null };
  return memberPerms(bot, serverId, me);
};

/**
 * Can the actor moderate the target? Needs the permission, and a role above the target
 * (unless the actor can manage the server).
 */
export const canModerate = async (bot, serverId, actorId, targetId, perm) => {
  const actor = await memberPerms(bot, serverId, actorId);
  if (!hasPerm(actor.perms, perm)) return { ok: false, reason: `you need the **${perm.replace(/_/g, ' ')}** permission` };
  const target = await memberPerms(bot, serverId, targetId);
  if (!hasPerm(actor.perms, 'manage_server') && target.position >= actor.position) {
    return { ok: false, reason: 'their highest role is above yours' };
  }
  return { ok: true, actor, target };
};
