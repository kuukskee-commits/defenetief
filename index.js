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

process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("🤖 Discord bot is running"));
app.listen(PORT, () => console.log(`🌍 Web server running on port ${PORT}`));

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

const client = new Client({
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMembers
]
});

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
option.setName("tekst").setDescription("Alert tekst").setRequired(true)),

new SlashCommandBuilder()
.setName("dm")
.setDescription("📩 Stuur een DM via de bot")
.addUserOption(option =>
option.setName("user").setDescription("De gebruiker").setRequired(true))
.addStringOption(option =>
option.setName("tekst").setDescription("Het bericht").setRequired(true))

new SlashCommandBuilder()
.setName("dmid")
.setDescription("📩 Stuur een DM via Discord ID")
.addStringOption(option =>
option.setName("id")
.setDescription("Discord User ID")
.setRequired(true))
.addStringOption(option =>
option.setName("bericht")
.setDescription("Het bericht")
.setRequired(true))

].map(cmd => cmd.toJSON());

client.once("clientReady", async () => {

console.log(`✅ Bot online als ${client.user.tag}`);

client.user.setPresence({
activities: [{ name: "💸 Donaties verwerken", type: ActivityType.Playing }],
status: "online"
});

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

await rest.put(
Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
{ body: commands }
);

console.log("✅ Slash commands succesvol geregistreerd");

setInterval(() => {
const guild = client.guilds.cache.get(process.env.GUILD_ID);
if (guild) updateBanList(guild);
}, 15000);

});

async function updateBanList(guild) {

const channel = guild.channels.cache.get(BANNED_CHANNEL);
if (!channel) return;

const bans = await guild.bans.fetch();

let banList = "🟢 **Er zijn momenteel geen gebande gebruikers.**";

if (bans.size > 0) {
banList = bans.map(b => `• <@${b.user.id}>`).join("\n");
}

const embed = new EmbedBuilder()

.setColor("#ff9900")
.setTitle("🔨 SERVER BAN DATABASE")

.addFields(
{
name: "📊 Server Statistieken",
value:
`🔹 **Totaal bans:** \`${bans.size}\`\n` +
`🔹 **Server leden:** \`${guild.memberCount}\`\n` +
`🔹 **Server naam:** ${guild.name}`
},
{
name: "🚫 Gebande Gebruikers",
value: banList
}
)

.setThumbnail(guild.iconURL({ dynamic: true }))
.setFooter({ text: `${guild.name} • Moderation System` })
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

client.on("interactionCreate", async interaction => {

const guild = interaction.guild;
if (!guild) return;

if (interaction.isStringSelectMenu()) {

if (interaction.customId === "unban_select") {

const userId = interaction.values[0];

await guild.members.unban(userId);

const embed = new EmbedBuilder()
.setColor("#00ff99")
.setTitle("🔓 Gebruiker Unbanned")
.setDescription(`✅ **<@${userId}> is succesvol unbanned.**`)
.setTimestamp();

return interaction.update({ embeds: [embed], components: [] });

}

}

if (!interaction.isChatInputCommand()) return;

if (interaction.commandName === "ban") {

if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers))
return interaction.reply({ content: "❌ Geen permissie.", ephemeral: true });

const user = interaction.options.getUser("user");
const reason = interaction.options.getString("reden") || "Geen reden";

try {

const banEmbed = new EmbedBuilder()
.setColor("#ff0000")
.setTitle("⛔ Je bent geband")
.setDescription("Je bent permanent verwijderd uit **snitches get stitches**.")
.addFields(
{
name: "🔨 Reden",
value: reason
},
{
name: "💰 Unban aanvraag",
value:
"💳 **Kost:** €30\n" +
"💳 **Betaal via PayPal**\n" +
"💳 **Vermeld je Discord naam bij betaling**"
},
{
name: "🔗 PayPal betaling",
value: "[Klik hier om te betalen](https://paypal.me/YOURPAYPAL)"
},
{
name: "🔗 Opnieuw joinen",
value: "[Klik hier om opnieuw te joinen](https://discord.gg/HZ2tpREXKF)"
}
)
.setFooter({ text: "snitches get stitches • Moderation System" })
.setTimestamp();

await user.send({ embeds: [banEmbed] });

} catch (err) {
console.log("Kon geen DM sturen naar gebruiker.");
}

await guild.members.ban(user.id, { reason });

return interaction.reply(`🔨 ${user.tag} is gebanned.`);

}





if (interaction.commandName === "kick") {

if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers))
return interaction.reply({ content: "❌ Geen permissie.", ephemeral: true });

const user = interaction.options.getMember("user");
const reason = interaction.options.getString("reden") || "Geen reden";

try {

const kickEmbed = new EmbedBuilder()
.setColor("#ff9900")
.setTitle("👢 Je bent gekickt")
.setDescription("Je bent verwijderd uit **snitches get stitches**.")
.addFields(
{
name: "🔨 Reden",
value: reason
},
{
name: "🔗 Opnieuw joinen",
value: "[Klik hier om opnieuw te joinen](https://discord.gg/HZ2tpREXKF)"
}
)
.setFooter({ text: "snitches get stitches • Moderation System" })
.setTimestamp();

await user.send({ embeds: [kickEmbed] });

} catch (err) {
console.log("Kon geen kick DM sturen.");
}

await user.kick(reason);

return interaction.reply({content: `👢 ${user.user.tag} is gekicked.`,ephemeral: true});
}




if (interaction.commandName === "unban") {

if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers))
return interaction.reply({ content: "❌ Geen permissie.", ephemeral: true });

const bans = await guild.bans.fetch();

if (!bans.size)
return interaction.reply("Er zijn geen gebande gebruikers.");

const menu = new StringSelectMenuBuilder()
.setCustomId("unban_select")
.setPlaceholder("Selecteer gebruiker")
.addOptions(
bans.map(b => ({
label: b.user.tag,
value: b.user.id
}))
);

const row = new ActionRowBuilder().addComponents(menu);

return interaction.reply({
content: "Selecteer gebruiker om te unbannen:",
components: [row]
});

}

if (interaction.commandName === "wipe") {

const user = interaction.options.getMember("user");

await user.roles.set([]);

return interaction.reply({content: `🧹 Alle rollen verwijderd van ${user.user.tag}`,ephemeral: true});
}

if (interaction.commandName === "donowipe") {

const user = interaction.options.getMember("user");

for (const roleId of DONATION_ROLES) {
if (user.roles.cache.has(roleId)) {
await user.roles.remove(roleId);
}
}

return interaction.reply(`💰 Donatie rollen verwijderd van ${user.user.tag}`);

}

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
{ name: "👤 Donateur", value: `${user}`, inline: true },
{ name: "💎 Donatie Tier", value: `${role}`, inline: true },
{ name: "💬 Bericht", value: message }
)
.setThumbnail(user.displayAvatarURL({ dynamic: true }))
.setFooter({ text: "Dankjewel voor de support ❤️" })
.setTimestamp();

alertChannel.send({ embeds: [embed] });

}

return interaction.reply("✅ Donatie rol succesvol gegeven.");

}

if (interaction.commandName === "configdono") {

const role = interaction.options.getRole("role");
const text = interaction.options.getString("tekst");

config.donationMessages[role.id] = text;

saveConfig(config);

return interaction.reply("⚙️ Donatie bericht ingesteld.");

}


if (interaction.commandName === "dm") {

const ALLOWED_ROLE_1 = "1478874554448482517";
const ALLOWED_ROLE_2 = "1479187012979396824";

if (
!interaction.member.roles.cache.has(ALLOWED_ROLE_1) &&
!interaction.member.roles.cache.has(ALLOWED_ROLE_2)
) {
return interaction.reply({
content: "❌ Jij mag dit command niet gebruiken.",
ephemeral: true
});
}

const user = interaction.options.getUser("user");
const text = interaction.options.getString("tekst");

try {

const embed = new EmbedBuilder()
.setColor("#0099ff")
.setTitle("📩 Bericht van de server")
.setDescription(text)
.addFields(
{ name: "👤 Verzonden door", value: interaction.user.tag }
)
.setFooter({ text: "snitches get stitches • Moderation System" })
.setTimestamp();

await user.send({ embeds: [embed] });

return interaction.reply({
content: `✅ Bericht gestuurd naar ${user.tag}`,
ephemeral: true
});

} catch (err) {

return interaction.reply({
content: "❌ Kon geen DM sturen. DM's staan misschien uit.",
ephemeral: true
});

}

}


if (interaction.commandName === "dmid") {

const id = interaction.options.getString("id");
const message = interaction.options.getString("bericht");

try {

const user = await client.users.fetch(id);

const embed = new EmbedBuilder()
.setColor("#00b0f4")
.setTitle("📩 Bericht van Server Staff")
.setDescription(message)
.setFooter({ text: "snitches get stitches" })
.setTimestamp();

await user.send({ embeds: [embed] });

return interaction.reply({
content: "✅ Bericht succesvol gestuurd.",
ephemeral: true
});

} catch (err) {

return interaction.reply({
content: "❌ Kon geen DM sturen naar deze gebruiker.",
ephemeral: true
});

}

}

});

client.login(process.env.TOKEN);