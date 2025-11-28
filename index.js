const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Configuration
const CONFIG = {
    // Channel ID where stats will be posted
    CHANNEL_ID: process.env.CHANNEL_ID,
    // Array of players to track: { name: 'PlayerName', platform: 'pc'|'xbox'|'psn' }
    PLAYERS: JSON.parse(process.env.PLAYERS || '[]'),
    // Update interval in milliseconds (default: 1 hour = 3600000ms)
    UPDATE_INTERVAL: parseInt(process.env.UPDATE_INTERVAL || '3600000'),
    // API base URL
    API_BASE_URL: 'https://api.gametools.network/bf6/stats'
};

// Store last posted stats to avoid duplicate posts
const lastStats = new Map();

/**
 * Fetches player stats from GameTools Network API
 * @param {string} playerName - Player's username
 * @param {string} platform - Platform: 'pc', 'xbox', or 'psn'
 * @returns {Promise<Object|null>} Player stats or null if error
 */
async function fetchPlayerStats(playerName, platform) {
    try {
        const url = `${CONFIG.API_BASE_URL}?name=${encodeURIComponent(playerName)}&platform=${platform}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            console.error(`API Error for ${playerName}: ${response.status} ${response.statusText}`);
            return null;
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`Error fetching stats for ${playerName}:`, error.message);
        return null;
    }
}

/**
 * Creates a Discord embed with player statistics
 * @param {Object} stats - Player stats from API
 * @param {string} playerName - Player's username
 * @param {string} platform - Platform name
 * @returns {EmbedBuilder} Discord embed
 */
function createStatsEmbed(stats, playerName, platform) {
    const embed = new EmbedBuilder()
        .setTitle(`🎮 ${playerName}'s Battlefield 6 Stats`)
        .setColor(0x0099FF)
        .setTimestamp()
        .setFooter({ text: `Platform: ${platform.toUpperCase()}` });

    // Add player ID if available
    if (stats.userName || stats.name) {
        embed.setDescription(`**Player:** ${stats.userName || stats.name}`);
    }

    // Core stats
    const fields = [];

    if (stats.kills !== undefined) {
        fields.push({ name: '💀 Kills', value: stats.kills.toLocaleString(), inline: true });
    }
    if (stats.deaths !== undefined) {
        fields.push({ name: '☠️ Deaths', value: stats.deaths.toLocaleString(), inline: true });
    }
    if (stats.kdRatio !== undefined) {
        fields.push({ name: '📊 K/D Ratio', value: stats.kdRatio.toFixed(2), inline: true });
    }
    if (stats.score !== undefined) {
        fields.push({ name: '⭐ Score', value: stats.score.toLocaleString(), inline: true });
    }
    if (stats.wins !== undefined) {
        fields.push({ name: '🏆 Wins', value: stats.wins.toLocaleString(), inline: true });
    }
    if (stats.losses !== undefined) {
        fields.push({ name: '❌ Losses', value: stats.losses.toLocaleString(), inline: true });
    }
    if (stats.winPercent !== undefined) {
        fields.push({ name: '📈 Win %', value: `${stats.winPercent.toFixed(1)}%`, inline: true });
    }
    if (stats.killsPerMinute !== undefined) {
        fields.push({ name: '⚡ Kills/Min', value: stats.killsPerMinute.toFixed(2), inline: true });
    }
    if (stats.timePlayed !== undefined) {
        const hours = Math.floor(stats.timePlayed / 3600);
        const minutes = Math.floor((stats.timePlayed % 3600) / 60);
        fields.push({ name: '⏱️ Time Played', value: `${hours}h ${minutes}m`, inline: true });
    }
    if (stats.rank !== undefined) {
        fields.push({ name: '🎖️ Rank', value: stats.rank.toString(), inline: true });
    }
    if (stats.scorePerMinute !== undefined) {
        fields.push({ name: '📊 SPM', value: stats.scorePerMinute.toFixed(0), inline: true });
    }

    // Add fields to embed (Discord limit is 25 fields)
    embed.addFields(fields.slice(0, 25));

    // Add thumbnail if available
    if (stats.avatar) {
        embed.setThumbnail(stats.avatar);
    }

    return embed;
}

/**
 * Checks if stats have changed significantly
 * @param {Object} oldStats - Previous stats
 * @param {Object} newStats - Current stats
 * @returns {boolean} True if stats changed
 */
function statsChanged(oldStats, newStats) {
    if (!oldStats) return true;
    
    // Check if key stats changed
    const keyFields = ['kills', 'deaths', 'score', 'wins', 'losses', 'rank'];
    return keyFields.some(field => {
        if (oldStats[field] !== undefined && newStats[field] !== undefined) {
            return oldStats[field] !== newStats[field];
        }
        return false;
    });
}

/**
 * Posts player stats to Discord channel
 * @param {string} playerName - Player's username
 * @param {string} platform - Platform
 */
async function postPlayerStats(playerName, platform) {
    const channel = client.channels.cache.get(CONFIG.CHANNEL_ID);
    if (!channel) {
        console.error(`Channel ${CONFIG.CHANNEL_ID} not found!`);
        return;
    }

    const stats = await fetchPlayerStats(playerName, platform);
    if (!stats) {
        console.error(`Failed to fetch stats for ${playerName}`);
        return;
    }

    // Check if stats have changed
    const playerKey = `${playerName}_${platform}`;
    const lastStatsData = lastStats.get(playerKey);
    
    if (!statsChanged(lastStatsData, stats)) {
        console.log(`No changes detected for ${playerName}, skipping post.`);
        return;
    }

    // Create and send embed
    const embed = createStatsEmbed(stats, playerName, platform);
    
    try {
        await channel.send({ embeds: [embed] });
        console.log(`Posted stats for ${playerName} (${platform})`);
        lastStats.set(playerKey, stats);
    } catch (error) {
        console.error(`Error posting stats for ${playerName}:`, error.message);
    }
}

/**
 * Posts stats for all tracked players
 */
async function postAllStats() {
    if (CONFIG.PLAYERS.length === 0) {
        console.warn('No players configured to track!');
        return;
    }

    console.log(`Posting stats for ${CONFIG.PLAYERS.length} player(s)...`);
    
    for (const player of CONFIG.PLAYERS) {
        await postPlayerStats(player.name, player.platform);
        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

// Bot ready event
client.once('ready', () => {
    console.log(`✅ Bot is online as ${client.user.tag}!`);
    console.log(`📊 Tracking ${CONFIG.PLAYERS.length} player(s)`);
    console.log(`⏰ Update interval: ${CONFIG.UPDATE_INTERVAL / 1000 / 60} minutes`);
    
    // Post stats immediately on startup
    postAllStats();
    
    // Set up interval for persistent posting
    setInterval(postAllStats, CONFIG.UPDATE_INTERVAL);
});

// Command handler (optional - for manual updates)
client.on('messageCreate', async (message) => {
    // Ignore bot messages
    if (message.author.bot) return;
    
    // Manual update command: !bf6update
    if (message.content === '!bf6update') {
        await message.reply('🔄 Updating stats...');
        await postAllStats();
        await message.reply('✅ Stats updated!');
    }
    
    // Help command
    if (message.content === '!bf6help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('🎮 BF6 Tracker Bot Commands')
            .setDescription('Commands for the Battlefield 6 tracker bot')
            .addFields(
                { name: '!bf6update', value: 'Manually trigger stats update', inline: false },
                { name: '!bf6help', value: 'Show this help message', inline: false }
            )
            .setColor(0x0099FF);
        
        await message.reply({ embeds: [helpEmbed] });
    }
});

// Error handling
client.on('error', (error) => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

// Login to Discord
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
    console.error('❌ DISCORD_BOT_TOKEN not found in environment variables!');
    process.exit(1);
}

client.login(token);

