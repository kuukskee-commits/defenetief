require("dotenv").config();

// =========================
// EXPRESS SERVER (VERPLICHT VOOR RENDER)
// =========================
const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.send("Bot is running");
});

app.listen(PORT, () => {
    console.log(`🌍 Web server running on port ${PORT}`);
});


// =========================
// DISCORD SETUP
// =========================
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

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
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

const BANNED_CHANNEL = "1479059891552387123";

let bannedMessage = null;


// =========================
// SLASH COMMANDS
// =========================
const commands = [

new SlashCommandBuilder()
.setName("ban")
.setDescription("Ban een gebruiker")
.addUserOption(option =>
option.setName("user")
.setDescription("De gebruiker")
.setRequired(true))
.addStringOption(option =>
option.setName("reden")
.setDescription("Reden van ban")
.setRequired(false)),

new SlashCommandBuilder()
.setName("kick")
.setDescription("Kick een gebruiker")
.addUserOption(option =>
option.setName("user")
.setDescription("De gebruiker")
.setRequired(true))
.addStringOption(option =>
option.setName("reden")
.setDescription("Reden van kick")
.setRequired(false)),

new SlashCommandBuilder()
.setName("unban")
.setDescription("Unban een gebruiker via dropdown"),

new SlashCommandBuilder()
.setName("wipe")
.setDescription("Verwijder alle rollen van een gebruiker")
.addUserOption(option =>
option.setName("user")
.setDescription("De gebruiker")
.setRequired(true)),

new SlashCommandBuilder()
.setName("donowipe")
.setDescription("Verwijder alle donatie rollen van een gebruiker")
.addUserOption(option =>
option.setName("user")
.setDescription("De gebruiker")
.setRequired(true))

].map(cmd => cmd.toJSON());


// =========================
// READY EVENT
// =========================
client.once("ready", async () => {

console.log(`✅ Online als ${client.user.tag}`);

client.user.setPresence({
activities: [{
name: "Betalen dat kan!",
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

console.log("✅ Slash commands geregistreerd.");

} catch (error) {
console.error("❌ Fout bij slash registratie:", error);
}

// start live banned list updater
setInterval(() => {
const guild = client.guilds.cache.get(process.env.GUILD_ID);
if (guild) updateBanList(guild);
}, 10000);

});


// =========================
// LIVE BAN LIST
// =========================
async function updateBanList(guild){

const channel = guild.channels.cache.get(BANNED_CHANNEL);
if(!channel) return;

const bans = await guild.bans.fetch();

const embed = new EmbedBuilder()
.setTitle("🔨 Live Ban Lijst")
.setColor("Red")
.setDescription(
bans.size === 0
? "✅ Niemand is momenteel gebanned."
: bans.map(b => `• ${b.user.tag}`).join("\n")
)
.setTimestamp();

if(!bannedMessage){

const msgs = await channel.messages.fetch({limit:10});
bannedMessage = msgs.find(m => m.author.id === guild.client.user.id);

}

if(!bannedMessage){

bannedMessage = await channel.send({embeds:[embed]});

}else{

await bannedMessage.edit({embeds:[embed]});

}

}

client.on("guildBanAdd", ban => {
updateBanList(ban.guild);
});

client.on("guildBanRemove", ban => {
updateBanList(ban.guild);
});


// =========================
// INTERACTIONS
// =========================
client.on("interactionCreate", async (interaction) => {

if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu()) return;


// ================= BAN =================
if (interaction.commandName === "ban") {

if (!interaction.memberPermissions.has(PermissionsBitField.Flags.BanMembers))
return interaction.reply({ content: "❌ Geen permissie.", ephemeral: true });

const user = interaction.options.getUser("user");
const reason = interaction.options.getString("reden") || "Geen reden opgegeven.";

const member = await interaction.guild.members.fetch(user.id).catch(() => null);

if (!member)
return interaction.reply({ content: "❌ User niet gevonden.", ephemeral: true });

if (!member.bannable)
return interaction.reply({ content: "❌ Ik kan deze persoon niet bannen.", ephemeral: true });

const banEmbed = new EmbedBuilder()
.setColor("#ff0000")
.setTitle("⛔ Je bent geband")
.setDescription(`Je bent permanent verwijderd uit **snitches get stitches**.`)
.addFields(
{ name: "🔨 Reden", value: reason },
{
name: "💰 Unban aanvraag",
value:
`Wil je opnieuw toegang tot de server krijgen?

💳 Kost: €30
💳 PayPal betaling
💳 Vermeld je Discord naam`
},
{
name: "🔗 PayPal link",
value: "https://paypal.me/JOUW_LINK_HIER"
}
)
.setTimestamp();

try {
await user.send({ embeds: [banEmbed] });
} catch {}

await member.ban({ reason });

await interaction.reply(`🔨 ${user.tag} is geband.`);
}


// ================= KICK =================
if (interaction.commandName === "kick") {

if (!interaction.memberPermissions.has(PermissionsBitField.Flags.KickMembers))
return interaction.reply({ content: "❌ Geen permissie.", ephemeral: true });

const user = interaction.options.getUser("user");
const reason = interaction.options.getString("reden") || "Geen reden opgegeven.";

const member = await interaction.guild.members.fetch(user.id).catch(() => null);

if (!member)
return interaction.reply({ content: "❌ User niet gevonden.", ephemeral: true });

if (!member.kickable)
return interaction.reply({ content: "❌ Ik kan deze persoon niet kicken.", ephemeral: true });

await member.kick(reason);

await interaction.reply(`👢 ${user.tag} is gekickt.`);
}


// ================= WIPE =================
if (interaction.commandName === "wipe") {

if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageRoles))
return interaction.reply({content:"❌ Geen permissie.",ephemeral:true});

const user = interaction.options.getUser("user");
const member = await interaction.guild.members.fetch(user.id);

const roles = member.roles.cache.filter(r => r.id !== interaction.guild.id);

await member.roles.remove(roles);

interaction.reply(`🧹 Alle rollen verwijderd van ${user.tag}`);

}


// ================= DONO WIPE =================
if (interaction.commandName === "donowipe") {

if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageRoles))
return interaction.reply({content:"❌ Geen permissie.",ephemeral:true});

const user = interaction.options.getUser("user");
const member = await interaction.guild.members.fetch(user.id);

const rolesToRemove = member.roles.cache.filter(role =>
DONATION_ROLES.includes(role.id)
);

await member.roles.remove(rolesToRemove);

interaction.reply(`💸 Donatie rollen verwijderd van ${user.tag}`);

}


// ================= UNBAN =================
if (interaction.commandName === "unban") {

if (!interaction.memberPermissions.has(PermissionsBitField.Flags.BanMembers))
return interaction.reply({ content: "❌ Geen permissie.", ephemeral: true });

const bans = await interaction.guild.bans.fetch();

if (bans.size === 0)
return interaction.reply({ content: "✅ Er zijn geen gebande users.", ephemeral: true });

const options = bans.map(ban => ({
label: ban.user.tag,
value: ban.user.id
})).slice(0,25);

const selectMenu = new StringSelectMenuBuilder()
.setCustomId("unban_select")
.setPlaceholder("Selecteer iemand om te unbannen")
.addOptions(options);

const row = new ActionRowBuilder().addComponents(selectMenu);

await interaction.reply({
content: "Selecteer een gebruiker om te unbannen:",
components: [row],
ephemeral: true
});

}

if (interaction.isStringSelectMenu() && interaction.customId === "unban_select") {

const userId = interaction.values[0];

await interaction.guild.members.unban(userId);

await interaction.update({
content: "✅ Gebruiker succesvol ge-unbanned.",
components: []
});

}

});


// =========================
// LOGIN
// =========================
console.log("TOKEN =", process.env.TOKEN ? "BESTAAT" : "BESTAAT NIET");

if (!process.env.TOKEN) {
console.error("❌ GEEN TOKEN GEVONDEN");
} else {
client.login(process.env.TOKEN)
.then(() => console.log("🔥 Discord login succesvol"))
.catch(err => console.error("❌ Login fout:", err));
}