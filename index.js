require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  ActivityType
} = require("discord.js");

// =========================
// EXPRESS SERVER
// =========================
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use("/dashboard", express.static(path.join(__dirname, "dashboard")));

// Test route
app.get("/", (req, res) => res.send("Bot is running"));

// Config API routes
app.get("/api/config", (req, res) => {
  const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
  res.json(config);
});

app.post("/api/save", (req, res) => {
  fs.writeFileSync("./config.json", JSON.stringify(req.body, null, 2));
  res.json({ success: true, message: "Config opgeslagen!" });
});

app.listen(PORT, () => {
  console.log(`🌍 Web server running on port ${PORT}`);
});

// =========================
// DISCORD SETUP
// =========================
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.on("error", console.error);
process.on("unhandledRejection", console.error);

// =========================
// CONFIG
// =========================
const DONATION_ROLES = [
  "1478887899695939714",
  "1478887958537830523",
  "1478888005635674254"
];
const DONO_HANDLER_ROLE = "1479133153225609440";
const DONATION_ALERT_CHANNEL = "1478903623013634233";
const BANNED_CHANNEL = "1479059891552387123";

let bannedMessage = null;

// =========================
// SLASH COMMANDS
// =========================
const commands = [
  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban een gebruiker")
    .addUserOption(option => option.setName("user").setDescription("De gebruiker").setRequired(true))
    .addStringOption(option => option.setName("reden").setDescription("Reden van ban")),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick een gebruiker")
    .addUserOption(option => option.setName("user").setDescription("De gebruiker").setRequired(true))
    .addStringOption(option => option.setName("reden").setDescription("Reden van kick")),

  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban een gebruiker via dropdown"),

  new SlashCommandBuilder()
    .setName("wipe")
    .setDescription("Verwijder alle rollen van een gebruiker")
    .addUserOption(option => option.setName("user").setDescription("De gebruiker").setRequired(true)),

  new SlashCommandBuilder()
    .setName("donowipe")
    .setDescription("Verwijder alle donatie rollen")
    .addUserOption(option => option.setName("user").setDescription("De gebruiker").setRequired(true)),

  new SlashCommandBuilder()
    .setName("adddono")
    .setDescription("Geef een donatie rol")
    .addUserOption(option => option.setName("user").setDescription("De gebruiker").setRequired(true))
].map(cmd => cmd.toJSON());

// =========================
// READY EVENT
// =========================
client.once("ready", async () => {
  console.log(`✅ Online als ${client.user.tag}`);

  client.user.setPresence({
    activities: [{ name: "Betalen dat kan!", type: ActivityType.Playing }],
    status: "online"
  });

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log("✅ Slash commands geregistreerd.");
  } catch (error) {
    console.error("❌ Slash registratie fout:", error);
  }

  // Live ban list update interval
  setInterval(() => {
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (guild) updateBanList(guild);
  }, 10000);
});

// =========================
// LIVE BAN LIST
// =========================
async function updateBanList(guild) {
  const channel = guild.channels.cache.get(BANNED_CHANNEL);
  if (!channel) return;

  const bans = await guild.bans.fetch();
  let banList = "✅ Niemand is momenteel gebanned.";

  if (bans.size > 0) {
    banList = bans.map(b => `🔹 <@${b.user.id}>`).join("\n");
  }

  const embed = new EmbedBuilder()
    .setColor("#ff0000")
    .setTitle("🔨 Server Ban Lijst")
    .setDescription("Live overzicht van alle bans")
    .addFields(
      { name: "📊 Totaal bans", value: `**${bans.size}**`, inline: true },
      { name: "👥 Gebande gebruikers", value: banList }
    )
    .setTimestamp();

  if (!bannedMessage) {
    const msgs = await channel.messages.fetch({ limit: 10 });
    bannedMessage = msgs.find(m => m.author.id === guild.client.user.id);
  }

  if (!bannedMessage) {
    bannedMessage = await channel.send({ embeds: [embed] });
  } else {
    await bannedMessage.edit({ embeds: [embed] });
  }
}

client.on("guildBanAdd", ban => updateBanList(ban.guild));
client.on("guildBanRemove", ban => updateBanList(ban.guild));

// =========================
// INTERACTIONS
// =========================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu()) return;

  // Hier komen al je commands zoals ban/kick/wipe/donowipe/adddono/unban etc.
  // (Ik kan deze sectie opschonen en optimaliseren als je wilt)
});

// =========================
// LOGIN
// =========================
if (!process.env.TOKEN) {
  console.error("❌ GEEN TOKEN");
} else {
  client.login(process.env.TOKEN)
    .then(() => console.log("🔥 Discord bot online"))
    .catch(console.error);
}