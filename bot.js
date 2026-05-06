const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// Simple JSON file to persist verified users between restarts
const DB_FILE = './verified_users.json';

function loadDB() {
  if (!fs.existsSync(DB_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return {}; }
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// Get Twitch app access token (client credentials flow)
async function getTwitchToken() {
  const res = await axios.post('https://id.twitch.tv/oauth2/token', null, {
    params: {
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials',
    },
  });
  return res.data.access_token;
}

// Check if a Twitch username is a mod on your channel
async function isTwitchMod(twitchUsername) {
  try {
    const token = await getTwitchToken();
    const headers = {
      'Client-ID': process.env.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${token}`,
    };

    // Get user ID for the provided username
    const userRes = await axios.get('https://api.twitch.tv/helix/users', {
      headers,
      params: { login: twitchUsername.toLowerCase() },
    });
    if (!userRes.data.data.length) return { valid: false, reason: 'Twitch user not found.' };
    const userId = userRes.data.data[0].id;

    // Get the broadcaster's user ID
    const broadcasterRes = await axios.get('https://api.twitch.tv/helix/users', {
      headers,
      params: { login: process.env.TWITCH_CHANNEL_NAME.toLowerCase() },
    });
    if (!broadcasterRes.data.data.length) return { valid: false, reason: 'Broadcaster not found. Check TWITCH_CHANNEL_NAME.' };
    const broadcasterId = broadcasterRes.data.data[0].id;

    // Check moderators list
    const modRes = await axios.get('https://api.twitch.tv/helix/moderation/moderators', {
      headers,
      params: { broadcaster_id: broadcasterId, user_id: userId },
    });

    const isMod = modRes.data.data.length > 0;
    return { valid: true, isMod };
  } catch (err) {
    console.error('Twitch API error:', err.response?.data || err.message);
    return { valid: false, reason: 'Twitch API error. Check your credentials.' };
  }
}

// Get all Twitch mods for your channel
async function getAllTwitchMods() {
  try {
    const token = await getTwitchToken();
    const headers = {
      'Client-ID': process.env.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${token}`,
    };

    const broadcasterRes = await axios.get('https://api.twitch.tv/helix/users', {
      headers,
      params: { login: process.env.TWITCH_CHANNEL_NAME.toLowerCase() },
    });
    const broadcasterId = broadcasterRes.data.data[0].id;

    let mods = [];
    let cursor = null;
    do {
      const params = { broadcaster_id: broadcasterId, first: 100 };
      if (cursor) params.after = cursor;
      const res = await axios.get('https://api.twitch.tv/helix/moderation/moderators', { headers, params });
      mods = mods.concat(res.data.data);
      cursor = res.data.pagination?.cursor;
    } while (cursor);

    return mods.map(m => m.user_name);
  } catch (err) {
    console.error('Twitch API error:', err.response?.data || err.message);
    return null;
  }
}

client.once('ready', () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const content = message.content.trim();
  const prefix = '!';

  if (!content.startsWith(prefix)) return;

  const args = content.slice(prefix.length).trim().split(/\s+/);
  const command = args[0].toLowerCase();

  // ── !verify <twitchname> ──────────────────────────────────────────────────
  if (command === 'verify') {
    const twitchName = args[1];
    if (!twitchName) {
      return message.reply('Usage: `!verify <your_twitch_username>`');
    }

    await message.reply('⏳ Checking Twitch... one sec!');

    const result = await isTwitchMod(twitchName);

    if (!result.valid) {
      return message.reply(`❌ ${result.reason}`);
    }

    if (!result.isMod) {
      return message.reply(`❌ **${twitchName}** is not a moderator on **${process.env.TWITCH_CHANNEL_NAME}**'s channel.`);
    }

    // Find or create the Twitch Mod role
    let modRole = message.guild.roles.cache.find(r => r.name === process.env.MOD_ROLE_NAME || 'Twitch Mod');
    if (!modRole) {
      try {
        modRole = await message.guild.roles.create({
          name: process.env.MOD_ROLE_NAME || 'Twitch Mod',
          color: '#9146FF', // Twitch purple
          reason: 'Auto-created by Twitch Mod Bot',
        });
      } catch {
        return message.reply('❌ I couldn\'t create the mod role. Make sure I have **Manage Roles** permission!');
      }
    }

    try {
      await message.member.roles.add(modRole);
    } catch {
      return message.reply('❌ I couldn\'t assign the role. Make sure my role is **above** the Twitch Mod role in server settings!');
    }

    // Save to DB
    const db = loadDB();
    db[message.author.id] = {
      discordTag: message.author.tag,
      twitchName,
      verifiedAt: new Date().toISOString(),
    };
    saveDB(db);

    const embed = new EmbedBuilder()
      .setColor('#9146FF')
      .setTitle('✅ Verified Twitch Mod!')
      .setDescription(`<@${message.author.id}> has been verified as a mod for **${process.env.TWITCH_CHANNEL_NAME}** on Twitch!`)
      .addFields({ name: 'Twitch Username', value: twitchName, inline: true })
      .setFooter({ text: 'Powered by Twitch API' });

    return message.channel.send({ embeds: [embed] });
  }

  // ── !mods ─────────────────────────────────────────────────────────────────
  if (command === 'mods') {
    await message.reply('⏳ Fetching mods from Twitch...');

    const twitchMods = await getAllTwitchMods();
    if (!twitchMods) {
      return message.reply('❌ Couldn\'t fetch mods from Twitch. Check bot credentials.');
    }

    const db = loadDB();
    const verifiedDiscord = Object.entries(db).map(([discordId, data]) => ({
      discordId,
      twitchName: data.twitchName,
      discordTag: data.discordTag,
    }));

    const embed = new EmbedBuilder()
      .setColor('#9146FF')
      .setTitle(`🛡️ Mods for ${process.env.TWITCH_CHANNEL_NAME}`)
      .setDescription(`**${twitchMods.length}** mod(s) on Twitch`)
      .addFields(
        {
          name: '📋 All Twitch Mods',
          value: twitchMods.length ? twitchMods.map(m => `• ${m}`).join('\n').slice(0, 1020) : 'None',
        },
        {
          name: '✅ Verified in Discord',
          value: verifiedDiscord.length
            ? verifiedDiscord.map(v => `• <@${v.discordId}> → \`${v.twitchName}\``).join('\n').slice(0, 1020)
            : 'No mods have verified yet. Tell them to run `!verify <twitchname>`!',
        }
      )
      .setFooter({ text: 'Mods verify with: !verify <twitchname>' });

    return message.channel.send({ embeds: [embed] });
  }

  // ── !ismod <twitchname> ───────────────────────────────────────────────────
  if (command === 'ismod') {
    const twitchName = args[1];
    if (!twitchName) return message.reply('Usage: `!ismod <twitch_username>`');

    await message.reply(`⏳ Checking if **${twitchName}** is a mod...`);
    const result = await isTwitchMod(twitchName);

    if (!result.valid) return message.reply(`❌ ${result.reason}`);

    if (result.isMod) {
      return message.reply(`✅ **${twitchName}** IS a mod on **${process.env.TWITCH_CHANNEL_NAME}**!`);
    } else {
      return message.reply(`❌ **${twitchName}** is NOT a mod on **${process.env.TWITCH_CHANNEL_NAME}**.`);
    }
  }

  // ── !bothelp ──────────────────────────────────────────────────────────────
  if (command === 'bothelp') {
    const embed = new EmbedBuilder()
      .setColor('#9146FF')
      .setTitle('🤖 Twitch Mod Bot — Commands')
      .addFields(
        { name: '`!verify <twitchname>`', value: 'Verify you\'re a Twitch mod & get the Discord role' },
        { name: '`!mods`', value: 'List all Twitch mods + who\'s verified in Discord' },
        { name: '`!ismod <twitchname>`', value: 'Check if a specific Twitch user is a mod' },
        { name: '`!bothelp`', value: 'Show this help message' }
      )
      .setFooter({ text: `Linked to: twitch.tv/${process.env.TWITCH_CHANNEL_NAME}` });

    return message.channel.send({ embeds: [embed] });
  }
});

client.login(process.env.DISCORD_TOKEN);
