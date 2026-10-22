import { Cog, Embed } from '../yapper.js';
import { pick } from '../lib/util.js';

const JOKES = [
  'Why do programmers prefer dark mode? Because light attracts bugs.',
  'I would tell you a UDP joke, but you might not get it.',
  'There are 10 kinds of people: those who know binary and those who do not.',
  'A SQL query walks into a bar, goes up to two tables and asks: "May I join you?"',
  'Why did the developer go broke? Because he used up all his cache.',
  'I love telling bad jokes to my friends... they love hearing them too.',
  '!false - I am a boolean.',
  'My code does not always work, but when it does I do not want to fix it.',
  'I told my computer I needed a break. Now it will not stop gaming.',
  'Why was the computer cold? It left its Windows open.',
  'A byte walks into a bar looking miserable. The bartender asks: "What is wrong?" The byte says: "Parity error."',
  'I would tell you a joke about recursion, but first you have to hear it twice.',
];

const EIGHT_BALL = [
  'It is certain.', 'Without a doubt.', 'Yes, definitely.', 'You may rely on it.',
  'As I see it, yes.', 'Most likely.', 'Outlook good.', 'Yes.', 'Signs point to yes.',
  'Reply hazy, try again.', 'Ask again later.', 'Better not tell you now.', 'Cannot predict now.',
  'Concentrate and ask again.', 'Do not count on it.', 'My reply is no.', 'My sources say no.',
  'Outlook not so good.', 'Very doubtful.',
];

const TRUTHS = [
  'What is the most embarrassing thing you have done in public?',
  'Who is the person you text the most? Why them?',
  'What is the biggest lie you told to get out of trouble?',
  'What is your most irrational fear?',
  'What is something you have never told anyone?',
  'What is the worst gift you have ever received?',
];

const DARES = [
  'Say the alphabet backwards in 10 seconds.',
  'Change your nickname to something silly for the next hour.',
  'Send the last photo in your camera roll.',
  'Text a friend "I just won 10 dollars" (no follow up).',
  'Do 20 jumping jacks right now.',
  'Let the next person in the channel pick your profile picture.',
  'Say "I love pineapple pizza" out loud in voice chat.',
];

const RATINGS = [
  'Solid choice.', 'Could go either way.', 'Undeniable.', 'You are the judge.',
  'Very good vibes.', 'That is a lot of energy.', 'Bold move.', 'Mid but honest.',
];

const parseDice = (input) => {
  const s = String(input || '').trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return { count: 1, sides: 6, mod: 0 };
  const m = /^(\d*)?d(\d+)([+-]\d+)?$/.exec(s);
  if (m) {
    const count = m[1] === '' || m[1] === undefined ? 1 : Number(m[1]);
    const sides = Number(m[2]);
    const mod = m[3] ? Number(m[3]) : 0;
    if (!Number.isSafeInteger(count) || count < 1 || count > 100) return null;
    if (!Number.isSafeInteger(sides) || sides < 2 || sides > 1000) return null;
    return { count, sides, mod };
  }
  const n = Number(s);
  if (Number.isSafeInteger(n) && n >= 2 && n <= 1000) return { count: 1, sides: n, mod: 0 };
  return null;
};

export class Fun extends Cog {
  commands = {
    roll: {
      description: 'Roll dice, like /roll 2d6 or /roll 20',
      run: (msg) => this.roll(msg),
    },
    coinflip: {
      description: 'Flip a coin',
      run: (msg) => this.coinflip(msg),
    },
    '8ball': {
      description: 'Ask the magic 8-ball something',
      run: (msg) => this.eightBall(msg),
    },
    choose: {
      description: 'Let Lucre pick, like /choose pizza | pasta | salad',
      run: (msg) => this.choose(msg),
    },
    joke: {
      description: 'Tell a joke',
      run: (msg) => this.joke(msg),
    },
    rate: {
      description: 'Rate something out of 10',
      run: (msg) => this.rate(msg),
    },
    truthordare: {
      description: 'Truth or dare',
      run: (msg) => this.truthOrDare(msg),
    },
    fortune: {
      description: 'A fortune for your day',
      run: (msg) => this.fortune(msg),
    },
  };

  async roll(msg) {
    const dice = parseDice(msg.argv[0]);
    if (!dice) return msg.reply('❌ Use `/roll 2d6`, `/roll d20` or `/roll 20` (up to 100 dice, 1000 sides).');
    const rolls = [];
    let total = 0;
    for (let i = 0; i < dice.count; i++) {
      const n = 1 + Math.floor(Math.random() * dice.sides);
      rolls.push(n);
      total += n;
    }
    total += dice.mod;
    const label = `${dice.count}d${dice.sides}${dice.mod ? (dice.mod > 0 ? `+${dice.mod}` : dice.mod) : ''}`;
    const embed = new Embed()
      .title('🎲 Dice roll')
      .color('#5865f2')
      .field(label, rolls.join(' + ') + (dice.mod ? ` ${dice.mod > 0 ? '+' : '-'} ${Math.abs(dice.mod)}` : ''))
      .field('Total', `**${total}**`, true);
    return msg.reply('', { embeds: [embed] });
  }

  async coinflip(msg) {
    const heads = Math.random() < 0.5;
    const embed = new Embed()
      .title(heads ? '🪙 Heads' : '🪙 Tails')
      .description(heads ? 'The coin landed on heads.' : 'The coin landed on tails.')
      .color(heads ? '#fee75c' : '#95a5a6');
    return msg.reply('', { embeds: [embed] });
  }

  async eightBall(msg) {
    const question = String(msg.args || '').trim();
    if (!question) return msg.reply('❌ Ask me something: `/8ball will I win tomorrow?`');
    const answer = pick(EIGHT_BALL);
    const embed = new Embed()
      .title('🎱 Magic 8-ball')
      .description(`**${question}**`)
      .field('Answer', `*${answer}*`)
      .color('#9b59b6');
    return msg.reply('', { embeds: [embed] });
  }

  async choose(msg) {
    const options = String(msg.args || '')
      .split(/\s*\|\s*|\s*,\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (options.length < 2) return msg.reply('❌ Give me at least two options: `/choose pizza | pasta | salad`');
    const choice = pick(options);
    const embed = new Embed()
      .title('🎯 Lucre picks')
      .description(`**${choice}**`)
      .field('Options', options.map((o) => `• ${o}`).join('\n'))
      .color('#57f287');
    return msg.reply('', { embeds: [embed] });
  }

  async joke(msg) {
    return msg.reply(pick(JOKES));
  }

  async rate(msg) {
    const args = String(msg.args || '').trim();
    if (!args) return msg.reply('❌ Rate what? `/rate my cat`');
    const score = 1 + Math.floor(Math.random() * 10);
    const embed = new Embed()
      .title('⭐ Rating')
      .description(`**${args}**`)
      .field('Score', `${score}/10`, true)
      .field('Lucre says', pick(RATINGS), true)
      .color('#fee75c');
    return msg.reply('', { embeds: [embed] });
  }

  async truthOrDare(msg) {
    const want = String(msg.args || '').trim().toLowerCase();
    const truth = want === 'dare' ? false : want === 'truth' ? true : Math.random() < 0.5;
    const text = truth ? pick(TRUTHS) : pick(DARES);
    const embed = new Embed()
      .title(truth ? '🤔 Truth' : '😈 Dare')
      .description(text)
      .color(truth ? '#5865f2' : '#ed4245');
    return msg.reply('', { embeds: [embed] });
  }

  async fortune(msg) {
    const fortunes = [
      'A small step today becomes a big leap tomorrow.',
      'Someone is thinking about you right now.',
      'The best is yet to come, and it is closer than it looks.',
      'You already have the power, use it.',
      'Good things take time, so be patient.',
      'Your next message will be the right one.',
      'Luck favours the prepared, so get ready.',
    ];
    return msg.reply(`🔮 ${pick(fortunes)}`);
  }
}
