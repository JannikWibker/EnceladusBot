const crypto = require('crypto')

const utils = {
  gen_id: (length=48) => crypto.randomBytes(length).toString('base64'),
  logger: (logs) => (ctx, next) => {
    if(ctx.update.message) {
      if(!ctx.session || !ctx.session.uuid) ctx.session.uuid = utils.gen_id()
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
  }
}

module.exports = utils