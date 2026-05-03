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
} = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ID del ruolo staff
const STAFF_ROLE_ID = "1483897887099457597";

// ID della categoria ticket
const TICKET_CATEGORY_ID = "1499772476576628776";

// ID del canale di benvenuto
const WELCOME_CHANNEL_ID = "1500068015205646446";

// Registrazione comando /ticket
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

client.on("ready", async () => {
    console.log(`Bot online come ${client.user.tag}`);

    await rest.put(
        Routes.applicationCommands(client.user.id),
        {
            body: [
                {
                    name: "ticket",
                    description: "Invia il pannello per aprire un ticket"
                }
            ]
        }
    );
});


// -----------------------------
// 🎉 SISTEMA DI BENVENUTO
// -----------------------------
client.on("guildMemberAdd", async member => {
    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!channel) return console.log("Canale benvenuto non trovato!");

    const embed = new EmbedBuilder()
        .setTitle("👋 Benvenuto!")
        .setDescription(`Ciao **${member.user.username}**, benvenuto nel server! 🎉\nSperiamo ti troverai bene qui.`)
        .setColor("Green")
        .setThumbnail(member.user.displayAvatarURL());

    channel.send({ embeds: [embed] });
});


// -----------------------------
// 🎫 SISTEMA TICKET
// -----------------------------
client.on("interactionCreate", async interaction => {

    // Comando /ticket
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === "ticket") {

            const embed = new EmbedBuilder()
                .setTitle("🎫 Sistema Ticket")
                .setDescription("Seleziona il tipo di ticket che vuoi aprire:")
                .setColor("Blue");

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_supporto')
                        .setLabel('Supporto')
                        .setEmoji('📝')
                        .setStyle(ButtonStyle.Primary),

                    new ButtonBuilder()
                        .setCustomId('ticket_report')
                        .setLabel('Report')
                        .setEmoji('🚨')
                        .setStyle(ButtonStyle.Danger),

                    new ButtonBuilder()
                        .setCustomId('ticket_partnership')
                        .setLabel('Partnership')
                        .setEmoji('🤝')
                        .setStyle(ButtonStyle.Success),

                    new ButtonBuilder()
                        .setCustomId('ticket_altro')
                        .setLabel('Altro')
                        .setEmoji('📩')
                        .setStyle(ButtonStyle.Secondary)
                );

            return interaction.reply({
                embeds: [embed],
                components: [row]
            });
        }
    }

    // Bottoni
    if (interaction.isButton()) {

        let motivo = null;

        if (interaction.customId === 'ticket_supporto') motivo = "Supporto";
        if (interaction.customId === 'ticket_report') motivo = "Report";
        if (interaction.customId === 'ticket_partnership') motivo = "Partnership";
        if (interaction.customId === 'ticket_altro') motivo = "Altro";

        // Se è uno dei pulsanti ticket
        if (motivo !== null) {

            await interaction.deferReply({ ephemeral: true });

            const existing = interaction.guild.channels.cache.find(
                c => c.name === `ticket-${interaction.user.id}`
            );

            if (existing) {
                return interaction.editReply({
                    content: "Hai già un ticket aperto!"
                });
            }

            console.log("Tentativo creazione canale ticket per:", interaction.user.id);

            try {
                const channel = await interaction.guild.channels.create({
                    name: `ticket-${interaction.user.id}`,
                    type: ChannelType.GuildText,
                    parent: TICKET_CATEGORY_ID,
                    permissionOverwrites: [
                        {
                            id: interaction.guild.id,
                            deny: [PermissionsBitField.Flags.ViewChannel]
                        },
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

                console.log("Canale creato con ID:", channel.id);

                const embed = new EmbedBuilder()
                    .setTitle(`🎟️ Ticket Aperto — ${motivo}`)
                    .setDescription("Spiega il tuo problema, lo staff ti risponderà al più presto.")
                    .setColor("Green");

                const closeButton = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("close_ticket")
                        .setLabel("Chiudi Ticket")
                        .setStyle(ButtonStyle.Danger)
                );

                await channel.send({
                    content: `<@${interaction.user.id}>`,
                    embeds: [embed],
                    components: [closeButton]
                });

                return interaction.editReply({
                    content: `Ticket creato: ${channel}`
                });

            } catch (err) {
                console.error("ERRORE CREAZIONE CANALE:", err);
                return interaction.editReply({
                    content: `Errore nella creazione del ticket: \`${err.message}\``
                });
            }
        }

        // CHIUDI TICKET
        if (interaction.customId === "close_ticket") {
            await interaction.channel.delete();
        }
    }
});

client.login(process.env.TOKEN);
