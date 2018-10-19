const path = require('path')

const Telegraf = require('telegraf')
const LocalSession = require('telegraf-session-local')
const Spotify = require('spotify-web-api-node')

const express = require('express')
const bodyParser = require('body-parser')

const { spotify_auth } = require('./spotify.js')
const { commands } = require('./commands')
const utils = require('./utils.js')

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

app.use(express.static('public'))

app.get('/', (req, res) => res.redirect('https://web.jannik.ml/enceladusbot'))

app.get('/spotify-callback', (req, res) => {
  console.log(req.query)
  res.sendFile(path.join(__dirname, 'public', 'connected_spotify.html'))

  const [user_uuid, user_id] = req.query.state.split('-')

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

const logs = []

const bot = new Telegraf(token)

bot.use(localSession.middleware())
bot.use(utils.logger(logs))
bot.start(ctx => {
  console.log('started:', ctx.from.id)
  console.log(ctx)
  return ctx.reply('Welcome!')
})

Object.keys(commands).map(key => bot.command(key, ctx => commands[key](ctx)))

// spotify commands

bot.command('spotify', ctx => {
  if(!ctx.session.spotify_access_token) {
    const authorizeUrl = spotify.createAuthorizeURL(['user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing', 'streaming', 'app-remote-control'], ctx.session.uuid + '-' + ctx.from.id)
    ctx.replyWithMarkdown(`To be able to use @EnceladusBot with spotify you have to authorize @EnceladusBot to do some basic things [here](${authorizeUrl})\n\n  You can always sign out again using \`/spotify_logout\`\n\n  [Authorize Enceladus for Spotify](${authorizeUrl})`)
  } else {
    ctx.replyWithMarkdown('`' + ctx.session.spotify_callback_code + '`')
  }
})

bot.command('spotify_logout', ctx => {
  ctx.session.spotify_callback_code = null
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
      ctx.reply('something went wrong, probably just not logged in')
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
        ctx.reply('something went wrong, probably just not logged in')
      })
    }
  
})

// IoT commands



// accounts commands

bot.startPolling()
