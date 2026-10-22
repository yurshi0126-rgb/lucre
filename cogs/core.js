import { Cog, Embed, Row, Button } from '../yapper.js';
import { chunk, cogName, duration, truncate } from '../lib/util.js';

const GROUPS_PER_PAGE = 7;

export class Core extends Cog {
  commands = {
    help: { description: 'List all commands', run: (msg) => this.cmdHelp(msg) },
    ping: { description: 'Check that Lucre is alive', run: (msg) => this.cmdPing(msg) },
    about: { description: 'About Lucre', run: (msg) => this.cmdAbout(msg) },
    stats: { description: 'Statistics of Lucre', run: (msg) => this.cmdStats(msg) },
    invite: { description: 'How to add Lucre to a server', run: (msg) => this.cmdInvite(msg) },
  };

  constructor(bot) {
    super(bot);
    this.startedAt = Date.now();
  }

  /** Every command, grouped by the cog that added it. */
  groups() {
    const map = new Map();
    for (const [name, cmd] of this.bot.commands) {
      const key = cogName(cmd.owner);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push([name, cmd.description || '']);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }

  pages() {
    return chunk(this.groups(), GROUPS_PER_PAGE);
  }

  pageEmbed(page, index, total) {
    const embed = new Embed()
      .title('Lucre commands')
      .description('Everything I can do. Add a group name to `/help core` for just that one.')
      .color('#5865f2')
      .footer(`page ${index + 1}/${total} • ${this.bot.commands.size} commands`);
    for (const [group, list] of page) {
      const lines = list.map(([n, d]) => `\`/${n}\` — ${d || 'no description'}`).join('\n');
      embed.field(group, truncate(lines, 1024));
    }
    return embed;
  }

  async cmdHelp(msg) {
    const wanted = String(msg.args || '').trim().toLowerCase();
    const groups = this.groups();
    if (wanted) {
      const hit = groups.find(([g]) => g.toLowerCase() === wanted) || groups.find(([g]) => g.toLowerCase().includes(wanted));
      if (!hit) return msg.reply(`No group called **${truncate(wanted, 40)}**. Try: ${groups.map(([g]) => `\`${g}\``).join(', ')}`);
      const embed = new Embed()
        .title(`${hit[0]} commands`)
        .color('#5865f2')
        .description(hit[1].map(([n, d]) => `\`/${n}\` — ${d || 'no description'}`).join('\n'));
      return msg.reply('', { embeds: [embed] });
    }
    const pages = this.pages();
    const rows = [];
    if (pages.length > 1) {
      rows.push(
        new Row(
          Button.secondary('◀', `help:page:${pages.length - 1}`).emoji('⬅️'),
          Button.secondary('▶', `help:page:${1 % pages.length}`).emoji('➡️'),
        ),
      );
    }
    return msg.reply('', { embeds: [this.pageEmbed(pages[0], 0, pages.length)], components: rows });
  }

  async cmdPing(msg) {
    const before = Date.now();
    await this.bot.api('GET', '/me');
    const api = Date.now() - before;
    const started = Date.now() - this.startedAt;
    const embed = new Embed()
      .title('Pong!')
      .color('#57f287')
      .field('API latency', `\`${api} ms\``, true)
      .field('Uptime', `\`${duration(started)}\``, true)
      .field('Servers', `\`${(await this.bot.servers().catch(() => [])).length}\``, true)
      .footer('Lucre is awake.');
    return msg.reply('', { embeds: [embed] });
  }

  async cmdAbout(msg) {
    const me = this.bot.me || {};
    const servers = await this.bot.servers().catch(() => []);
    const embed = new Embed()
      .title('About Lucre')
      .description(me.bio || 'A Yapper bot.')
      .color('#9b59b6')
      .field('Name', `**${me.display_name || me.username || 'Lucre'}**`, true)
      .field('Version', `**1.0.0**`, true)
      .field('Servers', `**${servers.length}**`, true)
      .field('Commands', `**${this.bot.commands.size}**`, true)
      .field('Uptime', `**${duration(Date.now() - this.startedAt)}**`, true)
      .field('Library', 'yapper.js', true)
      .footer('Built with the Yapper bot SDK.');
    return msg.reply('', { embeds: [embed] });
  }

  async cmdStats(msg) {
    const mem = process.memoryUsage();
    const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
    const servers = await this.bot.servers().catch(() => []);
    let channels = 0;
    for (const s of servers) channels += (await this.bot.channels(s.id).catch(() => [])).length;
    const embed = new Embed()
      .title('Lucre statistics')
      .color('#e67e22')
      .field('Servers', `\`${servers.length}\``, true)
      .field('Channels', `\`${channels}\``, true)
      .field('Commands', `\`${this.bot.commands.size}\``, true)
      .field('Cogs', `\`${this.bot.cogs.size}\``, true)
      .field('Uptime', `\`${duration(Date.now() - this.startedAt)}\``, true)
      .field('Node', `\`${process.version}\``, true)
      .field('Memory', `\`${mb(mem.heapUsed)} / ${mb(mem.rss)}\``, true)
      .field('Platform', `\`${process.platform}\``, true);
    return msg.reply('', { embeds: [embed] });
  }

  async cmdInvite(msg) {
    const me = this.bot.me || {};
    const servers = await this.bot.servers().catch(() => []);
    const embed = new Embed()
      .title('Add Lucre to your server')
      .color('#5865f2')
      .description(
        servers.length
          ? 'Lucre is already in one of your servers. To add it elsewhere: **Server settings → Bots → Your bots → Add**.'
          : 'In Yapper open **Settings → Developer → your bot → Add to server** (your own servers work right away).'
      )
      .field('Bot id', `\`${me.id || 'unknown'}\``, true)
      .field('Username', `\`${me.username || 'unknown'}\``, true)
      .footer('Owner of this bot can publish it to the community bots list.');
    return msg.reply('', { embeds: [embed] });
  }

  buttons = {
    'help:page:': (i) => {
      const pages = this.pages();
      const index = Math.min(Math.max(Number(String(i.custom_id).split(':')[2]) || 0, 0), pages.length - 1);
      const rows = [];
      if (pages.length > 1) {
        rows.push(
          new Row(
            Button.secondary('◀', `help:page:${(index - 1 + pages.length) % pages.length}`).emoji('⬅️'),
            Button.secondary('▶', `help:page:${(index + 1) % pages.length}`).emoji('➡️'),
          ),
        );
      }
      return i.update({ embeds: [this.pageEmbed(pages[index], index, pages.length)], components: rows });
    },
  };
}
