const path = require('path')

const Telegraf = require('telegraf')
const LocalSession = require('telegraf-session-local')
const Spotify = require('spotify-web-api-node')

const express = require('express')
const bodyParser = require('body-parser')

const { spotify_auth } = require('./spotify.js')
const { commands } = require('./commands')
const utils = require('./utils.js')

const passport = require('passport')
const accounts = require('./accounts.js')
const fetch = require('node-fetch')

const { version } = require('./package.json')

const { port, env, token, spotify_client_id, spotify_secret_id, spotify_redirect_uri, auth } = require('./config.js')

const auth_fetch = (jwt, url, method='GET', body={}) => fetch('https://accounts.jannik.ml' + url, {
  method: method,
  headers: {
    'Authorization': 'Bearer ' + jwt,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(body)
})
  .then(res => res.json())

const spotify = new Spotify({
  redirectUri: spotify_redirect_uri + '/spotify-callback',
  clientId: spotify_client_id,
  clientSecret: spotify_secret_id
})

accounts(
  auth.SECRET,
  auth.ACCOUNTSERVER || 'http://localhost:3003',
  auth.KNOWN_SERVICE,
  auth.RETRY_ON_FAIL,
  { name: auth.NAME, id: auth.ID, url: auth.CALLBACKURL || ('http://localhost:' + port + '/auth'), app: auth.APP || 'https://t.me/enceladusbot' },
  auth.RETRY_ON_FAIL ? 10 : 0,
  ({ JWTStrategy, login, logout }) => {

    passport.use(JWTStrategy)
    app.use(passport.initialize())

    app.post('/auth/login', passport.authenticate('jwt', { session: false }), login)
    app.post('/auth/logout', passport.authenticate('jwt', { session: false }), logout)

    app.get('/', (req, res) => res.send('server is up and running'))

    app.get('/current-version', (_, res) => res.send(version))

  }
)

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

  console.log(user_id)

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

app.get('/auth-callback', (req, res) => {
  console.log('user authenticated', req.query)
  res.sendFile(path.join(__dirname, 'public', 'connected_auth.html'))
  
  const temp_split = req.query.href.split(',')

  const state = {
    jwt: req.query.jwt,
    telegram: {
      username: temp_split[0],
      session: temp_split[1],
      user_id: temp_split[2]
    },
    ...JSON.parse(Buffer.from(req.query.jwt.split('.')[1], 'base64').toString('binary'))
  }

  console.log(state)

  const session = localSession.DB.get('sessions').getById(state.telegram.user_id + ':' + state.telegram.user_id).value()

  session.data.auth_jwt = state.jwt
  session.data.auth_username = state.username
  session.data.auth_user_id = state.id
  session.data.auth_account_type = state.account_type
  session.data.auth_iat = state.iat

  // should this somehow get the refresh_token?
  

  localSession.DB.get('sessions').updateById(state.telegram.user_id + ':' + state.telegram.user_id, session)
})

app.post('/login', (req, res) => {
  res.end('ok')
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

bot.command('env', ctx => ctx.reply('running in ' + env + ' environment.'))

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

bot.command('auth', ctx => {
  if(!ctx.session.auth_jwt || ctx.session.auth_iat*1000 > Date.now() + 30 * 60 * 1000) {
    const link = auth.ACCOUNTSERVER + '/login?from=' + encodeURIComponent(auth.REDIRECTURL) + '&href=' + encodeURIComponent(ctx.from.username + ',' + ctx.session.uuid + ',' + ctx.from.id) + '&id=' + auth.ID
    console.log(link)
    ctx.replyWithMarkdown('authenticate yourself [here](' + link + ')')
  } else {
    ctx.replyWithMarkdown('your telegram account is linked to the account *' + ctx.session.auth_username + '*')
  }
})

bot.command('auth_logout', ctx => {
  ctx.session.auth_jwt = null
  ctx.session.auth_username = null
  ctx.session.auth_user_id = null
  ctx.session.auth_account_type = null
  ctx.session.auth_iat = null
  console.log(ctx.session)
  ctx.reply('logged out of auth.')
})

bot.on('text', ctx => {
  const text = ctx.update.message.text

  if(
    text === 'list accounts' || text === 'list-accounts' || text === 'accounts list' ||
    text === 'list account'  || text === 'list-account'  || text === 'account list'  ||
    text === 'list users'    || text === 'list-users'    || text === 'users list'    ||
    text === 'list user'    || text === 'list-user'    || text === 'user list') {
      auth_fetch(ctx.session.auth_jwt, '/users/list', 'POST', {})
        .then(json => {
          if(json.status === 'failure') {
            return ctx.reply('You\'re not permitted.')
          }
          const prettified_users = json.users.map(account =>
            `*${account.username}* (${account.first_name} ${account.last_name})\t[${account.email}](mailto://${account.email}), ${account.id}${account.account_type === 'default' ? '' : ', *' + account.account_type + '*'}`
          )
          console.log(prettified_users.join('\n'))
          return ctx.replyWithMarkdown('*accounts*:\n' + prettified_users.join('\n'))
        })
        .catch(err => {
          ctx.reply('Something went wrong.')
        })

  } else if(
    text === 'get account' || text === 'show account' || text === 'account details' ||
    text === 'get user'    || text === 'show user'    || text === 'user details') {
      auth_fetch(ctx.session.auth_jwt, '/users/get', 'POST', {})
        .then(json => {
          if(json.status === 'failure') return ctx.reply('You\'re not permitted.')

        })
        .catch(err => ctx.reply('Something went wrong.'))
  } else if(
    1
  ) {

  } else if(
    1
  ) {
    
  }

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
    text === 'whats that song'   || text === 'whats that song?'   ||
    text === 'whats that song'   || text === 'whats that song?'   ||
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
