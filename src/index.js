const {
    Client,
    GatewayIntentBits,
    Routes,
    REST,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionsBitField,
    ChannelType
} = require("discord.js");
const fs = require("fs");
require("dotenv").config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// CONFIG
const STAFF_ROLE_ID = "1483897887099457597";
const TICKET_CATEGORY_ID = "1499772476576628776";
const WELCOME_CHANNEL_ID = "1500068015205646446";

// REST per registrare i comandi
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

// -----------------------------
// 🔧 REGISTRAZIONE COMANDI
// -----------------------------
client.on("ready", async () => {
    console.log(`Bot online come ${client.user.tag}`);

    await rest.put(
        Routes.applicationCommands(client.user.id),
        {
            body: [
                {
                    name: "ticket",
                    description: "Invia il pannello per aprire un ticket"
                },
                {
                    name: "timeout",
                    description: "Metti un utente in timeout",
                    options: [
                        {
                            name: "utente",
                            type: 6,
                            description: "Chi vuoi timeouttare?",
                            required: true
                        },
                        {
                            name: "minuti",
                            type: 4,
                            description: "Durata del timeout",
                            required: true
                        },
                        {
                            name: "motivo",
                            type: 3,
                            description: "Motivo del timeout",
                            required: false
                        }
                    ]
                },
                {
                    name: "purge",
                    description: "Elimina un numero di messaggi",
                    options: [
                        {
                            name: "numero",
                            type: 4,
                            description: "Quanti messaggi eliminare",
                            required: true
                        }
                    ]
                },
                {
                    name: "warn",
                    description: "Warnare un utente",
                    options: [
                        {
                            name: "utente",
                            type: 6,
                            description: "Chi vuoi warnare?",
                            required: true
                        },
                        {
                            name: "motivo",
                            type: 3,
                            description: "Motivo del warn",
                            required: true
                        }
                    ]
                }
            ]
        }
    );

    console.log("Comandi registrati!");
});

// -----------------------------
// 🎉 SISTEMA DI BENVENUTO
// -----------------------------
client.on("guildMemberAdd", async member => {
    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle("👋 Benvenuto!")
        .setDescription(`Ciao **${member.user.username}**, benvenuto nel server! 🎉`)
        .setColor("Green")
        .setThumbnail(member.user.displayAvatarURL());

    channel.send({ embeds: [embed] });
});

// -----------------------------
// 🎫 SISTEMA TICKET + COMANDI
// -----------------------------
client.on("interactionCreate", async interaction => {

    // -----------------------------
    // /ticket
    // -----------------------------
    if (interaction.isChatInputCommand() && interaction.commandName === "ticket") {

        const embed = new EmbedBuilder()
            .setTitle("🎫 Sistema Ticket")
            .setDescription("Seleziona il tipo di ticket che vuoi aprire:")
            .setColor("Blue");

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("ticket_supporto").setLabel("Supporto").setEmoji("📝").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("ticket_report").setLabel("Report").setEmoji("🚨").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId("ticket_partnership").setLabel("Partnership").setEmoji("🤝").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("ticket_altro").setLabel("Altro").setEmoji("📩").setStyle(ButtonStyle.Secondary)
        );

        return interaction.reply({ embeds: [embed], components: [row] });
    }

    // -----------------------------
    // BOTTONI TICKET
    // -----------------------------
    if (interaction.isButton()) {

        let motivo = null;
        if (interaction.customId === "ticket_supporto") motivo = "Supporto";
        if (interaction.customId === "ticket_report") motivo = "Report";
        if (interaction.customId === "ticket_partnership") motivo = "Partnership";
        if (interaction.customId === "ticket_altro") motivo = "Altro";

        if (motivo !== null) {
            await interaction.deferReply({ ephemeral: true });

            const existing = interaction.guild.channels.cache.find(
                c => c.name === `ticket-${interaction.user.id}`
            );

            if (existing) {
                return interaction.editReply({ content: "Hai già un ticket aperto!" });
            }

            const channel = await interaction.guild.channels.create({
                name: `ticket-${interaction.user.id}`,
                type: ChannelType.GuildText,
                parent: TICKET_CATEGORY_ID,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    {
                        id: interaction.user.id,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ReadMessageHistory
                        ]
                    },
                    {
                        id: STAFF_ROLE_ID,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ReadMessageHistory
                        ]
                    }
                ]
            });

            const embed = new EmbedBuilder()
                .setTitle(`🎟️ Ticket Aperto — ${motivo}`)
                .setDescription("Spiega il tuo problema, lo staff ti risponderà al più presto.")
                .setColor("Green");

            const closeButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("close_ticket").setLabel("Chiudi Ticket").setStyle(ButtonStyle.Danger)
            );

            await channel.send({
                content: `<@${interaction.user.id}>`,
                embeds: [embed],
                components: [closeButton]
            });

            return interaction.editReply({ content: `Ticket creato: ${channel}` });
        }

        if (interaction.customId === "close_ticket") {
            await interaction.channel.delete();
        }
    }

    // -----------------------------
    // 🔧 COMANDI MODERAZIONE
    // -----------------------------
    if (interaction.isChatInputCommand()) {

        // /timeout
        if (interaction.commandName === "timeout") {
            if (!interaction.member.permissions.has("ModerateMembers"))
                return interaction.reply({ content: "Non hai i permessi.", ephemeral: true });

            const user = interaction.options.getMember("utente");
            const duration = interaction.options.getInteger("minuti");
            const reason = interaction.options.getString("motivo") || "Nessun motivo";

            await user.timeout(duration * 60 * 1000, reason);
            return interaction.reply(`⏳ ${user} è stato messo in timeout per ${duration} minuti.`);
        }

        // /purge
        if (interaction.commandName === "purge") {
            if (!interaction.member.permissions.has("ManageMessages"))
                return interaction.reply({ content: "Non hai i permessi.", ephemeral: true });

            const amount = interaction.options.getInteger("numero");

            await interaction.channel.bulkDelete(amount, true);
            return interaction.reply(`🧹 Eliminati ${amount} messaggi.`);
        }

        // /warn
        if (interaction.commandName === "warn") {
            if (!interaction.member.permissions.has("ModerateMembers"))
                return interaction.reply({ content: "Non hai i permessi.", ephemeral: true });

            const user = interaction.options.getUser("utente");
            const reason = interaction.options.getString("motivo");

            let warns = JSON.parse(fs.readFileSync("warns.json", "utf8"));
            if (!warns[user.id]) warns[user.id] = [];
            warns[user.id].push({ reason, by: interaction.user.id, date: Date.now() });

            fs.writeFileSync("warns.json", JSON.stringify(warns, null, 2));

            return interaction.reply(`⚠️ ${user} è stato warnato: **${reason}**`);
        }
    }
});

// LOGIN
client.login(process.env.TOKEN);
