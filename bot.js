import { Bot } from './yapper.js';
import { config } from './lib/config.js';
import { flushAll } from './lib/store.js';

if (!config.token) {
  console.error('[lucre] No token found. Put it in config.json ("token") or set YAPPER_BOT_TOKEN.');
  process.exit(1);
}

const bot = new Bot(config.token, {
  prefixes: config.prefixes,
  log: true,
});

bot.on('error', (e) => {
  console.error(`[lucre] ${e?.cog ? `[${e.cog}${e.where ? ` ${e.where}` : ''}] ` : ''}${e?.message || e}`);
});

await bot.loadCogs('./cogs');

bot.on('ready', async (me) => {
  console.log(`[lucre] online as ${me.display_name || me.username} (${me.id})`);
  try {
    await bot.setStatus(config.status.state, config.status.activity);
    if (config.bio) await bot.setProfile({ displayName: config.name, bio: config.bio });
  } catch (e) {
    console.warn('[lucre] could not set profile/status:', e.message);
  }
  const servers = await bot.servers().catch(() => []);
  console.log(`[lucre] in ${servers.length} server(s). Add me with Settings → Developer → ${me.display_name || me.username}.`);
});

const shutdown = (signal) => {
  console.log(`[lucre] ${signal} - saving and stopping…`);
  try {
    flushAll();
  } catch (e) {
    console.error('[lucre] could not save data:', e.message);
  }
  bot.stop();
  setTimeout(() => process.exit(0), 300).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (e) => console.error('[lucre] unhandled rejection:', e?.message || e));
process.on('uncaughtException', (e) => console.error('[lucre] uncaught exception:', e?.stack || e));

bot.start().catch((e) => {
  console.error('[lucre] could not start:', e?.message || e);
  process.exit(1);
});
