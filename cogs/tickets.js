import { Cog, Embed, Row, Button } from '../yapper.js';
import { hasPerm, memberPerms } from '../lib/permissions.js';
import { mention, nameOf } from '../lib/util.js';

export class Tickets extends Cog {
  commands = {
    ticket: { description: 'Open a private ticket', run: (msg) => this.open(msg) },
    close: { description: 'Close this ticket', run: (msg) => this.close(msg) },
    tickets: { description: 'List the open tickets', run: (msg) => this.list(msg) },
  };

  async guard(msg, perm) {
    const actor = await memberPerms(this.bot, msg.server_id, msg.author_id);
    if (!hasPerm(actor.perms, perm)) return `❌ You need the **${perm.replace(/_/g, ' ')}** permission.`;
    return null;
  }

  async open(msg) {
    const blocked = await this.guard(msg, 'manage_channels');
    if (blocked) return msg.reply(blocked);
    const reason = String(msg.args || '').trim() || 'no reason given';
    const name = `ticket-${String(nameOf(msg.author)).replace(/[^\w-]+/g, '').slice(0, 24) || 'user'}-${Date.now().toString(36).slice(-4)}`;
    let channel;
    try {
      channel = await this.bot.createChannel(msg.server_id, name, { kind: 'text' });
    } catch (e) {
      return msg.reply(`❌ I could not open the ticket: ${e.message}`);
    }
    // Let the opener and the bot in, hide the channel from everyone else.
    try {
      const [roles, opener, me] = await Promise.all([
        this.bot.roles(msg.server_id),
        this.bot.member(msg.server_id, msg.author_id).catch(() => null),
        this.bot.member(msg.server_id, this.bot.me.id).catch(() => null),
      ]);
      const roleIds = [...new Set([...(opener?.roles || []), ...(me?.roles || [])])].filter(
        (id) => roles.some((r) => r.id === id),
      );
      await this.bot.editChannel(channel.id, { private: true, roleIds });
    } catch (e) {
      console.warn('[lucre] could not make the ticket private:', e.message);
    }
    const embed = new Embed()
      .title(`🎫 Ticket opened by ${nameOf(msg.author)}`)
      .description(`**Reason:** ${reason}`)
      .color('#5865f2')
      .footer(`ticket #${channel.id}`)
      .timestamp();
    await this.bot.send(channel.id, '', {
      embeds: [embed],
      components: [new Row(Button.danger('Close ticket', `ticket:close:${channel.id}`))],
    });
    return msg.reply(`🎫 Ticket opened: <#${channel.id}> — open it with the link above.`);
  }

  async close(msg) {
    const blocked = await this.guard(msg, 'manage_channels');
    if (blocked) return msg.reply(blocked);
    const m = /<#([0-9a-f-]{36})>/i.exec(msg.args || '');
    const channelId = m ? m[1] : msg.channel_id;
    const channel = await this.bot.channel(channelId).catch(() => null);
    if (!channel) return msg.reply('❌ I cannot see that channel.');
    if (!/^ticket-/i.test(channel.name || '')) return msg.reply('❌ That does not look like a ticket channel.');
    try {
      await this.bot.deleteChannel(channel.id);
    } catch (e) {
      return msg.reply(`❌ I could not close it: ${e.message}`);
    }
    return msg.reply(`🗑️ Ticket <#${channel.id}> closed.`);
  }

  async list(msg) {
    const channels = await this.bot.channels(msg.server_id, { type: 'text' });
    const tickets = channels.filter((c) => /^ticket-/i.test(c.name || ''));
    if (!tickets.length) return msg.reply('No open tickets.');
    const embed = new Embed()
      .title('Open tickets')
      .description(tickets.map((t) => `<#${t.id}>`).join('\n'))
      .color('#5865f2')
      .footer(`${tickets.length} ticket(s)`);
    return msg.reply('', { embeds: [embed] });
  }

  buttons = {
    'ticket:close:': async (i) => {
      const channelId = String(i.custom_id).split(':')[2];
      try {
        await this.bot.deleteChannel(channelId);
      } catch (e) {
        return i.ephemeral(`❌ I could not close the ticket: ${e.message}`);
      }
      return i.ephemeral('🗑️ Ticket closed.');
    },
  };
}
