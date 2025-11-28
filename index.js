const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
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
    // Update interval in milliseconds (default: 1 hour = 3600000ms)
    UPDATE_INTERVAL: parseInt(process.env.UPDATE_INTERVAL || '3600000'),
    // API base URL
    API_BASE_URL: 'https://api.gametools.network/bf6/stats',
    // File to store tracked players
    PLAYERS_FILE: path.join(__dirname, 'trackedPlayers.json')
};

// Store last posted stats to avoid duplicate posts
const lastStats = new Map();

// Tracked players: { personaId: string, name: string, platform: string }
let trackedPlayers = [];

/**
 * Load tracked players from JSON file
 */
function loadTrackedPlayers() {
    try {
        if (fs.existsSync(CONFIG.PLAYERS_FILE)) {
            const data = fs.readFileSync(CONFIG.PLAYERS_FILE, 'utf8');
            trackedPlayers = JSON.parse(data);
            console.log(`Loaded ${trackedPlayers.length} tracked player(s) from file.`);
        } else {
            trackedPlayers = [];
            saveTrackedPlayers(); // Create empty file
        }
    } catch (error) {
        console.error('Error loading tracked players:', error);
        trackedPlayers = [];
    }
}

/**
 * Save tracked players to JSON file
 */
function saveTrackedPlayers() {
    try {
        fs.writeFileSync(CONFIG.PLAYERS_FILE, JSON.stringify(trackedPlayers, null, 2));
    } catch (error) {
        console.error('Error saving tracked players:', error);
    }
}

/**
 * Fetches player stats from GameTools Network API
 * @param {string} playerName - Player's username
 * @param {string} platform - Platform: 'pc', 'xbox', or 'psn'
 * @param {string} personaId - Optional player ID
 * @returns {Promise<Object|null>} Player stats or null if error
 */
async function fetchPlayerStats(playerName, platform, personaId = null) {
    try {
        let url = `${CONFIG.API_BASE_URL}?name=${encodeURIComponent(playerName)}&platform=${platform}`;
        if (personaId) {
            url += `&personaId=${encodeURIComponent(personaId)}`;
        }
        
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
 * Parses a tracker.gg URL to extract player ID
 * @param {string} url - Tracker.gg profile URL
 * @returns {string|null} Player ID or null if invalid
 */
function parseTrackerUrl(url) {
    try {
        // Handle different tracker.gg URL formats:
        // https://tracker.gg/bf6/profile/{playerId}/overview
        // https://tracker.gg/bf6/profile/pc/{playerName}
        // https://tracker.gg/bf6/profile/xbox/{playerName}
        // https://tracker.gg/bf6/profile/psn/{playerName}
        
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(p => p);
        
        // Format: /bf6/profile/{id}/overview or /bf6/profile/{platform}/{name}
        if (pathParts.length >= 3 && pathParts[0] === 'bf6' && pathParts[1] === 'profile') {
            const thirdPart = pathParts[2];
            
            // If third part is a number, it's a player ID
            if (/^\d+$/.test(thirdPart)) {
                return thirdPart;
            }
            
            // Otherwise, it might be platform/name format - we'll need to search
            // But for now, return null and let the search function handle it
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Searches for players by name across all platforms
 * @param {string} playerName - Player's username to search for
 * @returns {Promise<Array>} Array of found players with their IDs
 */
async function searchPlayers(playerName) {
    const platforms = ['pc', 'xbox', 'psn'];
    const results = [];
    
    for (const platform of platforms) {
        try {
            const url = `${CONFIG.API_BASE_URL}?name=${encodeURIComponent(playerName)}&platform=${platform}`;
            const response = await fetch(url);
            
            if (response.ok) {
                const data = await response.json();
                // If we get a valid response with player data, add it to results
                if (data && (data.userName || data.name || data.personaId)) {
                    results.push({
                        name: data.userName || data.name || playerName,
                        personaId: data.personaId || data.id || null,
                        platform: platform,
                        rank: data.rank || null,
                        kills: data.kills || null
                    });
                }
            }
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            // Continue searching other platforms even if one fails
            continue;
        }
    }
    
    return results;
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
 * @param {Object} player - Player object with name, platform, and personaId
 */
async function postPlayerStats(player) {
    const channel = client.channels.cache.get(CONFIG.CHANNEL_ID);
    if (!channel) {
        console.error(`Channel ${CONFIG.CHANNEL_ID} not found!`);
        return;
    }

    const stats = await fetchPlayerStats(player.name, player.platform, player.personaId);
    if (!stats) {
        console.error(`Failed to fetch stats for ${player.name}`);
        return;
    }

    // Check if stats have changed
    const playerKey = player.personaId || `${player.name}_${player.platform}`;
    const lastStatsData = lastStats.get(playerKey);
    
    if (!statsChanged(lastStatsData, stats)) {
        console.log(`No changes detected for ${player.name}, skipping post.`);
        return;
    }

    // Create and send embed
    const embed = createStatsEmbed(stats, player.name, player.platform);
    
    try {
        await channel.send({ embeds: [embed] });
        console.log(`Posted stats for ${player.name} (${player.platform})`);
        lastStats.set(playerKey, stats);
    } catch (error) {
        console.error(`Error posting stats for ${player.name}:`, error.message);
    }
}

/**
 * Posts stats for all tracked players
 */
async function postAllStats() {
    if (trackedPlayers.length === 0) {
        console.warn('No players configured to track!');
        return;
    }

    console.log(`Posting stats for ${trackedPlayers.length} player(s)...`);
    
    for (const player of trackedPlayers) {
        await postPlayerStats(player);
        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

// Bot ready event
client.once('ready', () => {
    console.log(`✅ Bot is online as ${client.user.tag}!`);
    loadTrackedPlayers();
    console.log(`📊 Tracking ${trackedPlayers.length} player(s)`);
    console.log(`⏰ Update interval: ${CONFIG.UPDATE_INTERVAL / 1000 / 60} minutes`);
    
    // Post stats immediately on startup
    postAllStats();
    
    // Set up interval for persistent posting
    setInterval(postAllStats, CONFIG.UPDATE_INTERVAL);
});

// Save tracked players on shutdown
process.on('exit', saveTrackedPlayers);
process.on('SIGINT', () => {
    saveTrackedPlayers();
    process.exit();
});
process.on('SIGTERM', () => {
    saveTrackedPlayers();
    process.exit();
});

// Command handler
client.on('messageCreate', async (message) => {
    // Ignore bot messages
    if (message.author.bot) return;
    
    const content = message.content.trim();
    
    // Search command: !search playername
    if (content.startsWith('!search ')) {
        const playerName = content.slice(8).trim();
        if (!playerName) {
            return message.reply('❌ Please provide a player name to search for.\nUsage: `!search PlayerName`');
        }
        
        await message.reply(`🔍 Searching for players matching "${playerName}"...`);
        
        const results = await searchPlayers(playerName);
        
        if (results.length === 0) {
            return message.reply(`❌ No players found matching "${playerName}"`);
        }
        
        const embed = new EmbedBuilder()
            .setTitle(`🔍 Search Results for "${playerName}"`)
            .setDescription(`Found ${results.length} player(s):`)
            .setColor(0x0099FF)
            .setTimestamp();
        
        // Add each result as a field
        results.forEach((player, index) => {
            const playerInfo = [];
            playerInfo.push(`**Platform:** ${player.platform.toUpperCase()}`);
            if (player.personaId) {
                playerInfo.push(`**ID:** \`${player.personaId}\``);
            }
            if (player.rank !== null) {
                playerInfo.push(`**Rank:** ${player.rank}`);
            }
            if (player.kills !== null) {
                playerInfo.push(`**Kills:** ${player.kills.toLocaleString()}`);
            }
            
            embed.addFields({
                name: `${index + 1}. ${player.name}`,
                value: playerInfo.join('\n'),
                inline: false
            });
        });
        
        embed.setFooter({ text: 'Use !track <ID> to add a player to tracking' });
        
        await message.reply({ embeds: [embed] });
        return;
    }
    
    // Add command: !add tracker.gg URL
    if (content.startsWith('!add ')) {
        const url = content.slice(5).trim();
        if (!url) {
            return message.reply('❌ Please provide a tracker.gg URL.\nUsage: `!add https://tracker.gg/bf6/profile/2481313248/overview`');
        }
        
        // Parse the tracker.gg URL to extract player ID
        const playerId = parseTrackerUrl(url);
        
        if (!playerId) {
            return message.reply('❌ Invalid tracker.gg URL format.\nExpected format: `https://tracker.gg/bf6/profile/{playerID}/overview`\nExample: `!add https://tracker.gg/bf6/profile/2481313248/overview`');
        }
        
        await message.reply(`🔍 Looking up player with ID ${playerId}...`);
        
        // Search for the player with this ID across all platforms
        let foundPlayer = null;
        const platforms = ['pc', 'xbox', 'psn'];
        
        for (const platform of platforms) {
            try {
                const apiUrl = `${CONFIG.API_BASE_URL}?personaId=${encodeURIComponent(playerId)}&platform=${platform}`;
                const response = await fetch(apiUrl);
                
                if (response.ok) {
                    const data = await response.json();
                    if (data && (data.userName || data.name || data.personaId)) {
                        foundPlayer = {
                            name: data.userName || data.name || 'Unknown',
                            personaId: data.personaId || data.id || playerId,
                            platform: platform
                        };
                        break;
                    }
                }
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                continue;
            }
        }
        
        if (!foundPlayer) {
            return message.reply(`❌ Could not find player with ID "${playerId}" on any platform.\nMake sure the tracker.gg URL is correct and the player exists.`);
        }
        
        // Check if already tracked
        const alreadyTracked = trackedPlayers.find(p => 
            (p.personaId && p.personaId === foundPlayer.personaId) ||
            (p.name === foundPlayer.name && p.platform === foundPlayer.platform)
        );
        
        if (alreadyTracked) {
            return message.reply(`❌ **${foundPlayer.name}** (${foundPlayer.platform.toUpperCase()}) is already being tracked!`);
        }
        
        // Add to tracked players
        trackedPlayers.push(foundPlayer);
        saveTrackedPlayers();
        
        const embed = new EmbedBuilder()
            .setTitle('✅ Player Added to Tracking')
            .setDescription(`**${foundPlayer.name}** (${foundPlayer.platform.toUpperCase()})`)
            .addFields(
                { name: 'Player ID', value: foundPlayer.personaId || 'N/A', inline: true },
                { name: 'Platform', value: foundPlayer.platform.toUpperCase(), inline: true },
                { name: 'Total Tracked', value: trackedPlayers.length.toString(), inline: true }
            )
            .setColor(0x00FF00)
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        return;
    }
    
    // Track command: !track ID
    if (content.startsWith('!track ')) {
        const playerId = content.slice(7).trim();
        if (!playerId) {
            return message.reply('❌ Please provide a player ID.\nUsage: `!track <playerID>`\nUse `!search playername` to find player IDs.');
        }
        
        // Search for the player with this ID
        let foundPlayer = null;
        const platforms = ['pc', 'xbox', 'psn'];
        
        for (const platform of platforms) {
            try {
                const url = `${CONFIG.API_BASE_URL}?personaId=${encodeURIComponent(playerId)}&platform=${platform}`;
                const response = await fetch(url);
                
                if (response.ok) {
                    const data = await response.json();
                    if (data && (data.userName || data.name || data.personaId)) {
                        foundPlayer = {
                            name: data.userName || data.name || 'Unknown',
                            personaId: data.personaId || data.id || playerId,
                            platform: platform
                        };
                        break;
                    }
                }
            } catch (error) {
                continue;
            }
        }
        
        if (!foundPlayer) {
            // Try searching by name if ID search fails
            return message.reply(`❌ Could not find player with ID "${playerId}".\nTry using \`!search playername\` to find the correct player ID.`);
        }
        
        // Check if already tracked
        const alreadyTracked = trackedPlayers.find(p => 
            (p.personaId && p.personaId === foundPlayer.personaId) ||
            (p.name === foundPlayer.name && p.platform === foundPlayer.platform)
        );
        
        if (alreadyTracked) {
            return message.reply(`❌ **${foundPlayer.name}** (${foundPlayer.platform.toUpperCase()}) is already being tracked!`);
        }
        
        // Add to tracked players
        trackedPlayers.push(foundPlayer);
        saveTrackedPlayers();
        
        const embed = new EmbedBuilder()
            .setTitle('✅ Player Added to Tracking')
            .setDescription(`**${foundPlayer.name}** (${foundPlayer.platform.toUpperCase()})`)
            .addFields(
                { name: 'Player ID', value: foundPlayer.personaId || 'N/A', inline: true },
                { name: 'Platform', value: foundPlayer.platform.toUpperCase(), inline: true },
                { name: 'Total Tracked', value: trackedPlayers.length.toString(), inline: true }
            )
            .setColor(0x00FF00)
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        return;
    }
    
    // List tracked players: !list
    if (content === '!list') {
        if (trackedPlayers.length === 0) {
            return message.reply('❌ No players are currently being tracked.\nUse `!search playername` to find players, then `!track <ID>` to add them.');
        }
        
        const embed = new EmbedBuilder()
            .setTitle('📊 Tracked Players')
            .setDescription(`Currently tracking ${trackedPlayers.length} player(s):`)
            .setColor(0x0099FF)
            .setTimestamp();
        
        trackedPlayers.forEach((player, index) => {
            embed.addFields({
                name: `${index + 1}. ${player.name}`,
                value: `**Platform:** ${player.platform.toUpperCase()}\n**ID:** \`${player.personaId || 'N/A'}\``,
                inline: true
            });
        });
        
        await message.reply({ embeds: [embed] });
        return;
    }
    
    // Untrack command: !untrack ID
    if (content.startsWith('!untrack ')) {
        const playerId = content.slice(9).trim();
        if (!playerId) {
            return message.reply('❌ Please provide a player ID.\nUsage: `!untrack <playerID>`\nUse `!list` to see tracked players.');
        }
        
        const index = trackedPlayers.findIndex(p => 
            (p.personaId && p.personaId === playerId) ||
            p.name.toLowerCase() === playerId.toLowerCase()
        );
        
        if (index === -1) {
            return message.reply(`❌ Player with ID "${playerId}" is not being tracked.\nUse \`!list\` to see tracked players.`);
        }
        
        const removedPlayer = trackedPlayers[index];
        trackedPlayers.splice(index, 1);
        saveTrackedPlayers();
        
        // Also remove from lastStats cache
        const playerKey = removedPlayer.personaId || `${removedPlayer.name}_${removedPlayer.platform}`;
        lastStats.delete(playerKey);
        
        await message.reply(`✅ Removed **${removedPlayer.name}** (${removedPlayer.platform.toUpperCase()}) from tracking.`);
        return;
    }
    
    // Manual update command: !update
    if (content === '!update' || content === '!bf6update') {
        await message.reply('🔄 Updating stats...');
        await postAllStats();
        await message.reply('✅ Stats updated!');
        return;
    }
    
    // Help command
    if (content === '!help' || content === '!bf6help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('🎮 BF6 Tracker Bot Commands')
            .setDescription('Commands for the Battlefield 6 tracker bot')
            .addFields(
                { name: '!add <tracker.gg URL>', value: 'Add a player by their tracker.gg profile URL\nExample: `!add https://tracker.gg/bf6/profile/2481313248/overview`', inline: false },
                { name: '!search <playername>', value: 'Search for players by name and get their IDs', inline: false },
                { name: '!track <ID>', value: 'Add a player to tracking using their player ID', inline: false },
                { name: '!list', value: 'List all currently tracked players', inline: false },
                { name: '!untrack <ID>', value: 'Remove a player from tracking', inline: false },
                { name: '!update', value: 'Manually trigger stats update', inline: false },
                { name: '!help', value: 'Show this help message', inline: false }
            )
            .setColor(0x0099FF)
            .setFooter({ text: 'Stats are automatically posted at regular intervals' });
        
        await message.reply({ embeds: [helpEmbed] });
        return;
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

client.login(token).catch((error) => {
    if (error.message.includes('disallowed intents') || error.message.includes('Used disallowed intents')) {
        console.error('\n❌ ERROR: Disallowed Intents Detected!');
        console.error('\n📋 SOLUTION: You need to enable "Message Content Intent" in Discord Developer Portal:');
        console.error('   1. Go to https://discord.com/developers/applications');
        console.error('   2. Select your bot application');
        console.error('   3. Go to the "Bot" section');
        console.error('   4. Scroll down to "Privileged Gateway Intents"');
        console.error('   5. Enable "MESSAGE CONTENT INTENT"');
        console.error('   6. Save changes and restart the bot\n');
    } else {
        console.error('❌ Error logging in:', error.message);
    }
    process.exit(1);
});

