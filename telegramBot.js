"use strict";
const { Telegraf } = require('telegraf')
const fs = require('fs')

const bot = new Telegraf(require('./credentials/keys.json').TELEGRAM)
// `telegram_subscribers.json` save ids as array
const subscriberIds = new Set(require('./credentials/telegram_subscribers.json'));
const adminId = 500413497;

bot.start((ctx) => ctx.reply('Welcome to Boom'))
bot.help((ctx) => ctx.reply('Send me a sticker'))
bot.hears('hi', (ctx) => ctx.reply('Hey there'))
bot.hears('subscribe me', (ctx) => {
    if (subscriberIds.has(ctx.message.chat.id)) {
        ctx.reply("You're already subscribed.")
    } else {
        subscriberIds.add(ctx.message.chat.id)
        fs.writeFileSync("./credentials/telegram_subscribers.json",
            JSON.stringify(Array.from(subscriberIds)))   // save as array
        ctx.reply(`You've been subscribed! your id is ${ctx.message.chat.id}`)
        bot.telegram.sendMessage(adminId, `${ctx.message.chat.id} subscribed. did you know that?`)
    }
})
bot.hears('unsubscribe me', (ctx) => {
    if (subscriberIds.has(ctx.message.chat.id)) {
        subscriberIds.delete(ctx.message.chat.id)
        fs.writeFileSync("./credentials/telegram_subscribers.json",
            JSON.stringify(Array.from(subscriberIds)))   // save as array
        ctx.reply(`You've been unsubscribed.. your id is ${ctx.message.chat.id}`)
        bot.telegram.sendMessage(adminId, `${ctx.message.chat.id} unsubscribed. did you know that?`)
    } else {
        ctx.reply("You're not subscribe this service.")
    }
})
bot.hears('summary', (ctx) => {
    ctx.reply(global.rabbit.sumString)
})
bot.hears('arbitrages', (ctx) => {
    const Arbitrages = require('./machine.js').Arbitrages,
        ARBITRAGE_STARTED = global.rabbit.constants.ETH.ARBITRAGE_STARTED;

    const N = new Date()
    console.log(N.toLocaleString())
    const arbitrages = new Arbitrages()
    arbitrages.fetchAll({
        success: () => {
            console.log("all length", arbitrages.length)
            const sum = arbitrages.models.reduce((sum, a) => {
                if (a.get("status") == "COMPLETED")
                    return sum + a.get("profit_krw")
                // else
                //     console.log(a.get("status"))
                return sum
            }, 0)
            console.log(new Intl.NumberFormat().format(sum.toFixed(0)))
            console.log(new Intl.NumberFormat().format((sum / ((new Date() - ARBITRAGE_STARTED) / 86400000)).toFixed(0)), "per day")
            ctx.reply("all length: " + arbitrages.length + "\n" + new Intl.NumberFormat().format(sum.toFixed(0)))
        },
        error: function (e) {
            console.log("error", e)
        }
    })
})
bot.on('sticker', (ctx) => ctx.reply('👍'))
bot.on('text', (ctx) => {
    // Explicit usage
    // ctx.telegram.sendMessage(ctx.message.chat.id, `Hello ${ctx.state.role}`)

    // Using context shortcut
    // ctx.reply(`Hello ${ctx.message.chat.id}`)
})

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

bot.launch()
for (const id of subscriberIds) {
    bot.telegram.sendMessage(id, `=== Hello ${id}, the bot is back! ${(new Date()).toLocaleString()} ===`)
}


exports.broadcast = function (message) {
    for (const id of subscriberIds) {
        bot.telegram.sendMessage(id, message)
    }
}
exports.bot = bot