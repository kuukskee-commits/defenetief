require("dotenv").config();

// =========================
// EXPRESS SERVER (VOOR RENDER)
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
.setDescription("Verwijder alle donatie rollen")
.addUserOption(option =>
option.setName("user")
.setDescription("De gebruiker")
.setRequired(true)),

new SlashCommandBuilder()
.setName("adddono")
.setDescription("Geef een donatie rol")
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

let banList = "✅ Niemand is momenteel gebanned.";

if (bans.size > 0) {
banList = bans.map(b => `🔹 <@${b.user.id}>`).join("\n");
}

const embed = new EmbedBuilder()
.setColor("#ff0000")
.setTitle("🔨 Server Ban Lijst")
.setDescription("Live overzicht van alle bans")
.addFields(
{ name: "📊 Totaal bans", value: `**${bans.size}**`, inline:true },
{ name: "👥 Gebande users", value: banList }
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

client.on("guildBanAdd", ban => updateBanList(ban.guild));
client.on("guildBanRemove", ban => updateBanList(ban.guild));


// =========================
// INTERACTIONS
// =========================
client.on("interactionCreate", async (interaction) => {

if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu()) return;


// ================= BAN =================
if (interaction.commandName === "ban") {

await interaction.deferReply();

if (!interaction.memberPermissions.has(PermissionsBitField.Flags.BanMembers))
return interaction.editReply("❌ Geen permissie.");

const user = interaction.options.getUser("user");
const reason = interaction.options.getString("reden") || "Geen reden.";

const member = await interaction.guild.members.fetch(user.id).catch(()=>null);

if(!member) return interaction.editReply("❌ User niet gevonden.");

await member.ban({reason});

interaction.editReply(`🔨 ${user.tag} is geband.`);

}


// ================= KICK =================
if (interaction.commandName === "kick") {

await interaction.deferReply();

if (!interaction.memberPermissions.has(PermissionsBitField.Flags.KickMembers))
return interaction.editReply("❌ Geen permissie.");

const user = interaction.options.getUser("user");
const member = await interaction.guild.members.fetch(user.id).catch(()=>null);

if(!member) return interaction.editReply("❌ User niet gevonden.");

await member.kick();

interaction.editReply(`👢 ${user.tag} is gekickt.`);

}


// ================= WIPE =================
if (interaction.commandName === "wipe") {

await interaction.deferReply();

const user = interaction.options.getUser("user");
const member = await interaction.guild.members.fetch(user.id);

const roles = member.roles.cache.filter(r => r.id !== interaction.guild.id);

await member.roles.remove(roles);

interaction.editReply(`🧹 Rollen verwijderd van ${user.tag}`);

}


// ================= DONOWIPE =================
if (interaction.commandName === "donowipe") {

await interaction.deferReply();

const user = interaction.options.getUser("user");
const member = await interaction.guild.members.fetch(user.id);

const roles = member.roles.cache.filter(r => DONATION_ROLES.includes(r.id));

await member.roles.remove(roles);

interaction.editReply(`💸 Donatie rollen verwijderd van ${user.tag}`);

}


// ================= ADD DONO =================
if (interaction.commandName === "adddono") {

if (!interaction.member.roles.cache.has(DONO_HANDLER_ROLE))
return interaction.reply({
content:"❌ Alleen donatie behandelaars kunnen dit gebruiken.",
ephemeral:true
});

const user = interaction.options.getUser("user");

const menu = new StringSelectMenuBuilder()
.setCustomId(`dono_select_${user.id}`)
.setPlaceholder("Selecteer donatie rol")
.addOptions([
{
label:"Perms +",
value:"1478887899695939714"
},
{
label:"Perms ++",
value:"1478887958537830523"
},
{
label:"Perms +++",
value:"1478888005635674254"
}
]);

const row = new ActionRowBuilder().addComponents(menu);

await interaction.reply({
content:`Selecteer een rol voor **${user.tag}**`,
components:[row],
ephemeral:true
});

}


// ================= DONO SELECT =================
if (interaction.isStringSelectMenu() && interaction.customId.startsWith("dono_select_")) {

const userId = interaction.customId.split("_")[2];
const roleId = interaction.values[0];

const member = await interaction.guild.members.fetch(userId);

await member.roles.add(roleId);

let donoText = "";

if(roleId === "1478887899695939714") donoText = "Donatie allert, Perms +";
if(roleId === "1478887958537830523") donoText = "Donatie allert, Perms ++";
if(roleId === "1478888005635674254") donoText = "Donatie allert, Perms +++";

const channel = interaction.guild.channels.cache.get(DONATION_ALERT_CHANNEL);

if(channel){
channel.send(`💰 **Nieuwe Donatie!**

👤 ${member}
📦 ${donoText}`);
}

await interaction.update({
content:`✅ Donatie rol gegeven aan ${member.user.tag}`,
components:[]
});

}


// ================= UNBAN =================
if (interaction.commandName === "unban") {

const bans = await interaction.guild.bans.fetch();

if(bans.size === 0)
return interaction.reply({content:"Geen bans.",ephemeral:true});

const options = bans.map(b => ({
label:b.user.tag,
value:b.user.id
})).slice(0,25);

const menu = new StringSelectMenuBuilder()
.setCustomId("unban_select")
.addOptions(options);

const row = new ActionRowBuilder().addComponents(menu);

interaction.reply({
content:"Selecteer iemand om te unbannen",
components:[row],
ephemeral:true
});

}

if (interaction.isStringSelectMenu() && interaction.customId === "unban_select") {

const id = interaction.values[0];

await interaction.guild.members.unban(id);

interaction.update({
content:"✅ User ge-unbanned.",
components:[]
});

}

});


// =========================
// LOGIN
// =========================
if (!process.env.TOKEN) {
console.error("❌ GEEN TOKEN");
} else {
client.login(process.env.TOKEN)
.then(()=>console.log("🔥 Bot online"))
.catch(console.error);
}