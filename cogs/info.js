import { Cog, Embed } from '../yapper.js';
import { allMembers, avatarUrl, mention, nameOf, resolveUser, since, uuid } from '../lib/util.js';

export class Info extends Cog {
  commands = {
    userinfo: { description: 'Information about a member', run: (msg) => this.userInfo(msg) },
    serverinfo: { description: 'Information about this server', run: (msg) => this.serverInfo(msg) },
    channelinfo: { description: 'Information about a channel', run: (msg) => this.channelInfo(msg) },
    roles: { description: 'List the roles of this server', run: (msg) => this.roles(msg) },
    members: { description: 'List the members of this server', run: (msg) => this.members(msg) },
    avatar: { description: 'Show the avatar of someone', run: (msg) => this.avatar(msg) },
    roleinfo: { description: 'Information about a role', run: (msg) => this.roleInfo(msg) },
  };

  async userInfo(msg) {
    const raw = msg.argv[0] || msg.author_id;
    const found = await resolveUser(this.bot, msg.server_id, raw).catch(() => null);
    if (!found) return msg.reply('❌ I could not find that person.');
    const [user, member] = await Promise.all([
      this.bot.user(found.id).catch(() => null),
      this.bot.member(msg.server_id, found.id).catch(() => null),
    ]);
    const profile = user || member || {};
    const pic = avatarUrl(profile);
    const roles = (member?.roles || []).length;
    const embed = new Embed()
      .title(nameOf(profile) || 'Member')
      .color('#5865f2');
    if (pic) embed.thumbnail(pic);
    embed
      .field('Username', `\`${profile.username || 'unknown'}\``, true)
      .field('Display name', `\`${profile.display_name || 'none'}\``, true)
      .field('ID', `\`${found.id}\``, true)
      .field('Joined', member?.joined_at ? since(member.joined_at) : 'unknown', true)
      .field('Roles', `\`${roles}\``, true)
      .field('Nickname', profile.nickname ? `\`${profile.nickname}\`` : 'none', true)
      .field('Avatar', pic ? `[link](${pic})` : 'none', true)
      .footer(`${nameOf(msg.author)} asked for this`);
    return msg.reply('', { embeds: [embed] });
  }

  async serverInfo(msg) {
    const server = await this.bot.server(msg.server_id);
    const channels = await this.bot.channels(msg.server_id);
    const text = channels.filter((c) => c.type === 'text');
    const voice = channels.filter((c) => c.type === 'voice');
    const members = await this.bot.members(msg.server_id).catch(() => []);
    const embed = new Embed()
      .title(server.name || 'This server')
      .color('#57f287')
      .field('Members', `\`${server.member_count ?? members.length}\``, true)
      .field('Channels', `\`${text.length} text, ${voice.length} voice\``, true)
      .field('Owner', `<@${server.owner_id}>`, true)
      .field('ID', `\`${server.id}\``, true)
      .field('Categories', `\`${channels.filter((c) => c.category).length}\``, true)
      .footer(`asked by ${nameOf(msg.author)}`);
    return msg.reply('', { embeds: [embed] });
  }

  async channelInfo(msg) {
    const m = /<#([0-9a-f-]{36})>/i.exec(msg.args || '');
    const channelId = m ? m[1] : msg.channel_id;
    const channel = await this.bot.channel(channelId).catch(() => null);
    if (!channel) return msg.reply('❌ I cannot see that channel.');
    const embed = new Embed()
      .title(`#${channel.name}`)
      .color('#9b59b6')
      .field('Type', `\`${channel.kind || channel.type}\``, true)
      .field('Category', channel.category ? `\`${channel.category.name}\`` : 'none', true)
      .field('Slowmode', channel.slowmode ? `\`${channel.slowmode}s\`` : 'off', true)
      .field('Private', channel.private ? 'yes' : 'no', true)
      .field('Read only', channel.read_only ? 'yes' : 'no', true)
      .field('ID', `\`${channel.id}\``, true);
    return msg.reply('', { embeds: [embed] });
  }

  async roles(msg) {
    const roles = await this.bot.roles(msg.server_id);
    if (!roles.length) return msg.reply('❌ No roles here.');
    const list = roles
      .slice()
      .sort((a, b) => (b.position ?? 0) - (a.position ?? 0))
      .map((r) => `${r.name}${r.color ? ` (\`${r.color}\`)` : ''}`)
      .join('\n');
    const embed = new Embed().title('Roles').description(list.slice(0, 4096)).color('#fee75c').footer(`${roles.length} roles`);
    return msg.reply('', { embeds: [embed] });
  }

  async members(msg) {
    const members = await allMembers(this.bot, msg.server_id);
    if (!members.length) return msg.reply('❌ I cannot see the members here.');
    const list = members
      .slice(0, 30)
      .map((m) => `${nameOf(m)} (\`${m.username}\`)`)
      .join('\n');
    const embed = new Embed()
      .title('Members')
      .description(list)
      .color('#5865f2')
      .footer(`${members.length} members I can see`);
    return msg.reply('', { embeds: [embed] });
  }

  async avatar(msg) {
    const raw = msg.argv[0] || msg.author_id;
    const found = await resolveUser(this.bot, msg.server_id, raw).catch(() => null);
    if (!found) return msg.reply('❌ I could not find that person.');
    const user = await this.bot.user(found.id).catch(() => null);
    const pic = avatarUrl(user);
    if (!pic) return msg.reply(`${mention(found.id)} has no avatar.`);
    const embed = new Embed().title(`${nameOf(user) || 'Avatar'}`).image(pic).color('#5865f2');
    return msg.reply('', { embeds: [embed] });
  }

  async roleInfo(msg) {
    const id = uuid(msg.args || '');
    const roles = await this.bot.roles(msg.server_id);
    const role = id ? roles.find((r) => r.id === id) : roles.find((r) => r.name.toLowerCase() === String(msg.args || '').trim().toLowerCase());
    if (!role) return msg.reply('❌ I could not find that role.');
    const embed = new Embed()
      .title(role.name)
      .color(role.color && /^#?[0-9a-f]{6}$/i.test(role.color) ? role.color : '#5865f2')
      .field('ID', `\`${role.id}\``, true)
      .field('Position', `\`${role.position}\``, true)
      .field('Colour', role.color ? `\`${role.color}\`` : 'none', true)
      .field('Manage messages', role.manage_messages ? 'yes' : 'no', true)
      .field('Manage server', role.manage_server ? 'yes' : 'no', true);
    return msg.reply('', { embeds: [embed] });
  }
}
