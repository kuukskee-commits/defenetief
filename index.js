require("dotenv").config();
const express = require("express");
const fs = require("fs");

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

app.get("/", (req, res) => res.send("🤖 Discord bot is running"));

app.listen(PORT, () => {
  console.log(`🌍 Web server running on port ${PORT}`);
});


// =========================
// CONFIG
// =========================
const CONFIG_FILE = "./config.json";

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ donationMessages: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE));
}

function saveConfig(data) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

let config = loadConfig();


// =========================
// DISCORD CLIENT
// =========================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

client.on("error", console.error);
process.on("unhandledRejection", console.error);


// =========================
// CONSTANTS
// =========================
const DONATION_ROLES = [
  "1478887899695939714",
  "1478887958537830523",
  "1478888005635674254"
];

const DONO_HANDLER_ROLE = "1479133153225609440";
const DONATION_ALERT_CHANNEL = "1478903623013634233";
const BANNED_CHANNEL = "1479059891552387123";

const PAYPAL_LINK = "https://paypal.me/YOURPAYPAL";

let bannedMessage = null;


// =========================
// SLASH COMMANDS
// =========================
const commands = [

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("🔨 Ban een gebruiker")
    .addUserOption(option =>
      option.setName("user").setDescription("De gebruiker").setRequired(true))
    .addStringOption(option =>
      option.setName("reden").setDescription("Reden van ban")),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("👢 Kick een gebruiker")
    .addUserOption(option =>
      option.setName("user").setDescription("De gebruiker").setRequired(true))
    .addStringOption(option =>
      option.setName("reden").setDescription("Reden van kick")),

  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("🔓 Unban een gebruiker via dropdown"),

  new SlashCommandBuilder()
    .setName("wipe")
    .setDescription("🧹 Verwijder alle rollen van een gebruiker")
    .addUserOption(option =>
      option.setName("user").setDescription("De gebruiker").setRequired(true)),

  new SlashCommandBuilder()
    .setName("donowipe")
    .setDescription("💰 Verwijder alle donatie rollen")
    .addUserOption(option =>
      option.setName("user").setDescription("De gebruiker").setRequired(true)),

  new SlashCommandBuilder()
    .setName("adddono")
    .setDescription("💎 Geef een donatie rol")
    .addUserOption(option =>
      option.setName("user").setDescription("De gebruiker").setRequired(true))
    .addRoleOption(option =>
      option.setName("role").setDescription("Donatie rol").setRequired(true)),

  new SlashCommandBuilder()
    .setName("configdono")
    .setDescription("⚙️ Stel alert tekst in voor een donatie rol")
    .addRoleOption(option =>
      option.setName("role").setDescription("Donatie rol").setRequired(true))
    .addStringOption(option =>
      option.setName("tekst").setDescription("Alert tekst").setRequired(true))

].map(cmd => cmd.toJSON());


// =========================
// READY EVENT
// =========================
client.once("clientReady", async () => {

  console.log(`✅ Bot online als ${client.user.tag}`);

  client.user.setPresence({
    activities: [{
      name: "💸 Donaties verwerken",
      type: ActivityType.Playing
    }],
    status: "online"
  });

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  try {

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log("✅ Slash commands succesvol geregistreerd");

  } catch (error) {
    console.error("❌ Command registratie mislukt:", error);
  }

  setInterval(() => {
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (guild) updateBanList(guild);
  }, 10000);

});


// =========================
// BAN LIST EMBED
// =========================
async function updateBanList(guild) {

  const channel = guild.channels.cache.get(BANNED_CHANNEL);
  if (!channel) return;

  const bans = await guild.bans.fetch();

  let banList = "🟢 **Er zijn momenteel geen gebande gebruikers.**";

  if (bans.size > 0) {

    banList = bans
      .map(b => `• <@${b.user.id}>`)
      .join("\n");

  }

  const embed = new EmbedBuilder()

    .setColor("#ff9900") // ORANJE
    .setTitle("🔨 SERVER BAN DATABASE")

    .addFields(

      {
        name: "📊 Server Statistieken",
        value:
          `🔹 **Totaal bans:** \`${bans.size}\`\n` +
          `🔹 **Server leden:** \`${guild.memberCount}\`\n` +
          `🔹 **Server naam:** ${guild.name}`,
        inline: false
      },

      {
        name: "🚫 Gebande Gebruikers",
        value: banList,
        inline: false
      }

    )

    .setThumbnail(guild.iconURL({ dynamic: true }))

    .setFooter({
      text: `${guild.name} • Moderation System`,
      iconURL: guild.iconURL({ dynamic: true })
    })

    .setTimestamp();


  if (!bannedMessage) {
    const msgs = await channel.messages.fetch({ limit: 10 });
    bannedMessage = msgs.find(m => m.author.id === client.user.id);
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
// COMMAND HANDLER
// =========================
client.on("interactionCreate", async interaction => {

  if (!interaction.isChatInputCommand()) return;

  const guild = interaction.guild;

  // ================= BAN =================
  if (interaction.commandName === "ban") {

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers))
      return interaction.reply({ content: "❌ Geen permissie.", ephemeral: true });

    const user = interaction.options.getUser("user");
    const reason = interaction.options.getString("reden") || "Geen reden";

    try {
const dmEmbed = new EmbedBuilder()

  .setColor("#ff9900")
  .setTitle("⛔ Je bent geband")
  .setDescription(
    `Je bent **permanent verwijderd** uit **${guild.name}**.\n\n` +
    `Als je denkt dat dit een fout is of je toegang wil terugkrijgen, kan je een **unban aanvraag** doen.`
  )

  .addFields(

    {
      name: "🔨 Reden",
      value: `\`${reason}\``,
      inline: false
    },

    {
      name: "💰 Unban aanvraag",
      value:
        `Wil je opnieuw toegang tot de server krijgen?\n\n` +
        `💳 **Kost:** €30\n` +
        `💳 **Betaal via PayPal**\n` +
        `💳 **Vermeld je Discord naam bij de betaling**`,
      inline: false
    },

    {
      name: "🔗 PayPal betaling",
      value: `${PAYPAL_LINK}`,
      inline: false
    }

  )

  .setFooter({
    text: `${guild.name} • Moderation System`
  })

  .setTimestamp();


try {
  await user.send({ embeds: [dmEmbed] });
} catch {}
    } catch {}

    await guild.members.ban(user.id, { reason });

    const embed = new EmbedBuilder()
      .setColor("#ff0000")
      .setTitle("🔨 Gebruiker gebanned")
      .addFields(
        { name: "👤 Gebruiker", value: `${user.tag}`, inline: true },
        { name: "📄 Reden", value: reason, inline: true }
      )
      .setTimestamp();

    interaction.reply({ embeds: [embed] });

  }


  // ================= ADD DONO =================
  if (interaction.commandName === "adddono") {

    if (!interaction.member.roles.cache.has(DONO_HANDLER_ROLE))
      return interaction.reply({ content: "❌ Geen permissie.", ephemeral: true });

    const user = interaction.options.getMember("user");
    const role = interaction.options.getRole("role");

    await user.roles.add(role);

    const alertChannel = guild.channels.cache.get(DONATION_ALERT_CHANNEL);

    const message =
      config.donationMessages[role.id] ||
      "❤️ Bedankt voor het steunen van de server!";

    if (alertChannel) {

      const embed = new EmbedBuilder()
        .setColor("#00ff9d")
        .setTitle("💸 Nieuwe Donatie!")
        .setDescription(`🎉 **${user} heeft zojuist gedoneerd!**`)
        .addFields(
          {
            name: "👤 Donateur",
            value: `${user}`,
            inline: true
          },
          {
            name: "💎 Donatie Tier",
            value: `${role}`,
            inline: true
          },
          {
            name: "💬 Bericht",
            value: message
          }
        )
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setFooter({
          text: "Dankjewel voor de support ❤️"
        })
        .setTimestamp();

      alertChannel.send({ embeds: [embed] });

    }

    interaction.reply("✅ Donatie rol succesvol gegeven.");

  }
  // ================= UNBAN =================
  if (interaction.commandName === "unban") {

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers))
      return interaction.reply({ content: "❌ Geen permissie.", ephemeral: true });

    const bans = await guild.bans.fetch();

    if (bans.size === 0) {
      return interaction.reply({
        content: "🟢 Er zijn momenteel geen gebande gebruikers.",
        ephemeral: true
      });
    }

    const options = bans.map(ban => ({
      label: ban.user.tag,
      value: ban.user.id
    }));

    const menu = new StringSelectMenuBuilder()
      .setCustomId("unban_select")
      .setPlaceholder("Selecteer gebruiker om te unbannen")
      .addOptions(options.slice(0, 25));

    const row = new ActionRowBuilder().addComponents(menu);

    return interaction.reply({
      content: "🔓 Kies een gebruiker om te **unbannen**:",
      components: [row],
      ephemeral: true
    });

  }

  // ================= UNBAN SELECT =================
  if (interaction.isStringSelectMenu()) {

    if (interaction.customId === "unban_select") {

      const userId = interaction.values[0];

      try {

        await interaction.guild.members.unban(userId);

        const embed = new EmbedBuilder()
          .setColor("#00ff99")
          .setTitle("🔓 Gebruiker Unbanned")
          .setDescription(`✅ **<@${userId}> is succesvol unbanned.**`)
          .setTimestamp();

        await interaction.update({
          embeds: [embed],
          components: []
        });

      } catch {

        await interaction.update({
          content: "❌ Kon gebruiker niet unbannen.",
          components: []
        });

      }

    }

  }

  // ================= CONFIG DONO =================
  if (interaction.commandName === "configdono") {

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return interaction.reply({ content: "❌ Admin only.", ephemeral: true });

    const role = interaction.options.getRole("role");
    const text = interaction.options.getString("tekst");

    config.donationMessages[role.id] = text;

    saveConfig(config);

    interaction.reply(`✅ Alert tekst ingesteld voor ${role}`);

  }

});


// =========================
// LOGIN
// =========================
if (!process.env.TOKEN) {
  console.error("❌ GEEN TOKEN IN .ENV");
} else {

  client.login(process.env.TOKEN)
    .then(() => console.log("🔥 Discord bot succesvol gestart"))
    .catch(console.error);

}