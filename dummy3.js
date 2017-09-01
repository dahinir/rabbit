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

fetcher.getKorbitBalance().then(result => {
    console.log(result)
})
return

go()
async function go() {
    const startTime = new Date()
    try {
        const coinoneRecentCompleteOrdersPromise = fetcher.getCoinoneRecentCompleteOrders()
        const coinoneRecentCompleteOrders = (await coinoneRecentCompleteOrdersPromise).reverse()

        const fetchingTime = ((new Date() - startTime) / 1000).toFixed(2) // sec

        // const now = (Date.now() / 1000).toFixed(0)
        const lastTimestamp = coinoneRecentCompleteOrders[0].timestamp
        const TERM = 3600 * 15  // 15 mins
        console.log(coinoneRecentCompleteOrders[0], coinoneRecentCompleteOrders[1])
        let result = coinoneRecentCompleteOrders.reduce(candles, o => {
            const index = Math.floor((o.timestamp - lastTimestamp) / TERM)
            candles[index] 
        }, [])
        for (let o of coinoneRecentCompleteOrders){

        }

        console.log(result[0], result[1], result[result.length-1])
        console.log("All fetchers've take", fetchingTime, "sec", result.length)

        // Candlesticks
        const WIDTH = 1000 * 60 * 15    // 15 mins
    } catch (e) {
        console.log("error")
        console.log(e)
    } finally {
    }
}