const Telegraf = require('telegraf')
const qrcode = require('qrcode')
const imageDataURI = require('image-data-uri')

const md = require('./md.js')

const { token } = require('./config.js')


const logs = []

const bot = new Telegraf(token)

bot.start(ctx => {
  console.log('started:', ctx.from.id)
  console.log(ctx)
  return ctx.reply('Welcome!')
})

bot.use((ctx, next) => {
  if(ctx.update.message) {
    console.log(`${ctx.update.message.from.username}: ${ctx.update.message.text}`)
    console.log('||> ' + new Date(ctx.update.message.date))
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
  full documentation: http://jannik.ddns.net/EnceladusBot/docs
  help: show this help page
  homepage: show the bots homepage
  author: shows my name and username
  github: show my github (https://github.com/JannikWibker)
  src: show the github repo for the bot (https://github.com/JannikWibker/EnceladusBot)
  qr: create a QR code for the specified text
    usage: \`/qr http://jannik.ddns.net/EnceladusBot\`
  md: create a pdf from the specified markdown (supports LaTeX math syntax, dot diagrams, ...; uses [mume](https://github.com/shd101wyy/mume) and [puppeteer](https://github.com/GoogleChrome/puppeteer) under the hood)
    usage:
\`/md this is the **sum** for calculating the *left sum* for a given $f(x)$ from $0$ to $l$ and with a stepsize of $s$: $$\\sum_{i=0}^{\\frac{l}{s}} f(i \\cdot s) \\cdot s$$\`
  lmgtfy: create a lmgtfy link for the specified text
    usage: \`/lmgtfy how to use let me google that for you\`
  `))

bot.on('sticker', ctx => ctx.reply('👍🏻'))

// "generic" commands

bot.command('homepage', ctx => ctx.reply('http://jannik.ddns.net/EnceladusBot'))

bot.command('github', ctx => ctx.reply('https://github.com/JannikWibker'))

bot.command('src', ctx => ctx.reply('https://github.com/JannikWibker/EnceladusBot'))

bot.command('author', ctx => ctx.reply(`Jannik Wibker: @jannnik`))

// more specialized commands

bot.command('qr', ctx =>
  qr_fn(ctx.update.message.text.substr(4) || 'sample qr code', ctx.replyWithPhoto))

bot.command('md', ctx =>
  md_fn(ctx.update.message.text.substr(4), ctx.update.message.date, ctx.replyWithDocument))

bot.command('lmgtfy', ctx =>
  ctx.reply('http://www.lmgtfy.com/?q=' + ctx.update.message.text.split(' ').slice(1).join('+')))


bot.startPolling()
