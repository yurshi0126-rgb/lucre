import { Cog, Embed, Row, Button } from '../yapper.js';
import { store } from '../lib/store.js';
import { hasPerm, memberPerms } from '../lib/permissions.js';
import { mention, nameOf, resolveRole } from '../lib/util.js';

const settings = store('welcome', {
  welcomeChannel: null,
  welcomeText: 'Welcome {user} to {server}! You are member #{count}.',
  leaveText: '{user} left {server}. We are {count} members now.',
  leaveChannel: null,
  autoRole: null,
  enabled: true,
  reactionRoles: [],
});

export class Welcome extends Cog {
  commands = {
    setwelcome: { description: 'Choose the welcome channel', run: (msg) => this.setWelcome(msg) },
    setleaveroom: { description: 'Choose the channel for leave messages', run: (msg) => this.setLeave(msg) },
    setwelcometext: { description: 'Change the welcome message', run: (msg) => this.setWelcomeText(msg) },
    setleavetext: { description: 'Change the leave message', run: (msg) => this.setLeaveText(msg) },
    autorole: { description: 'Give a role to everyone who joins', run: (msg) => this.autoRole(msg) },
    welcome: { description: 'Turn the welcome messages on or off', run: (msg) => this.toggle(msg) },
    reactrole: { description: 'Add a role to the reaction role panel', run: (msg) => this.addReactRole(msg) },
    reactroles: { description: 'Post the reaction role panel', run: (msg) => this.showReactRoles(msg) },
  };

  on = {
    member_join: (ev) => this.onJoin(ev),
    member_leave: (ev) => this.onLeave(ev),
  };

  async guard(msg, perm) {
    const actor = await memberPerms(this.bot, msg.server_id, msg.author_id);
    if (!hasPerm(actor.perms, perm)) return `❌ You need the **${perm.replace(/_/g, ' ')}** permission.`;
    return null;
  }

  async setWelcome(msg) {
    const blocked = await this.guard(msg, 'manage_channels');
    if (blocked) return msg.reply(blocked);
    const m = /<#([0-9a-f-]{36})>/i.exec(msg.args || '');
    if (!m) return msg.reply('❌ Which channel? `/setwelcome #welcome`');
    settings.set(msg.server_id, 'welcomeChannel', m[1]);
    return msg.reply(`👋 New members will be welcomed in <#${m[1]}>.`);
  }

  async setLeave(msg) {
    const blocked = await this.guard(msg, 'manage_channels');
    if (blocked) return msg.reply(blocked);
    const m = /<#([0-9a-f-]{36})>/i.exec(msg.args || '');
    if (!m) return msg.reply('❌ Which channel? `/setleaveroom #general`');
    settings.set(msg.server_id, 'leaveChannel', m[1]);
    return msg.reply(`🚪 Leave messages will go to <#${m[1]}>.`);
  }

  async setWelcomeText(msg) {
    const blocked = await this.guard(msg, 'manage_messages');
    if (blocked) return msg.reply(blocked);
    const text = String(msg.args || '').trim();
    if (!text) return msg.reply('❌ The text cannot be empty.');
    settings.set(msg.server_id, 'welcomeText', text);
    return msg.reply(`✅ Welcome text set. Use {user}, {server} and {count} in it.`);
  }

  async setLeaveText(msg) {
    const blocked = await this.guard(msg, 'manage_messages');
    if (blocked) return msg.reply(blocked);
    const text = String(msg.args || '').trim();
    if (!text) return msg.reply('❌ The text cannot be empty.');
    settings.set(msg.server_id, 'leaveText', text);
    return msg.reply(`✅ Leave text set. Use {user}, {server} and {count} in it.`);
  }

  async autoRole(msg) {
    const blocked = await this.guard(msg, 'manage_roles');
    if (blocked) return msg.reply(blocked);
    if (/^(off|none|remove)$/i.test(String(msg.args || '').trim())) {
      settings.set(msg.server_id, 'autoRole', null);
      return msg.reply('✅ Auto role turned off.');
    }
    const role = await resolveRole(this.bot, msg.server_id, msg.args || '');
    if (!role) return msg.reply('❌ Which role? `/autorole @Member`');
    settings.set(msg.server_id, 'autoRole', role.id);
    return msg.reply(`✅ New members will get the **${role.name}** role.`);
  }

  async toggle(msg) {
    const blocked = await this.guard(msg, 'manage_channels');
    if (blocked) return msg.reply(blocked);
    const now = !settings.get(msg.server_id, 'enabled', true);
    settings.set(msg.server_id, 'enabled', now);
    return msg.reply(now ? '✅ Welcome messages on.' : '✅ Welcome messages off.');
  }

  async addReactRole(msg) {
    const blocked = await this.guard(msg, 'manage_roles');
    if (blocked) return msg.reply(blocked);
    const text = String(msg.args || '');
    const emoji = /^(\p{Extended_Pictographic}|<a?:\w+:\d+>)/u.exec(text.trim())?.[0];
    if (!emoji) return msg.reply('❌ Start with an emoji: `/reactrole 🎉 @Member`');
    const role = await resolveRole(this.bot, msg.server_id, text.slice(emoji.length));
    if (!role) return msg.reply('❌ Which role? `/reactrole 🎉 @Member`');
    const list = settings.get(msg.server_id, 'reactionRoles', []);
    if (list.some((r) => r.emoji === emoji)) return msg.reply('❌ That emoji is already on the panel.');
    list.push({ emoji, roleId: role.id, label: role.name });
    settings.set(msg.server_id, 'reactionRoles', list);
    return msg.reply(`✅ ${emoji} now gives the **${role.name}** role. Use \`/reactroles\` to post the panel.`);
  }

  async showReactRoles(msg) {
    const list = settings.get(msg.server_id, 'reactionRoles', []);
    if (!list.length) return msg.reply('❌ No roles yet. Use `/reactrole 🎉 @Member` first.');
    const rows = [];
    for (let i = 0; i < list.length; i += 5) {
      rows.push(
        new Row(
          ...list.slice(i, i + 5).map((r) =>
            Button.secondary(r.label, `reactrole:${r.roleId}`).emoji(r.emoji),
          ),
        ),
      );
    }
    const embed = new Embed()
      .title('Reaction roles')
      .description('Press a button to get the role. Press it again to take it away.')
      .color('#5865f2');
    return msg.reply('', { embeds: [embed], components: rows });
  }

  fill(text, ev) {
    return String(text || '')
      .replaceAll('{user}', mention(ev.user_id))
      .replaceAll('{username}', ev.username || '')
      .replaceAll('{server}', ev.server_name || 'the server')
      .replaceAll('{count}', String(ev.member_count ?? '?'));
  }

  async onJoin(ev) {
    if (!settings.get(ev.server_id, 'enabled', true)) return;
    const channelId = settings.get(ev.server_id, 'welcomeChannel');
    if (!channelId) return;
    const roleId = settings.get(ev.server_id, 'autoRole');
    if (roleId) {
      try {
        await this.bot.addRole(ev.server_id, ev.user_id, roleId);
      } catch (e) {
        console.warn('[lucre] could not give the auto role:', e.message);
      }
    }
    const server = await this.bot.server(ev.server_id).catch(() => null);
    const text = this.fill(settings.get(ev.server_id, 'welcomeText'), { ...ev, server_name: server?.name });
    const embed = new Embed()
      .title(`👋 Welcome, ${ev.username || 'friend'}!`)
      .description(text)
      .color('#57f287')
      .footer(`${server?.name || 'New member'}${ev.member_count ? ` • member #${ev.member_count}` : ''}`);
    try {
      await this.bot.send(channelId, '', { embeds: [embed] });
    } catch (e) {
      console.warn('[lucre] could not send the welcome message:', e.message);
    }
  }

  async onLeave(ev) {
    const channelId = settings.get(ev.server_id, 'leaveChannel');
    if (!channelId) return;
    const server = await this.bot.server(ev.server_id).catch(() => null);
    const text = this.fill(settings.get(ev.server_id, 'leaveText'), { ...ev, server_name: server?.name });
    try {
      await this.bot.send(channelId, text);
    } catch (e) {
      console.warn('[lucre] could not send the leave message:', e.message);
    }
  }

  buttons = {
    'reactrole:': async (i) => {
      const roleId = String(i.custom_id).split(':')[1];
      const list = settings.get(i.server_id, 'reactionRoles', []);
      const entry = list.find((r) => r.roleId === roleId);
      if (!entry) return i.ephemeral('❌ That role is not on the panel any more.');
      const member = await this.bot.member(i.server_id, i.user_id).catch(() => null);
      const has = (member?.roles || []).includes(roleId);
      try {
        if (has) await this.bot.removeRole(i.server_id, i.user_id, roleId);
        else await this.bot.addRole(i.server_id, i.user_id, roleId);
      } catch (e) {
        return i.ephemeral(`❌ I could not change your roles: ${e.message}`);
      }
      return i.ephemeral(has ? `Removed **${entry.label}**.` : `You now have **${entry.label}**.`);
    },
  };
}
