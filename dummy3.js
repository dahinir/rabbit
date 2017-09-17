"use strict"
const xcoinAPI = require('./bithumb_modified.js'),
    coinoneAPI = require("./coinone.js"),
    korbitAPI = require("./korbit.js"),
    fetcher = require('./fetcher.js'),
    Order = require('./order.js').Order,
    Orders = require('./order.js').Orders,
    Machine = require('./machine.js').Machine,
    Machines = require('./machine.js').Machines,
    Arbitrage = require('./machine.js').Arbitrage,
    Arbitrages = require('./machine.js').Arbitrages,
    _ = require('underscore'),
    fs = require('fs'),
    moment = require('moment'),
    brain = require('brain.js')

// require("./korbit.js")({ type: "REFRESH_TOKEN" })

// korbitAPI({
//     type: "BALANCE2"
// }).then(result => {
//     console.log(result)
// })

// fetcher.getKorbitBalance().then(result => {
//     console.log(result)
// })
// return

go()
async function go() {
    const startTime = new Date()
    try {
        const coinoneRecentCompleteOrdersPromise = fetcher.getCoinoneRecentCompleteOrders()
        const coinoneRecentCompleteOrders = await coinoneRecentCompleteOrdersPromise
        // const fetchingTime = ((new Date() - startTime) / 1000).toFixed(2) // sec

        console.log(isGoodTime(coinoneRecentCompleteOrders))
    } catch (e) {
        console.log("error")
        console.log(e)
    } finally {
    }
}

function isGoodTime(coinoneRecentCompleteOrders){
    coinoneRecentCompleteOrders = coinoneRecentCompleteOrders.reverse()

    const lastTimestamp = coinoneRecentCompleteOrders[0].timestamp
    const TERM = 60 * 15  // 15 mins
    console.log(coinoneRecentCompleteOrders[0], coinoneRecentCompleteOrders[1])
    console.log("0.800" - "1.001")
    let candles = coinoneRecentCompleteOrders.reduce((candles, o) => {
        const index = Math.floor((lastTimestamp - o.timestamp) / TERM)

        if (_.isArray(candles[index]))
            candles[index].push(o)
        else
            candles[index] = [o]
        return candles
    }, [])
    candles = candles.map(c => {
        const lastIndex = c.length - 1
        const open = c[lastIndex].price * 1,
            close = c[0].price * 1,
            volume = c.reduce((sum, el) => {
                return sum + el.qty * 1
            }, 0)

        return {
            volume: Math.round(volume),
            count: c.length,
            open: open,
            close: close,
            // low: 0,
            // hight: 0,
            body: (close > open) ? "+" : "-"
        }
    })

    console.log((candles[0].body == candles[1].body) ? "wait" : "action")
    console.log(candles)
    // console.log(candles.length, candles[0].length, candles[1].length, candles[2].length, candles[3].length, candles[4].length)
    // console.log( candles[candles.length - 1])
    // console.log("All fetchers've take", fetchingTime, "sec", candles.length)
    return (candles[0].body == candles[1].body) ? false : true
}