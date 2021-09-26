const Discord = require("discord.js");
const {prefix, token} = require("./config.json");
const ytdl = require("ytdl-core");
const ytsr = require('ytsr');
let errorLogChannel;
const packageJSON = require("./package.json");

const client = new Discord.Client();

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

client.on("message", async message => {
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
            await message.channel.send("You need to enter a valid command!");
        }
        asdf
    } catch (e) {
        await message.channel.send("There was an error trying to execute this command!");
        console.log(e);
        errorLogChannel.send(e.stack.toString());
    }
    // console.log("didnt do anything, lol")
});

async function execute(message, serverQueue) {
    const args = message.content.split(" ");
    args.shift();
    console.log(typeof args)
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel)
        return message.channel.send(
            "You need to be in a voice channel to play music!"
        );
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
        return message.channel.send(
            "I need the permissions to join and speak in your voice channel!"
        );
    }
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
            queueContruct.connection = await voiceChannel.join();
            play(message.guild, queueContruct.songs[0]);
        } catch (err) {
            console.log(err);
            queue.delete(message.guild.id);
            return message.channel.send(err);
        }
    } else {
        serverQueue.songs.push(song);
        return message.channel.send(`${song.title} has been added to the queue!`);
    }
}

function showQueue(message, serverQueue) {
    let list = ""
    for (let i in serverQueue.songs) {
        list += `\`${serverQueue.songs[i].title}\`\n`
    }
    const eb = new Discord.MessageEmbed()
        .setTitle("Current queue:")
        .setDescription(list);
    message.channel.send(eb);
}

function skip(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send(
            "You have to be in a voice channel to stop the music!"
        );
    if (!serverQueue)
        return message.channel.send("There is no song that I could skip!");
    serverQueue.connection.dispatcher.end();
}

function stop(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send(
            "You have to be in a voice channel to stop the music!"
        );

    if (!serverQueue)
        return message.channel.send("There is no song that I could stop!");

    serverQueue.songs = [];
    serverQueue.connection.dispatcher.end();
}

async function play(guild, song) {
    const serverQueue = queue.get(guild.id);
    if (!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }

    const dispatcher = serverQueue.connection
        .play(ytdl(song.url))
        .on("finish", () => {
            serverQueue.songs.shift();
            play(guild, serverQueue.songs[0]);
        })
        .on("error", error => console.error(error));
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
    serverQueue.textChannel.send(`Start playing: **${song.title}**`);
}

client.login(token).then(r => console.log(r));