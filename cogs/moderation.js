import { Cog, Embed } from '../yapper.js';
import { store } from '../lib/store.js';
import { canModerate, hasPerm, memberPerms } from '../lib/permissions.js';
import { mention, nameOf, parseDuration, resolveUser, truncate } from '../lib/util.js';

const settings = store('moderation', { modLog: null, warnings: {} });

export class Moderation extends Cog {
  commands = {
    kick: { description: 'Kick someone', run: (msg) => this.kick(msg) },
    ban: { description: 'Ban someone', run: (msg) => this.ban(msg) },
    unban: { description: 'Unban someone', run: (msg) => this.unban(msg) },
    mute: { description: 'Timeout someone, like /mute @user 10m', run: (msg) => this.mute(msg) },
    unmute: { description: 'Clear a timeout', run: (msg) => this.unmute(msg) },
    warn: { description: 'Warn someone', run: (msg) => this.warn(msg) },
    warnings: { description: 'Show the warnings of someone', run: (msg) => this.warnings(msg) },
    clearwarnings: { description: 'Clear the warnings of someone', run: (msg) => this.clearWarnings(msg) },
    clear: { description: 'Delete recent messages in this channel', run: (msg) => this.clear(msg) },
    slowmode: { description: 'Set the slowmode of this channel', run: (msg) => this.slowmode(msg) },
    lock: { description: 'Lock this channel', run: (msg) => this.lock(msg, true) },
    unlock: { description: 'Unlock this channel', run: (msg) => this.lock(msg, false) },
    setmodlog: { description: 'Choose the channel for the mod log', run: (msg) => this.setModLog(msg) },
    modlogs: { description: 'Show the last mod actions', run: (msg) => this.modLogs(msg) },
    announce: { description: 'Post an announcement', run: (msg) => this.announce(msg) },
  };

  /** Write to the mod log channel of the server, if there is one. */
  async log(serverId, embed) {
    const channelId = settings.get(serverId, 'modLog');
    if (!channelId) return;
    try {
      await this.bot.send(channelId, '', { embeds: [embed] });
    } catch (e) {
      console.warn('[lucre] could not write to the mod log:', e.message);
    }
  }

  /** The person the command is about + the rest of the line as the reason. */
  async target(msg) {
    const first = msg.argv[0];
    if (!first) return { error: 'âŒ Who? Mention someone: `/kick @user reason`' };
    const found = await resolveUser(this.bot, msg.server_id, first);
    if (!found) return { error: `âŒ I could not find **${truncate(first, 40)}** in this server.` };
    const reason = msg.argv.slice(1).join(' ').trim();
    return { id: found.id, reason };
  }

  async guard(msg, perm) {
    const actor = await memberPerms(this.bot, msg.server_id, msg.author_id);
    if (!hasPerm(actor.perms, perm)) return `âŒ You need the **${perm.replace(/_/g, ' ')}** permission.`;
    return null;
  }

  async kick(msg) {
    const t = await this.target(msg);
    if (t.error) return msg.reply(t.error);
    const blocked = await this.guard(msg, 'kick');
    if (blocked) return msg.reply(blocked);
    const check = await canModerate(this.bot, msg.server_id, msg.author_id, t.id, 'kick');
    if (!check.ok) return msg.reply(`âŒ I can't do that: ${check.reason}.`);
    if (t.id === msg.author_id) return msg.reply('âŒ You cannot kick yourself.');
    if (t.id === this.bot.me?.id) return msg.reply('âŒ I am not kicking myself.');
    try {
      await this.bot.kick(msg.server_id, t.id);
    } catch (e) {
      return msg.reply(`âŒ Could not kick: ${e.message}`);
    }
    await this.log(
      msg.server_id,
      new Embed().title('Member kicked').description(`${mention(t.id)}`).field('By', mention(msg.author_id), true).field('Reason', t.reason || 'none', true).color('#ed4245'),
    );
    return msg.reply(`âœ… Kicked ${mention(t.id)}${t.reason ? ` â€” ${t.reason}` : ''}`);
  }

  async ban(msg) {
    const t = await this.target(msg);
    if (t.error) return msg.reply(t.error);
    const blocked = await this.guard(msg, 'ban');
    if (blocked) return msg.reply(blocked);
    const check = await canModerate(this.bot, msg.server_id, msg.author_id, t.id, 'ban');
    if (!check.ok) return msg.reply(`âŒ I can't do that: ${check.reason}.`);
    if (t.id === msg.author_id) return msg.reply('âŒ You cannot ban yourself.');
    try {
      await this.bot.ban(msg.server_id, t.id);
    } catch (e) {
      return msg.reply(`âŒ Could not ban: ${e.message}`);
    }
    await this.log(
      msg.server_id,
      new Embed().title('Member banned').description(`${mention(t.id)}`).field('By', mention(msg.author_id), true).field('Reason', t.reason || 'none', true).color('#ed4245'),
    );
    return msg.reply(`âœ… Banned ${mention(t.id)}${t.reason ? ` â€” ${t.reason}` : ''}`);
  }

  async unban(msg) {
    const t = await this.target(msg);
    if (t.error) return msg.reply(t.error);
    const blocked = await this.guard(msg, 'ban');
    if (blocked) return msg.reply(blocked);
    try {
      await this.bot.unban(msg.server_id, t.id);
    } catch (e) {
      return msg.reply(`âŒ Could not unban: ${e.message}`);
    }
    await this.log(
      msg.server_id,
      new Embed().title('Member unbanned').description(`${mention(t.id)}`).field('By', mention(msg.author_id), true).color('#57f287'),
    );
    return msg.reply(`âœ… Unbanned ${mention(t.id)}`);
  }

  async mute(msg) {
    const t = await this.target(msg);
    if (t.error) return msg.reply(t.error);
    const blocked = await this.guard(msg, 'timeout');
    if (blocked) return msg.reply(blocked);
    const check = await canModerate(this.bot, msg.server_id, msg.author_id, t.id, 'timeout');
    if (!check.ok) return msg.reply(`âŒ I can't do that: ${check.reason}.`);
    const minutes = parseDuration(msg.argv[1] || '10m');
    if (!minutes) return msg.reply('âŒ How long? `/mute @user 10m` (up to 28 days).');
    if (minutes > 40320) return msg.reply('âŒ The longest timeout is 28 days.');
    const reason = msg.argv.slice(2).join(' ').trim();
    try {
      await this.bot.timeout(msg.server_id, t.id, minutes, reason);
    } catch (e) {
      return msg.reply(`âŒ Could not timeout: ${e.message}`);
    }
    await this.log(
      msg.server_id,
      new Embed().title('Member timed out').description(`${mention(t.id)}`).field('By', mention(msg.author_id), true).field('Time', `${minutes} minutes`, true).field('Reason', reason || 'none', true).color('#fee75c'),
    );
    return msg.reply(`ðŸ”‡ ${mention(t.id)} is muted for **${minutes} minutes**${reason ? ` â€” ${reason}` : ''}`);
  }

  async unmute(msg) {
    const t = await this.target(msg);
    if (t.error) return msg.reply(t.error);
    const blocked = await this.guard(msg, 'timeout');
    if (blocked) return msg.reply(blocked);
    try {
      await this.bot.timeout(msg.server_id, t.id, 0, '');
    } catch (e) {
      return msg.reply(`âŒ Could not clear the timeout: ${e.message}`);
    }
    await this.log(
      msg.server_id,
      new Embed().title('Timeout cleared').description(`${mention(t.id)}`).field('By', mention(msg.author_id), true).color('#57f287'),
    );
    return msg.reply(`ðŸ”Š ${mention(t.id)} can talk again.`);
  }

  async warn(msg) {
    const t = await this.target(msg);
    if (t.error) return msg.reply(t.error);
    const blocked = await this.guard(msg, 'manage_messages');
    if (blocked) return msg.reply(blocked);
    const reason = t.reason || 'no reason given';
    const list = settings.get(msg.server_id, 'warnings', {});
    list[t.id] = list[t.id] || [];
    list[t.id].push({ by: msg.author_id, reason, at: new Date().toISOString() });
    settings.set(msg.server_id, 'warnings', list);
    await this.log(
      msg.server_id,
      new Embed().title('Member warned').description(`${mention(t.id)}`).field('By', mention(msg.author_id), true).field('Reason', reason, true).color('#fee75c'),
    );
    return msg.reply(`âš ï¸ ${mention(t.id)} was warned â€” ${reason}`);
  }

  async warnings(msg) {
    const t = await this.target(msg);
    if (t.error) return msg.reply(t.error);
    const list = settings.get(msg.server_id, 'warnings', {});
    const mine = list[t.id] || [];
    if (!mine.length) return msg.reply(`${mention(t.id)} has no warnings.`);
    const embed = new Embed()
      .title(`Warnings of ${mention(t.id)}`)
      .description(mine.map((w, i) => `**${i + 1}.** ${w.reason} â€” by ${mention(w.by)}`).join('\n'))
      .color('#fee75c');
    return msg.reply('', { embeds: [embed] });
  }

  async clearWarnings(msg) {
    const t = await this.target(msg);
    if (t.error) return msg.reply(t.error);
    const blocked = await this.guard(msg, 'manage_messages');
    if (blocked) return msg.reply(blocked);
    const list = settings.get(msg.server_id, 'warnings', {});
    const count = (list[t.id] || []).length;
    delete list[t.id];
    settings.set(msg.server_id, 'warnings', list);
    return msg.reply(`ðŸ§¹ Removed **${count}** warning(s) of ${mention(t.id)}.`);
  }

  async clear(msg) {
    const blocked = await this.guard(msg, 'manage_messages');
    if (blocked) return msg.reply(blocked);
    const n = Number(msg.argv[0]);
    if (!Number.isSafeInteger(n) || n < 1 || n > 100) return msg.reply('âŒ How many? `/clear 10` (1 to 100).');
    try {
      const messages = await this.bot.messages(msg.channel_id, n);
      const ids = messages.map((m) => m.id);
      if (!ids.length) return msg.reply('âŒ There is nothing to delete here.');
      const out = await this.bot.bulkDelete(msg.channel_id, ids);
      await this.log(
        msg.server_id,
        new Embed().title('Messages cleared').field('By', mention(msg.author_id), true).field('Count', `${out?.deleted ?? ids.length}`, true).color('#95a5a6'),
      );
      return msg.reply(`ðŸ§¹ Deleted **${out?.deleted ?? ids.length}** message(s).`);
    } catch (e) {
      return msg.reply(`âŒ Could not delete: ${e.message}`);
    }
  }

  async slowmode(msg) {
    const blocked = await this.guard(msg, 'manage_channels');
    if (blocked) return msg.reply(blocked);
    const seconds = Number(msg.argv[0]);
    if (!Number.isSafeInteger(seconds) || seconds < 0 || seconds > 21600) {
      return msg.reply('âŒ Seconds between 0 (off) and 21600 (6 hours).');
    }
    try {
      await this.bot.editChannel(msg.channel_id, { slowmode: seconds });
    } catch (e) {
      return msg.reply(`âŒ Could not set the slowmode: ${e.message}`);
    }
    return msg.reply(seconds ? `ðŸŒ Slowmode set to **${seconds} seconds**.` : 'ðŸŒ Slowmode turned off.');
  }

  async lock(msg, locked) {
    const blocked = await this.guard(msg, 'manage_channels');
    if (blocked) return msg.reply(blocked);
    try {
      await this.bot.editChannel(msg.channel_id, { readOnly: locked });
    } catch (e) {
      return msg.reply(`âŒ Could not ${locked ? 'lock' : 'unlock'} the channel: ${e.message}`);
    }
    await this.log(
      msg.server_id,
      new Embed().title(locked ? 'Channel locked' : 'Channel unlocked').field('Channel', `<#${msg.channel_id}>`, true).field('By', mention(msg.author_id), true).color('#95a5a6'),
    );
    return msg.reply(locked ? `ðŸ”’ <#${msg.channel_id}> is locked.` : `ðŸ”“ <#${msg.channel_id}> is open again.`);
  }

  async setModLog(msg) {
    const blocked = await this.guard(msg, 'manage_channels');
    if (blocked) return msg.reply(blocked);
    const raw = msg.argv[0];
    const m = /<#([0-9a-f-]{36})>/i.exec(raw || '');
    if (!m) return msg.reply('âŒ Which channel? `/setmodlog #mod-logs`');
    settings.set(msg.server_id, 'modLog', m[1]);
    return msg.reply(`ðŸ“ Mod log set to <#${m[1]}>.`);
  }

  async modLogs(msg) {
    const blocked = await this.guard(msg, 'manage_messages');
    if (blocked) return msg.reply(blocked);
    const channelId = settings.get(msg.server_id, 'modLog');
    if (!channelId) return msg.reply('âŒ No mod log channel yet. Use `/setmodlog #channel`.');
    try {
      const messages = await this.bot.messages(channelId, 10);
      if (!messages.length) return msg.reply('The mod log is empty.');
      const lines = messages
        .slice(-10)
        .map((m, i) => `**${i + 1}.** ${(m.content || '').slice(0, 120) || '(card)'}`)
        .join('\n');
      const embed = new Embed().title('Mod log').description(lines).color('#95a5a6');
      return msg.reply('', { embeds: [embed] });
    } catch (e) {
      return msg.reply(`âŒ Could not read the mod log: ${e.message}`);
    }
  }

  async announce(msg) {
    const blocked = await this.guard(msg, 'manage_messages');
    if (blocked) return msg.reply(blocked);
    const text = String(msg.args || '').trim();
    if (!text) return msg.reply('âŒ What should I announce? `/announce Server maintenance at 8pm`');
    const embed = new Embed()
      .title('ðŸ“¢ Announcement')
      .description(text)
      .footer(`by ${nameOf(msg.author)}`)
      .timestamp()
      .color('#5865f2');
    return msg.reply('', { embeds: [embed] });
  }
}
