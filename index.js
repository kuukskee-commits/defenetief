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
ActivityType,
ChannelType
} = require("discord.js");

process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);



// LOG CHANNEL
const LOG_CHANNEL = "1479215303123538021";

// Log functie
function sendLog(guild, title, color, fields, avatar = null) {

const logChannel = guild.channels.cache.get(LOG_CHANNEL);
if (!logChannel) return;

const embed = new EmbedBuilder()
.setColor(color)
.setTitle(title)
.addFields(fields)
.setTimestamp();

if (avatar) {
embed.setThumbnail(avatar);
}

logChannel.send({ embeds: [embed] });

}

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
GatewayIntentBits.GuildMembers,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildPresences
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
const MEMBER_ACTIVITY_CHANNEL = "1478865017746227283";

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
option.setName("tekst").setDescription("Het bericht").setRequired(true)),

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
.setRequired(true)),

new SlashCommandBuilder()
.setName("callall")
.setDescription("📞 Kick iedereen uit alle voice calls"),

new SlashCommandBuilder()
.setName("join")
.setDescription("🎙️ Bot joint en leaved een voice kanaal meerdere keren")
.addChannelOption(option =>
option.setName("channel")
.setDescription("Voice kanaal")
.addChannelTypes(ChannelType.GuildVoice)
.setRequired(true))
.addIntegerOption(option =>
option.setName("aantal")
.setDescription("Aantal keer join/leave")
.setRequired(true)),

new SlashCommandBuilder()
.setName("nick")
.setDescription("✏️ Verander de nickname van een gebruiker")
.addUserOption(option =>
option.setName("user")
.setDescription("De gebruiker")
.setRequired(true))
.addStringOption(option =>
option.setName("naam")
.setDescription("Nieuwe nickname")
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

if (guild) {
updateBanList(guild);
updateMemberActivity(guild);
}

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

async function updateMemberActivity(guild) {

const channel = guild.channels.cache.get(MEMBER_ACTIVITY_CHANNEL);
if (!channel) return;

await guild.members.fetch();

const members = guild.members.cache.filter(m => !m.user.bot);

let online = [];
let idle = [];
let dnd = [];
let offline = [];

members.forEach(member => {

const presence = member.presence;

let text = "";

if (!presence) {

text = `⚫ **${member.user.username}** — Offline`;
offline.push(text);
return;

}

let activityText = "";

if (presence.activities.length > 0) {

const activity = presence.activities[0];

switch (activity.type) {

case 0:
activityText = `🎮 Playing **${activity.name}**`;
break;

case 1:
activityText = `📺 Streaming **${activity.name}**`;
break;

case 2:
activityText = `🎧 Listening to **${activity.name}**`;
break;

case 3:
activityText = `👀 Watching **${activity.name}**`;
break;

case 4:
activityText = `💬 ${activity.state || activity.name}`;
break;

default:
activityText = "🟢 Online";

}

}

switch (presence.status) {

case "online":
text = `🟢 **${member.user.username}** — ${activityText || "Online"}`;
online.push(text);
break;

case "idle":
text = `🌙 **${member.user.username}** — ${activityText || "Idle"}`;
idle.push(text);
break;

case "dnd":
text = `⛔ **${member.user.username}** — ${activityText || "Do Not Disturb"}`;
dnd.push(text);
break;

default:
text = `⚫ **${member.user.username}** — Offline`;
offline.push(text);

}

});

const description =
[
online.join("\n\n"),
idle.join("\n\n"),
dnd.join("\n\n"),
offline.join("\n\n")
].filter(Boolean).join("\n\n");

const embed = new EmbedBuilder()
.setColor("#5865F2")
.setTitle(`👥 ${guild.name} • Server Activiteit`)
.setThumbnail(guild.iconURL({ dynamic: true }))
.setDescription(description || "Geen leden gevonden.")
.addFields(
{
name: "📊 Server Stats",
value:
`👤 Leden: **${members.size}**\n` +
`🟢 Online: **${online.length}**\n` +
`🌙 Idle: **${idle.length}**\n` +
`⛔ DND: **${dnd.length}**`
}
)
.setFooter({ text: "Live server activiteit" })
.setTimestamp();

const messages = await channel.messages.fetch({ limit: 10 });

const existing = messages.find(m =>
m.author.id === client.user.id &&
m.embeds.length > 0 &&
m.embeds[0].title?.includes("Server Activiteit")
);

if (existing) {

await existing.edit({ embeds: [embed] });

} else {

await channel.send({ embeds: [embed] });

}
}

client.on("interactionCreate", async interaction => {

const guild = interaction.guild;
if (!guild) return;

if (interaction.isStringSelectMenu()) {

if (interaction.customId === "unban_select") {

const userId = interaction.values[0];

await guild.members.unban(userId);
const user = await client.users.fetch(userId);

sendLog(guild, "🔓 Gebruiker Unbanned", "#00ff99", [
{
name: "👤 Gebruiker",
value: `<@${userId}>
${user.tag}
${userId}`
},
{
name: "👮 Moderator",
value: `<@${interaction.user.id}>
${interaction.user.tag}
${interaction.user.id}`
}
], user.displayAvatarURL({ dynamic: true }));

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
sendLog(guild, "🔨 Gebruiker Gebanned", "#ff0000", [
{
name: "👤 Gebruiker",
value: `<@${user.id}>
${user.tag}
${user.id}`
},
{
name: "👮 Moderator",
value: `<@${interaction.user.id}>
${interaction.user.tag}
${interaction.user.id}`
},
{
name: "📄 Reden",
value: reason
}
], user.displayAvatarURL({ dynamic: true }));

return interaction.reply({content: `🔨 ${user.tag} is gebanned.`,ephemeral: true});

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
sendLog(guild, "👢 Gebruiker Gekicked", "#ff9900", [
{
name: "👤 Gebruiker",
value: `<@${user.id}>
${user.user.tag}
${user.id}`
},
{
name: "👮 Moderator",
value: `<@${interaction.user.id}>
${interaction.user.tag}
${interaction.user.id}`
},
{
name: "📄 Reden",
value: reason
}
], user.displayAvatarURL({ dynamic: true }));

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

return interaction.reply({content: "Selecteer gebruiker om te unbannen:",components: [row],ephemeral: true});

}

if (interaction.commandName === "wipe") {

const user = interaction.options.getMember("user");

await user.roles.set([]).catch(() => {});
sendLog(guild, "🧹 Rollen Gewiped", "#ffaa00", [
{
name: "👤 Gebruiker",
value: `<@${user.id}>
${user.user.tag}
${user.id}`
},
{
name: "👮 Staff",
value: `<@${interaction.user.id}>
${interaction.user.tag}
${interaction.user.id}`
}
], user.displayAvatarURL({ dynamic: true }));

return interaction.reply({content: `🧹 Alle rollen verwijderd van ${user.user.tag}`,ephemeral: true});
}

if (interaction.commandName === "donowipe") {

const user = interaction.options.getMember("user");

for (const roleId of DONATION_ROLES) {
if (user.roles.cache.has(roleId)) {
await user.roles.remove(roleId);
}
}
sendLog(guild, "💰 Donatie Rollen Gewiped", "#ffcc00", [
{
name: "👤 Gebruiker",
value: `<@${user.id}>
${user.user.tag}
${user.id}`
},
{
name: "👮 Staff",
value: `<@${interaction.user.id}>
${interaction.user.tag}
${interaction.user.id}`
}
], user.displayAvatarURL({ dynamic: true }));

return interaction.reply({content: `💰 Donatie rollen verwijderd van ${user.user.tag}`,ephemeral: true});

}

if (interaction.commandName === "adddono") {

if (!interaction.member.roles.cache.has(DONO_HANDLER_ROLE))
return interaction.reply({ content: "❌ Geen permissie.", ephemeral: true });

const user = interaction.options.getMember("user");
const role = interaction.options.getRole("role");

await user.roles.add(role);
sendLog(guild, "💎 Donatie Rol Gegeven", "#00ff9d", [
{
name: "👤 Gebruiker",
value: `<@${user.id}>
${user.user.tag}
${user.id}`
},
{
name: "💎 Rol",
value: `${role.name}`
},
{
name: "👮 Staff",
value: `<@${interaction.user.id}>
${interaction.user.tag}
${interaction.user.id}`
}
], user.displayAvatarURL({ dynamic: true }));

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

return interaction.reply({content: "✅ Donatie rol succesvol gegeven.",ephemeral: true});

}

if (interaction.commandName === "configdono") {

const role = interaction.options.getRole("role");
const text = interaction.options.getString("tekst");

config.donationMessages[role.id] = text;

saveConfig(config);
sendLog(guild, "⚙️ Donatie Config Aangepast", "#7289da", [
{ name: "💎 Rol", value: `${role.name}` },
{ name: "💬 Nieuw bericht", value: text },
{
name: "👮 Staff",
value: `<@${interaction.user.id}>
${interaction.user.tag}
${interaction.user.id}`
}
], interaction.user.displayAvatarURL({ dynamic: true }));

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

sendLog(guild, "📩 DM Verstuurd", "#0099ff", [
{
name: "👤 Ontvanger",
value: `<@${user.id}>
${user.tag}
${user.id}`
},
{
name: "👮 Moderator",
value: `<@${interaction.user.id}>
${interaction.user.tag}
${interaction.user.id}`
},
{
name: "💬 Bericht",
value: text
}
], user.displayAvatarURL({ dynamic: true }));

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

if (interaction.commandName === "callall") {

const ALLOWED_ROLE = "1479235299833020446";

if (!interaction.member.roles.cache.has(ALLOWED_ROLE)) {
return interaction.reply({
content: "❌ Jij mag dit command niet gebruiken.",
ephemeral: true
});
}

let count = 0;

interaction.guild.channels.cache
.filter(c => c.isVoiceBased())
.forEach(channel => {

channel.members.forEach(member => {
member.voice.disconnect();
count++;
});

});

return interaction.reply({
content: `📞 ${count} gebruikers zijn uit alle calls gekickt.`,
ephemeral: true
});

}


if (interaction.commandName === "nick") {

if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageNicknames)) {
return interaction.reply({ 
content: "❌ Geen permissie.", 
ephemeral: true 
});
}

const user = interaction.options.getMember("user");
const newNick = interaction.options.getString("naam");

try {

await user.setNickname(newNick);

sendLog(guild, "✏️ Nickname Veranderd", "#00b0f4", [
{
name: "👤 Gebruiker",
value: `<@${user.id}>\n${user.user.tag}\n${user.id}`
},
{
name: "📝 Nieuwe naam",
value: newNick
},
{
name: "👮 Moderator",
value: `<@${interaction.user.id}>\n${interaction.user.tag}\n${interaction.user.id}`
}
], user.displayAvatarURL({ dynamic: true }));

return interaction.reply({
content: `✏️ Nickname van ${user.user.tag} veranderd naar **${newNick}**`,
ephemeral: true
});

} catch (err) {

return interaction.reply({
content: "❌ Kon nickname niet veranderen.",
ephemeral: true
});

}

}

if (interaction.commandName === "join") {

const ALLOWED_ROLE = "1479235299833020446";

if (!interaction.member.roles.cache.has(ALLOWED_ROLE)) {
return interaction.reply({
content: "❌ Jij mag dit command niet gebruiken.",
ephemeral: true
});
}

const { joinVoiceChannel } = require("@discordjs/voice");

const channel = interaction.options.getChannel("channel");
const amount = interaction.options.getInteger("aantal");

if (!channel.isVoiceBased()) {
return interaction.reply({ content: "❌ Dit moet een voice kanaal zijn.", ephemeral: true });
}

if (amount > 100) {
return interaction.reply({ content: "❌ Maximum is 100.", ephemeral: true });
}

await interaction.deferReply({ ephemeral: true });

for (let i = 0; i < amount; i++) {

const connection = joinVoiceChannel({
channelId: channel.id,
guildId: interaction.guild.id,
adapterCreator: interaction.guild.voiceAdapterCreator
});

await new Promise(r => setTimeout(r, 1500));

connection.destroy();

await new Promise(r => setTimeout(r, 1000));

}
await interaction.editReply(`✅ Klaar! Ik ben **${amount} keer** gejoined en geleaved in ${channel}.`);


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

sendLog(guild, "📩 DM via ID Verstuurd", "#00b0f4", [
{
name: "👤 Ontvanger",
value: `<@${user.id}>
${user.tag}
${user.id}`
},
{
name: "👮 Staff",
value: `<@${interaction.user.id}>
${interaction.user.tag}
${interaction.user.id}`
},
{
name: "💬 Bericht",
value: message
}
], user.displayAvatarURL({ dynamic: true }));

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