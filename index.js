const crypto = require('crypto')
const Telegraf = require('telegraf')
const LocalSession = require('telegraf-session-local')
const qrcode = require('qrcode')
const imageDataURI = require('image-data-uri')
const Spotify = require('spotify-web-api-node')
const express = require('express')
const bodyParser = require('body-parser')

const { spotify_auth } = require('./spotify.js')

const { port, token, spotify_client_id, spotify_secret_id, spotify_redirect_uri } = require('./config.js')

const spotify = new Spotify({
  redirectUri: spotify_redirect_uri + '/spotify-callback',
  clientId: spotify_client_id,
  clientSecret: spotify_secret_id
})

const localSession = new LocalSession({ database: 'sessions.json' })

const app = express()

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

app.get('/spotify-callback', (req, res) => {
  console.log(req.query)
  res.end('ok')

  const [user_uuid, user_id] = req.query.state.split('/')

  const session = localSession.DB.get('sessions').getById(user_id + ':' + user_id).value()

  spotify.authorizationCodeGrant(req.query.code).then(({ body }) => {
    session.data.spotify_callback_code = req.query.code
    session.data.spotify_access_token = body.access_token
    session.data.spotify_refresh_token = body.refresh_token

    session.data.spotify_expire_time = Date.now() + (body.expires_in * 1000)

    localSession.DB.get('sessions').updateById(user_id + ':' + user_id, session)

    console.log(localSession.DB.get('sessions').getById(user_id + ':' + user_id).value())
  })

})


app.listen(port)

const md = require('./md.js')

const gen_id = (length=48) => crypto.randomBytes(length).toString('base64')

const logs = []

const bot = new Telegraf(token)

bot.use(localSession.middleware())

bot.start(ctx => {
  console.log('started:', ctx.from.id)
  console.log(ctx)
  return ctx.reply('Welcome!')
})

bot.use((ctx, next) => {
  if(ctx.update.message) {
    if(!ctx.session || !ctx.session.uuid) ctx.session.uuid = gen_id()
    console.log(`${ctx.update.message.from.username}: ${ctx.update.message.text}`)
    console.log('||> ' + new Date(ctx.update.message.date) + ' ' + ctx.session.uuid.substr(0, 8))
    logs.push({
      message: ctx.update.message.text,
      sender: ctx.update.message.from.username,
      date: new Date(ctx.update.message.date)
    })
  } else {
    console.log('ctx.update.message object not found, error')
  }
  next()
})

const qr_fn = (text, cb) =>
  qrcode.toDataURL(text, (err, url) =>
    cb({source: imageDataURI.decode(url).dataBuffer}, {caption: text}))

const md_fn = (text, date, cb) => md(text, date + '.md', (filename) => {
  console.log('done: ' + filename)
  cb({source: filename})
})

/*
help - show this help page
homepage - show the bots homepage
author - shows my name and username
github - show my github (https://github.com/JannikWibker)
src - show the github repo for the bot (https://github.com/JannikWibker/EnceladusBot)
qr - create a QR code for the specified text
md - create a pdf from the specified markdown
lmgtfy - create a lmgtfy link for the specified text
*/

bot.command('help', ctx =>
  ctx.replyWithMarkdown(`commands:
  full documentation: http://jannik.ddns.net/enceladusbot/docs
  help: show this help page
  homepage: show the bots homepage
  author: shows my name and username
  github: show my github (https://github.com/JannikWibker)
  src: show the github repo for the bot (https://github.com/JannikWibker/EnceladusBot)
  qr: create a QR code for the specified text
    usage: \`/qr http://jannik.ddns.net/enceladusbot\`
  md: create a pdf from the specified markdown (supports LaTeX math syntax, dot diagrams, ...; uses [mume](https://github.com/shd101wyy/mume) and [puppeteer](https://github.com/GoogleChrome/puppeteer) under the hood)
    usage:
\`/md this is the **sum** for calculating the *left sum* for a given $f(x)$ from $0$ to $l$ and with a stepsize of $s$: $$\\sum_{i=0}^{\\frac{l}{s}} f(i \\cdot s) \\cdot s$$\`
  lmgtfy: create a lmgtfy link for the specified text
    usage: \`/lmgtfy how to use let me google that for you\`
  `))

bot.on('sticker', ctx => ctx.reply('👍🏻'))

// "generic" commands

bot.command('whoami', ctx => ctx.replyWithMarkdown(`You are *${ctx.from.username}* and internally I may know you as \`${ctx.session.uuid}\` or \`${ctx.from.id}\`. Also this some data I received from Telegram about you:\n\`\`\`json\n${JSON.stringify(ctx.from, 2, 2)}\n\`\`\``))

bot.command('homepage', ctx => ctx.reply('https://bot.jannik.ml'))

bot.command('github', ctx => ctx.reply('https://github.com/JannikWibker'))

bot.command('src', ctx => ctx.reply('https://github.com/JannikWibker/enceladusbot, https://git.jannik.ml/jannik/EnceladusBot'))

bot.command('author', ctx => ctx.reply(`Jannik Wibker: @jannnik`))

// more specialized commands

bot.command('qr', ctx =>
  qr_fn(ctx.update.message.text.substr(4) || 'sample qr code', ctx.replyWithPhoto))

bot.command('md', ctx =>
  md_fn(ctx.update.message.text.substr(4), ctx.update.message.date, ctx.replyWithDocument))

bot.command('lmgtfy', ctx =>
  ctx.reply('http://www.lmgtfy.com/?q=' + ctx.update.message.text.split(' ').slice(1).join('+')))

// spotify commands

bot.command('spotify', ctx => {
  if(!ctx.session.spotify_access_token) {
    const authorizeUrl = spotify.createAuthorizeURL(['user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing', 'streaming', 'app-remote-control'], ctx.session.uuid + '/' + ctx.from.id)
    ctx.replyWithMarkdown(`To be able to use @EnceladusBot with spotify you have to authorize @EnceladusBot to do some basic things [here](${authorizeUrl})\n\n  You can always sign out again using \`/spotify_logout\`\n\n  [Authorize Enceladus for Spotify](${authorizeUrl})`)
  } else {
    ctx.replyWithMarkdown('`' + ctx.session.spotify_code + '`')
  }
})

bot.command('spotify_logout', ctx => {
  ctx.session.spotify_code = null
  ctx.session.spotify_access_token = null
  ctx.session.spotify_refresh_token = null
  console.log(ctx.session)
  ctx.reply('logged out of spotify.')
})

bot.on('text', ctx => {
  const text = ctx.update.message.text

  if(text === 'start playing' || text === 'play'  || text === 'spotify play'  || text === 'spotify start playing') {
    spotify_auth(spotify, ctx.session)
      .then(spotify => {
        spotify.play()
          .then(() => ctx.reply('playing now'))
          .catch(() => ctx.reply('Your account is not a Premium account, spotify does not allow that.'))
      })
      .catch(() => {
        ctx.reply('something went wrong')
      })
      
  } else if(text === 'stop playing'  || text === 'pause' || text === 'spotify pause' || text === 'spotify stop playing' ) {
    spotify_auth(spotify, ctx.session)
    .then(spotify => {
      ctx.reply('paused now')
      spotify.pause()
      .then(() => ctx.reply('paused now'))
      .catch(() => ctx.reply('Your account is not a Premium account, spotify does not allow that.'))
    })
    .catch(() => {
      ctx.reply('something went wrong')
    })
  } else if(
    text === 'song' || text === 'song?' || 
    text === 'what is this song' || text === 'what is this song?' || 
    text === 'what is that song' || text === 'what is that song?' || 
    text === 'what song is this' || text === 'what song is this?' || 
    text === 'what song is that' || text === 'what song is that?') {
    spotify_auth(spotify, ctx.session)
      .then(spotify => {
        spotify.getMyCurrentPlaybackState({ market: 'DE' })
          .then(({ body }) => {
            console.log(body)

            if(body.currently_playing_type === 'ad') {
              return ctx.reply('currently playing an advertisement')
            }

            const images = body.item.album && body.item.album.images ? body.item.album.images : []

            ctx.replyWithMarkdown(`listening to *${body.item.name} - ${body.item.artists.map(artist => artist.name).join(', ')}* ${images.length > 0 ? ('[﻿](' + images[0].url + ')') : ''}\non your *${body.device.type}*`)
          })
          .catch(err => {
            console.log(err)
            ctx.replyWithMarkdown('```json\n' + JSON.stringify(err, 2, 2) + '\n```')
        })
      })
      .catch(() => {
        ctx.reply('something went wrong')
      })
    }
  
})

// IoT commands



// accounts commands

bot.startPolling()
