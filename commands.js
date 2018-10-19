const os = require('os')
const md = require('./md.js')
const qrcode = require('qrcode')
const imageDataURI = require('image-data-uri')

const qr_fn = (text, cb) =>
  qrcode.toDataURL(text, (err, url) =>
    cb({source: imageDataURI.decode(url).dataBuffer}, {caption: text}))

const md_fn = (text, date, cb) => md(text, date + '.md', (filename) => {
  console.log('done: ' + filename)
  cb({source: filename})
})

const help_str = `commands:
help - show this help page
homepage - show the bots homepage (https://bot.jannik.ml)
author - shows my name and username
github - show my github (https://github.com/JannikWibker)
src - show the github repos for the bot (https://github.com/JannikWibker/EnceladusBot, https://git.jannik.ml/jannik/EnceladusBot)
qr - create a QR code for the specified text (\`/qr <link or text>\`)
md - create a pdf from the specified markdown (\`/md <markdown>\`)
lmgtfy - create a lmgtfy link for the specified text
spotify - login with spotify to use spotify related commands & messages
spotify_logout - log out of spotify

more information can be found [here](https://bot.jannik.ml)
`

module.exports = {
  commands: {
    'help': (ctx) => ctx.replyWithMarkdown(`*commands*:
*help* - show this help page
*homepage* - show the bots homepage
*author* - shows my name and username
*github* - show my github
*src* - show the github repos for the bot
*qr* - create a QR code for the specified text (\`/qr <link or text>\`)
*md* - create a pdf from the specified markdown (\`/md <markdown>\`)
*lmgtfy* - create a lmgtfy link for the specified text
*spotify* - login with spotify to use spotify related commands & messages
*spotify_logout* - log out of spotify

more information can be found [here](https://bot.jannik.ml)
`),
    'status': (ctx) => ctx.replyWithMarkdown(`Currently running on *${os.type()}*`),
    'whoami': (ctx) => ctx.replyWithMarkdown(`You are *${ctx.from.username}* and internally I may know you as \`${ctx.session.uuid}\` or \`${ctx.from.id}\`. Also this some data I received from Telegram about you:\n\`\`\`json\n${JSON.stringify(ctx.from, 2, 2)}\n\`\`\``),
    'author': (ctx) => ctx.reply(`Jannik Wibker: @jannnik`),
    'homepage': (ctx) => ctx.reply('https://bot.jannik.ml'),
    'github': (ctx) => ctx.reply('https://github.com/JannikWibker'),
    'src': (ctx) => ctx.reply('https://github.com/JannikWibker/enceladusbot, https://git.jannik.ml/jannik/EnceladusBot'),
    'lmgtfy': (ctx) => ctx.reply('http://www.lmgtfy.com/?q=' + ctx.update.message.text.split(' ').slice(1).join('+')),
    'qr': (ctx) => qr_fn(ctx.update.message.text.substr(4) || 'sample qr code', ctx.replyWithPhoto),
    'md': (ctx) => md_fn(ctx.update.message.text.substr(4), ctx.update.message.date, ctx.replyWithDocument)
  }
}