import { Cog, Embed, Row, Button } from '../yapper.js';
import { store } from '../lib/store.js';
import { hasPerm, memberPerms } from '../lib/permissions.js';
import { chunk } from '../lib/util.js';

const counters = store('counters', {});
const polls = store('polls', {});

export class Tools extends Cog {
  commands = {
    poll: { description: 'Make a poll: /poll Question | A | B | C', run: (msg) => this.poll(msg) },
    count: { description: 'Start counting in this channel', run: (msg) => this.count(msg) },
    stopcount: { description: 'Stop the counting', run: (msg) => this.stopCount(msg) },
    embed: { description: 'Post a card: /embed Title | Text | Footer', run: (msg) => this.embed(msg) },
  };

  on = {
    message: (msg) => this.onMessage(msg),
  };

  async guard(msg, perm) {
    const actor = await memberPerms(this.bot, msg.server_id, msg.author_id);
    if (!hasPerm(actor.perms, perm)) return `❌ You need the **${perm.replace(/_/g, ' ')}** permission.`;
    return null;
  }

  pollRows(options) {
    const rows = [];
    for (const group of chunk(options, 5)) {
      rows.push(
        new Row(
          ...group.map((label, i) => {
            const index = options.indexOf(label);
            return Button.secondary(label.slice(0, 80), `poll:${index}`).emoji('🗳️');
          }),
        ),
      );
    }
    return rows;
  }

  async poll(msg) {
    const parts = String(msg.args || '')
      .split('|')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length < 2) return msg.reply('❌ Give a question and at least two options: `/poll Pizza? | yes | no`');
    const question = parts.shift();
    const options = parts.slice(0, 5);
    const embed = new Embed()
      .title('📊 Poll')
      .description(`**${question}**`)
      .field('Options', options.map((o, i) => `${i + 1}. ${o}`).join('\n'))
      .color('#5865f2')
      .footer('press a button to vote');
    let sent = null;
    try {
      sent = await msg.reply('', { embeds: [embed], components: this.pollRows(options) });
    } catch (e) {
      return;
    }
    if (sent?.id) {
      const all = polls.getServer(msg.channel_id);
      all[sent.id] = { question, options, votes: {} };
      polls.replace(msg.channel_id, all);
    }
    return sent;
  }

  async count(msg) {
    const blocked = await this.guard(msg, 'manage_messages');
    if (blocked) return msg.reply(blocked);
    const state = { next: 1, messageId: null };
    const embed = new Embed()
      .title('🔢 Counting')
      .description('Send the numbers in order, starting with **1**.')
      .color('#57f287')
      .footer('next: 1');
    let sent = null;
    try {
      sent = await msg.reply('', { embeds: [embed] });
    } catch (e) {
      return;
    }
    state.messageId = sent?.id || null;
    const all = counters.getServer(msg.server_id);
    all[msg.channel_id] = state;
    counters.replace(msg.server_id, all);
    return sent;
  }

  async stopCount(msg) {
    const blocked = await this.guard(msg, 'manage_messages');
    if (blocked) return msg.reply(blocked);
    const all = counters.getServer(msg.server_id);
    delete all[msg.channel_id];
    counters.replace(msg.server_id, all);
    return msg.reply('🛑 Counting stopped.');
  }

  counterEmbed(state, wrong) {
    const embed = new Embed().title('🔢 Counting');
    if (wrong) {
      embed.description(`**${wrong}** is not the right number, we start over at **1**.`).color('#ed4245').footer('next: 1');
    } else {
      embed.description('Send the numbers in order, starting with **1**.').color('#57f287').footer(`next: ${state.next}`);
    }
    return embed;
  }

  async onMessage(msg) {
    const all = counters.getServer(msg.server_id);
    const state = all[msg.channel_id];
    if (!state || msg.command) return;
    const content = String(msg.content || '').trim();
    const wrong = content === String(state.next) ? null : content || '(empty message)';
    if (!wrong) state.next += 1;
    else state.next = 1;
    if (state.messageId) {
      await this.bot.edit(msg.channel_id, state.messageId, null, { embeds: [this.counterEmbed(state, wrong)] }).catch(() => {});
    }
    counters.replace(msg.server_id, all);
  }

  async embed(msg) {
    const blocked = await this.guard(msg, 'manage_messages');
    if (blocked) return msg.reply(blocked);
    const parts = String(msg.args || '').split('|').map((p) => p.trim());
    if (!parts[0]) return msg.reply('❌ Give a title: `/embed Title | Text | Footer`');
    const embed = new Embed()
      .title(parts[0].slice(0, 256))
      .description((parts[1] || ' ').slice(0, 4096))
      .color('#5865f2');
    if (parts[2]) embed.footer(parts[2].slice(0, 2048));
    return msg.reply('', { embeds: [embed] });
  }

  buttons = {
    'poll:': (i) => {
      const index = Number(String(i.custom_id).split(':')[1]);
      const all = polls.getServer(i.channel_id);
      const poll = all[i.message_id];
      if (!poll) return i.ephemeral('❌ This poll is gone.');
      const votes = poll.votes || {};
      const had = votes[i.user_id] !== undefined;
      if (had) delete votes[i.user_id];
      else votes[i.user_id] = index;
      poll.votes = votes;
      polls.replace(i.channel_id, all);
      const counts = poll.options.map((_, idx) => Object.values(votes).filter((v) => v === idx).length);
      const embed = new Embed()
        .title('📊 Poll')
        .description(`**${poll.question}**`)
        .field(
          'Options',
          poll.options
            .map((o, idx) => `${idx + 1}. ${o} — ${counts[idx]} vote(s)${votes[i.user_id] === idx ? ' ← you' : ''}`)
            .join('\n'),
        )
        .color('#5865f2')
        .footer(`${Object.keys(votes).length} vote(s) • press a button to vote`);
      return i.update({ embeds: [embed], components: this.pollRows(poll.options) });
    },
  };
}
