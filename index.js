require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
<<<<<<< HEAD
const express = require('express');
const cors = require('cors'); // ✅ add this

const app = express();
app.use(cors()); // ✅ add this
=======
const path = require('path');
const express = require('express');
>>>>>>> 00d1a7400084f924667a4b68214cfda4663b4586

// 🧠 Bot Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// 📁 Files for persistence
const pointsPath = path.join(__dirname, 'points.json');
const sessionLogPath = path.join(__dirname, 'sessionLogs.json');

let userPoints = fs.existsSync(pointsPath) ? JSON.parse(fs.readFileSync(pointsPath)) : {};
let sessionLogs = fs.existsSync(sessionLogPath) ? JSON.parse(fs.readFileSync(sessionLogPath)) : [];

function savePoints() {
  fs.writeFileSync(pointsPath, JSON.stringify(userPoints, null, 2));
}

function saveLogs() {
  fs.writeFileSync(sessionLogPath, JSON.stringify(sessionLogs, null, 2));
}

// 🏆 Role rewards configuration
const rewardRoles = [
  { points: 100, roleName: "Knight" },
  { points: 300, roleName: "Champion" },
  { points: 600, roleName: "Legend" },
];

// ⏱ Voice tracking
const usersInVoice = new Map();

// ⌛ Cooldowns
const cooldowns = new Map();
function isOnCooldown(userId, command, seconds) {
  const now = Date.now();
  if (!cooldowns.has(userId)) cooldowns.set(userId, {});
  const userCooldowns = cooldowns.get(userId);

  if (!userCooldowns[command] || now - userCooldowns[command] > seconds * 1000) {
    userCooldowns[command] = now;
    return false;
  }
  return true;
}

// 🏅 Give points and check rewards
async function givePoints(userId, seconds) {
  const earned = Math.floor(seconds / 300);
  if (earned <= 0) return;

  if (!userPoints[userId]) userPoints[userId] = 0;
  userPoints[userId] += earned;
  savePoints();

  sessionLogs.push({
    userId,
    time: new Date().toISOString(),
    duration: seconds,
    pointsEarned: earned,
  });
  saveLogs();

  console.log(`+${earned} point(s) to ${userId}. Total: ${userPoints[userId]}`);
  checkRewards(userId);
}

async function checkRewards(userId) {
  const member = await client.guilds.cache.first()?.members.fetch(userId).catch(() => null);
  if (!member) return;

  for (const reward of rewardRoles) {
    const role = member.guild.roles.cache.find(r => r.name === reward.roleName);
    if (role && userPoints[userId] >= reward.points && !member.roles.cache.has(role.id)) {
      await member.roles.add(role).catch(console.error);
      console.log(`🎖️ ${member.user.username} earned the role: ${reward.roleName}`);
    }
  }
}

// 🟢 On bot ready
client.once('ready', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  // Restore tracking after restart
  client.guilds.cache.forEach(guild => {
    const channels = guild.channels.cache.filter(c => c.type === 2); // Voice
    for (const channel of channels.values()) {
      for (const [userId, member] of channel.members) {
        usersInVoice.set(userId, {
          joinedAt: Date.now(),
          isMuted: member.voice.selfMute || member.voice.mute,
        });
      }
    }
  });
});

// 🎧 Voice state tracking
client.on('voiceStateUpdate', (oldState, newState) => {
  const userId = newState.id;
  const oldChannel = oldState.channel;
  const newChannel = newState.channel;
  const oldMuted = oldState.selfMute || oldState.mute;
  const newMuted = newState.selfMute || newState.mute;

  if (!oldChannel && newChannel) {
    if (!usersInVoice.has(userId)) {
      usersInVoice.set(userId, {
        joinedAt: Date.now(),
        isMuted: newMuted,
      });
    }
  } else if (oldChannel && !newChannel) {
    const data = usersInVoice.get(userId);
    if (data) {
      const seconds = Math.floor((Date.now() - data.joinedAt) / 1000);
      if (!data.isMuted) {
        givePoints(userId, seconds);
      }
      usersInVoice.delete(userId);
    }
  } else if (oldMuted !== newMuted) {
    const data = usersInVoice.get(userId);
    if (data) {
      const seconds = Math.floor((Date.now() - data.joinedAt) / 1000);
      if (!data.isMuted) {
        givePoints(userId, seconds);
      }
      usersInVoice.set(userId, {
        joinedAt: Date.now(),
        isMuted: newMuted,
      });
    }
  }
});

// 💬 Commands
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const args = message.content.trim().split(/\s+/);
  const command = args[0].toLowerCase();
  const authorId = message.author.id;

  if (command === '!commands' || command === '!help') {
    return message.reply(
      "**🤖 Bot Commands:**\n" +
      "`!points` - Show your current points\n" +
      "`!leaderboard` - Show top users\n" +
      "`!mute1 @user` - Mute user for 1 min (10 pts)\n" +
      "`!mute5 @user` - Mute user for 5 min (50 pts)\n" +
      "`!commands` or `!help` - Show this list"
    );
  }

  if (command === '!points') {
    const points = userPoints[authorId] || 0;
    return message.reply(`🏅 You have ${points} point(s).\n⚠️ You don't earn points while muted.`);
  }

  if (command === '!leaderboard') {
    const sorted = Object.entries(userPoints)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    let leaderboardText = `👑 **Top Knights** 👑\n\n`;

    for (let i = 0; i < sorted.length; i++) {
      const [id, points] = sorted[i];
      const user = await client.users.fetch(id).catch(() => null);
      const name = user ? user.username : `Unknown#${id.slice(0, 5)}`;
      leaderboardText += `**${i + 1}.** ${name}: ${points} pts\n`;
    }

    return message.channel.send(leaderboardText);
  }

  // 🔇 Mute command logic
  async function muteUser(minutes, cost) {
    const mentioned = message.mentions.members.first();
    if (!mentioned) return message.reply('❗ Please mention a user to mute.');

    if ((userPoints[authorId] || 0) < cost) {
      return message.reply(`🚫 You need ${cost} points to mute for ${minutes} minute(s).`);
    }

    if (isOnCooldown(authorId, 'mute', 30)) {
      return message.reply('🕒 Cooldown: wait 30 seconds before muting again.');
    }

    const voiceState = mentioned.voice;
    if (!voiceState || !voiceState.channel) {
      return message.reply('⚠️ That user is not in a voice channel.');
    }

    try {
      await voiceState.setMute(true, 'Muted via point system');
      userPoints[authorId] -= cost;
      savePoints();

      message.channel.send(`🔇 ${mentioned} ai tiho 🤖`);

      setTimeout(() => {
        voiceState.setMute(false, 'Auto unmute');
      }, minutes * 60 * 1000);

    } catch (err) {
      console.error(err);
      message.reply('❌ Failed to mute the user.');
    }
  }

  if (command === '!mute1') {
    muteUser(1, 10);
  }

  if (command === '!mute5') {
    muteUser(5, 50);
  }
});

// 🛡️ Error Handling
process.on('unhandledRejection', err => {
  console.error('Unhandled rejection:', err);
  process.exit(1);
});

process.on('uncaughtException', err => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

// 🌐 Web Dashboard (optional)
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/leaderboard', (req, res) => {
  const sorted = Object.entries(userPoints)
    .sort(([, a], [, b]) => b - a)
    .map(([userId, points]) => ({ userId, points }));
  res.json(sorted);
});

app.get('/logs', (req, res) => {
  res.json(sessionLogs);
});

app.listen(PORT, () => {
  console.log(`📊 Dashboard available at http://localhost:${PORT}`);
});

// 🚀 Start the bot
client.login(process.env.DISCORD_TOKEN);
