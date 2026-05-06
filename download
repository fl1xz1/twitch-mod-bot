# 🎮 Twitch Mod Bot

A Discord bot that checks your Twitch moderators and auto-assigns them a Discord role.

## Commands
| Command | What it does |
|---|---|
| `!verify <twitchname>` | Mods run this once — bot checks Twitch API and gives them the role |
| `!mods` | Lists all your Twitch mods + who's verified in Discord |
| `!ismod <twitchname>` | Check if someone is a mod on your Twitch |
| `!bothelp` | Shows all commands |

---

## Setup Guide

### Step 1 — Create a Discord Bot
1. Go to https://discord.com/developers/applications
2. Click **New Application** → name it anything
3. Go to **Bot** tab → click **Add Bot**
4. Under **Privileged Gateway Intents**, enable:
   - ✅ Server Members Intent
   - ✅ Message Content Intent
5. Copy your **Bot Token** (you'll need this later)
6. Go to **OAuth2 → URL Generator**
   - Scopes: `bot`
   - Bot Permissions: `Manage Roles`, `Send Messages`, `Read Message History`, `View Channels`
7. Open the generated URL and invite the bot to your server

### Step 2 — Get Twitch API Credentials
1. Go to https://dev.twitch.tv/console
2. Click **Register Your Application**
   - Name: anything (e.g. "MyModBot")
   - OAuth Redirect URL: `http://localhost`
   - Category: **Chat Bot**
3. Click **Manage** → copy your **Client ID**
4. Click **New Secret** → copy your **Client Secret**

### Step 3 — Deploy to Railway (free, 24/7)
1. Push this folder to a **GitHub repo** (can be private)
2. Go to https://railway.app and sign up (free)
3. Click **New Project → Deploy from GitHub repo** → pick your repo
4. Go to your project's **Variables** tab and add:
   ```
   DISCORD_TOKEN        = (your Discord bot token)
   TWITCH_CLIENT_ID     = (your Twitch client ID)
   TWITCH_CLIENT_SECRET = (your Twitch client secret)
   TWITCH_CHANNEL_NAME  = (your Twitch username, lowercase)
   MOD_ROLE_NAME        = Twitch Mod
   ```
5. Railway will auto-deploy and your bot will be live 24/7!

### Step 4 — Discord Server Setup
- Make sure the bot's role is **above** the "Twitch Mod" role in your server's role list
  - Server Settings → Roles → drag the bot's role above "Twitch Mod"

---

## Tell Your Mods
Once deployed, have your Twitch mods type this in your Discord:
```
!verify theirTwitchUsername
```
The bot will check if they're actually a mod on your channel and give them the role automatically!
