# Battlefield 6 Discord Tracker Bot

A Discord.js bot that persistently tracks and posts Battlefield 6 player statistics to a Discord channel using the [GameTools Network API](https://api.gametools.network/docs#/Battlefield%206/bf6stats_bf6_stats__get).

## Features

- 🎮 Automatically fetches player stats from GameTools Network API
- 📊 Posts beautifully formatted Discord embeds with player statistics
- ⏰ Configurable update intervals (default: 1 hour)
- 🔄 Tracks multiple players across different platforms
- 💾 Only posts when stats have changed (prevents spam)
- 🔍 Search for players by name and get their IDs
- ➕ Add/remove players dynamically via Discord commands
- 💾 Persistent storage of tracked players (survives bot restarts)

## Prerequisites

- Node.js 16.9.0 or higher
- A Discord Bot Token ([How to create a Discord bot](https://discord.com/developers/applications))
- A Discord server where you can invite the bot

## Installation

1. **Clone or download this repository**

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   - Copy `.env.example` to `.env`
   - Fill in your Discord bot token and channel ID

   ```env
   DISCORD_BOT_TOKEN=your_bot_token_here
   CHANNEL_ID=your_channel_id_here
   UPDATE_INTERVAL=3600000
   ```

   **Note:** Players are now added via Discord commands (`!search` and `!track`), not in the `.env` file!

## Configuration

### Getting Your Discord Bot Token

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application or select an existing one
3. Navigate to the "Bot" section
4. Click "Reset Token" and copy the token
5. **⚠️ IMPORTANT:** Scroll down to "Privileged Gateway Intents" section
6. **Enable "MESSAGE CONTENT INTENT"** - This is REQUIRED for the bot to read commands!
7. Save changes

**Note:** If you see "Used disallowed intents" error, you haven't enabled the Message Content Intent. The bot needs this to read and respond to commands like `!search` and `!track`.

### Getting Your Channel ID

1. Enable Developer Mode in Discord (User Settings → Advanced → Developer Mode)
2. Right-click on the channel where you want stats posted
3. Click "Copy ID"

### Adding Players to Track

Players are added via Discord commands (see **Usage** section below). The bot will automatically save tracked players to `trackedPlayers.json`.

**Platform options:**
- `pc` - PC/Steam/Origin
- `xbox` - Xbox One/Series
- `psn` - PlayStation 4/5

### Update Interval

Set `UPDATE_INTERVAL` in milliseconds:
- `3600000` = 1 hour (default)
- `1800000` = 30 minutes
- `600000` = 10 minutes
- `300000` = 5 minutes

⚠️ **Note:** Be mindful of API rate limits. Don't set intervals too low.

## Usage

1. **Start the bot:**
   ```bash
   npm start
   ```

2. **The bot will:**
   - Post stats immediately on startup
   - Continue posting at the configured interval
   - Only post when stats have changed

3. **Available Commands:**
   - `!search <playername>` - Search for players by name and get their IDs
   - `!track <ID>` - Add a player to tracking using their player ID
   - `!list` - List all currently tracked players
   - `!untrack <ID>` - Remove a player from tracking
   - `!update` or `!bf6update` - Manually trigger a stats update
   - `!help` or `!bf6help` - Show help message

**Example Usage:**
```
!search PlayerName123
!track 1234567890
!list
!untrack 1234567890
```

## API Reference

This bot uses the [GameTools Network API](https://api.gametools.network/docs#/Battlefield%206/bf6stats_bf6_stats__get) for Battlefield 6 statistics.

**Endpoint:** `GET https://api.gametools.network/bf6/stats`

**Parameters:**
- `name` - Player username (required)
- `platform` - Platform: `pc`, `xbox`, or `psn` (required)

## Stats Displayed

The bot displays the following statistics (when available):
- Kills
- Deaths
- K/D Ratio
- Score
- Wins
- Losses
- Win Percentage
- Kills per Minute
- Time Played
- Rank
- Score per Minute

## Hosting

For persistent operation, consider hosting on:
- **Heroku** - Free tier available
- **DigitalOcean** - VPS hosting
- **Railway** - Easy deployment
- **Replit** - Free hosting option
- **Your own server** - Full control

### Using PM2 (Recommended for VPS)

```bash
npm install -g pm2
pm2 start index.js --name bf6-tracker
pm2 save
pm2 startup
```

## Troubleshooting

**"Used disallowed intents" Error:**
- This error means the Message Content Intent is not enabled
- Go to [Discord Developer Portal](https://discord.com/developers/applications) → Your Bot → Bot section
- Scroll to "Privileged Gateway Intents"
- **Enable "MESSAGE CONTENT INTENT"**
- Save changes and restart the bot
- The bot requires this intent to read commands like `!search` and `!track`

**Bot doesn't respond:**
- Check that the bot token is correct
- Ensure "Message Content Intent" is enabled in Discord Developer Portal
- Verify the bot has permission to send messages in the channel
- Make sure the bot is online (check the status in Discord)

**Stats not updating:**
- Verify player names and platforms are correct
- Check API is accessible (visit the API URL in browser)
- Review console logs for errors
- Use `!list` to verify players are being tracked

**Rate limiting:**
- Increase the `UPDATE_INTERVAL` value
- Reduce the number of tracked players
- Add delays between API requests (already implemented)

## License

MIT

## Support

For issues with the GameTools Network API, visit their [documentation](https://api.gametools.network/docs).

