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
    SlashCommandBuilder
} = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});


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
        .setDescription("Unban een gebruiker via dropdown")

].map(cmd => cmd.toJSON());


// =========================
// READY EVENT
// =========================
client.once("ready", async () => {
    console.log(`✅ Online als ${client.user.tag}`);

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
});


// =========================
// INTERACTIONS
// =========================
client.on("interactionCreate", async (interaction) => {

    if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu()) return;


    // ================= BAN =================
    if (interaction.isChatInputCommand() && interaction.commandName === "ban") {

        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.BanMembers))
            return interaction.reply({ content: "❌ Geen permissie.", ephemeral: true });

        const user = interaction.options.getUser("user");
        const reason = interaction.options.getString("reden") || "Geen reden opgegeven.";

        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member)
            return interaction.reply({ content: "❌ User niet gevonden.", ephemeral: true });

        if (!member.bannable)
            return interaction.reply({ content: "❌ Ik kan deze persoon niet bannen.", ephemeral: true });

        const embed = new EmbedBuilder()
            .setColor("#FF0000")
            .setTitle("🚫 Je bent geband")
            .setDescription(
`Je bent permanent verwijderd uit **${interaction.guild.name}**.

📌 **Reden:**  
${reason}`
            )
            .setFooter({ text: "Server Administration" })
            .setTimestamp();

        try {
            await user.send({ embeds: [embed] });
        } catch {}

        await member.ban({ reason });

        await interaction.reply(`🔨 ${user.tag} is geband.`);
    }


    // ================= KICK =================
    if (interaction.isChatInputCommand() && interaction.commandName === "kick") {

        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.KickMembers))
            return interaction.reply({ content: "❌ Geen permissie.", ephemeral: true });

        const user = interaction.options.getUser("user");
        const reason = interaction.options.getString("reden") || "Geen reden opgegeven.";

        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member)
            return interaction.reply({ content: "❌ User niet gevonden.", ephemeral: true });

        if (!member.kickable)
            return interaction.reply({ content: "❌ Ik kan deze persoon niet kicken.", ephemeral: true });

        try {
            await user.send(`👢 Je bent gekickt uit ${interaction.guild.name}\nReden: ${reason}`);
        } catch {}

        await member.kick(reason);

        await interaction.reply(`👢 ${user.tag} is gekickt.`);
    }


    // ================= UNBAN COMMAND =================
    if (interaction.isChatInputCommand() && interaction.commandName === "unban") {

        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.BanMembers))
            return interaction.reply({ content: "❌ Geen permissie.", ephemeral: true });

        const bans = await interaction.guild.bans.fetch();

        if (bans.size === 0)
            return interaction.reply({ content: "✅ Er zijn geen gebande users.", ephemeral: true });

        const options = bans.map(ban => ({
            label: ban.user.tag,
            value: ban.user.id
        })).slice(0, 25);

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


    // ================= UNBAN SELECT =================
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
client.login(process.env.TOKEN);