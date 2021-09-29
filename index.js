const Discord = require("discord.js");
const {Client, Intents} = require('discord.js');
const {prefix, token} = require("./config.json");
const ytdl = require("ytdl-core");
const ytsr = require('ytsr');
let errorLogChannel;
const packageJSON = require("./package.json");
const {
    joinVoiceChannel,
    getVoiceConnection,
    VoiceConnectionStatus,
    entersState,
    AudioPlayerStatus
} = require('@discordjs/voice');
const voice = require("@discordjs/voice");
// import { createDiscordJSAdapter } from './adapter';

const client = new Discord.Client({intents: [Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.GUILD_MESSAGES, Discord.Intents.FLAGS.GUILD_VOICE_STATES]})

const queue = new Map();

client.once("ready", () => {
    console.log("Ready!");
    const discordJSVersion = packageJSON.dependencies["discord.js"];
    console.log(`Discord.js version: ${discordJSVersion}`);
    errorLogChannel = client.channels.cache.get("891677596117504020");
});

client.once("reconnecting", () => {
    console.log("Reconnecting!");
});

client.once("disconnect", () => {
    console.log("Disconnect!");
});

client.on("messageCreate", async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;

    const serverQueue = queue.get(message.guild.id);

    try {
        if (message.content.startsWith(`${prefix}play`)) {
            execute(message, serverQueue);
            return;
        } else if (message.content.startsWith(`${prefix}skip`)) {
            skip(message, serverQueue);
            return;
        } else if (message.content.startsWith(`${prefix}stop`)) {
            stop(message, serverQueue);
            return;
        } else if (message.content.startsWith(`${prefix}queue`)) {
            showQueue(message, serverQueue);
        } else {
            await message.channel.send({
                embeds: [{
                    title: "You need to enter a valid command!",
                    color: "#ff0000"
                }]
            });
        }
    } catch (e) {
        await message.channel.send({
            embeds: [{
                title: `There was an error trying to execute this command!`,
                color: "#ff0000"
            }]
        });
        // console.log(e.stack.toString());

        console.debug(message.url.toString())
        let error = e.stack.toString().toString()
        console.debug(error)
        let test = "test"
        const errorEmbed = {
            title: `There was an error trying to execute a command!`,
            description: error,
            fields: [
                {
                    name: "Link to the message:",
                    value: `${message.url.toString()} !`,
                }
            ],
            color: "#ff0000",
            timestamp: new Date(),
        }
        console.debug(errorEmbed)
        console.debug(error.length)
        errorLogChannel.send({
            embeds: [errorEmbed]
        });
    }
});

async function execute(message, serverQueue) {
    const args = message.content.split(" ");
    args.shift();
    console.log(typeof args)
    const voiceChannel = message.member.voice.channel;
    console.log(voiceChannel)
    if (!voiceChannel)
        return message.channel.send({
                embeds: [{
                    title: "You need to be in a voice channel to play music!",
                    color: "#ff0000"
                }]
            }
        );
    // voiceChannel.per
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
        return message.channel.send({
                embeds: [{
                    title: "I need the permissions to join and speak in your voice channel!",
                    color: "#ff0000"
                }]
            }
        );
    }
    let msg = await message.channel.send({
        embeds: [{
            title: "Searching for '" + args.join(" ") + "' on YouTube!",
            color: "#ff0000"
        }]
    })
    console.log(msg)
    console.log(args.join(" "))
    let result = await ytsr(args.join(" "))
    const songInfo = await ytdl.getInfo(result.items[0].url);
    const song = {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url,
    };
    console.log(song)

    if (!serverQueue) {
        const queueContruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true
        };

        queue.set(message.guild.id, queueContruct);

        queueContruct.songs.push(song);

        try {
            // queueContruct.VCconnection = await getVoiceConnection(voiceChannel.guildId);
            // queueContruct.VCconnection = await getVoiceConnection(`861522903522607124`);
            queueContruct.VCconnection = voice.joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: message.channel.guild.voiceAdapterCreator,
            });
            console.log(queueContruct.VCconnection)
            try {
                await voice.entersState(queueContruct.VCconnection, voice.VoiceConnectionStatus.Ready, 30e3);
            } catch (error) {
                queueContruct.VCconnection.destroy();
                // return console.error(error);
                throw new Error(error);
            }
            // console.log(message.member.voice.channel.id)
            // console.log(message.member.voice.channel.guildId)
            // console.log(message.member.voice.channel.guild.voiceAdapterCreator)
            // console.log(queueContruct.VCconnection)
            // await entersState(queueContruct.VCconnection, VoiceConnectionStatus.Ready, 30e3);
            // queueContruct.connection = await voiceChannel.join();
            await play(message.guild, queueContruct.songs[0], message, msg);
        } catch (err) {
            console.log(err);
            queue.delete(message.guild.id);
            // return message.channel.send(err.stack.toString());
            throw new Error(err);
        }
    } else {
        serverQueue.songs.push(song);
        return message.channel.send({
            embeds: [{
                title: `${song.title} has been added to the queue!`,
                color: "#00ffff"
            }]
        });
    }
}

function showQueue(message, serverQueue) {
    try {
        console.log(serverQueue.songs)
        if (serverQueue.songs.length < 1) return message.channel.send({
            embeds: [{
                title: `The Queue is empty!`,
                color: "#00ffff"
            }]
        });
        let list = ""
        for (let i in serverQueue.songs) {
            list += `\`${serverQueue.songs[i].title}\`\n`
        }
        console.debug(list)
        const eb = new Discord.MessageEmbed()
            .setTitle("Current queue:")
            .setDescription(list);
        // message.channel.send(eb);
    } catch (e) {
        throw new Error(e)
    }
}

function skip(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send({
                embeds: [{
                    title:
                        "You have to be in a voice channel to stop the music!",
                    color: "#ff0000"
                }]
            }
        );
    if (!serverQueue)
        return message.channel.send({
            embeds: [{
                title: "There is no song that I could skip!",
                color: "#ff0000"
            }]
        });
    serverQueue.connection.end();
}

function stop(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send({
                embeds: [{
                    title: "You have to be in a voice channel to stop the music!",
                    color: "#ff0000"
                }]
            }
        );

    if (!serverQueue)
        return message.channel.send({
            embeds: [{
                title: "There is no song that I could stop!",
                color: "#ff0000"
            }]
        });

    serverQueue.songs = [];
    // serverQueue.connection.destroy();
    serverQueue.connection.disconnect();
}

async function play(guild, song, message, msg) {
    const serverQueue = queue.get(guild.id);
    // if (!song) {
    //     serverQueue.voiceChannel.leave();
    //     queue.delete(guild.id);
    //     return;
    // }
    // console.log(serverQueue.VCconnection)
    // const dispatcher = serverQueue.VCconnection
    //     // .play(ytdl(song.url))
    //     .subscribe(ytdl(song.url))
    // .on("finish", () => {
    //     serverQueue.songs.shift();
    //     play(guild, serverQueue.songs[0]);
    // })
    // .on("error", error => console.error(error));
    const videoinfo = await ytdl.getInfo(song.url);
    try {
        var stream = await ytdl.downloadFromInfo(videoinfo);
    } catch (error) {
        await message.reply(`Error while creating stream`);
        // console.error(error);
        throw new Error(error);
    }

    const player = voice.createAudioPlayer()


    const resource = voice.createAudioResource(stream, {
        inputType: voice.StreamType.Arbitrary,
        inlineVolume: true
    });
    player.play(resource);
    await voice.entersState(player, voice.AudioPlayerStatus.Playing, 5e3);


    serverQueue.VCconnection.subscribe(player);

    player.on('subscribe', async () => {
        await message.reply({
            embeds: [{
                title: `:thumbsup: Now Playing ***${song.title}***`,
                color: "#00ff00"
            }]
        });
        setTimeout(() => msg.delete(), 1);
    });
    // dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
    // serverQueue.textChannel.send({
    //     embeds: [{
    //         title: `Start playing: **${song.title}**`,
    //         color: "#00ff00"
    //     }]
    // });
}


client.login(token).then(r => console.log(r));