"use strict"
const xcoinAPI = require('./bithumb_modified.js'),
    coinoneAPI = require("./coinone.js"),
    korbitAPI = require("./korbit.js"),
    bithumbAPI = require("./bithumb.js"),
    fetcher = require('./fetcher.js'),
    Order = require('./order.js').Order,
    Orders = require('./order.js').Orders,
    Machine = require('./machine.js').Machine,
    Machines = require('./machine.js').Machines,
    Arbitrage = require('./machine.js').Arbitrage,
    Arbitrages = require('./machine.js').Arbitrages,
    RecentCompleteOrder = require('./recentCompleteOrder.js').RecentCompleteOrder,
    RecentCompleteOrders = require('./recentCompleteOrder.js').RecentCompleteOrders,
    _ = require('underscore'),
    fs = require('fs'),
    moment = require('moment'),
    brain = require('brain.js')

// const rcOrders = new RecentCompleteOrders()
// console.log(rcOrders.length)
re()
console.log("end")
async function re(){
    // let result = await bithumbAPI({
    //     type: "BID",
    //     price: 10100,
    //     qty: 0.1,
    //     coinType: "QTUM"
    // })
    // let result = await bithumbAPI({
    //     // type: "ORDERBOOK",
    //     type: "INFO",
    //     coinType: "BTC"
    // })
    // let result = await coinoneAPI({
    //     type: "UNCOMPLETED_ORDERS",
    //     coinType: "ETH"
    // }) ​​​​​​​​​​[ '1522249876413298', '1522245862327279' ]​​​​​
    // let result = await bithumbAPI({
    //     type: "UNCOMPLETED_ORDERS",
    //     coinType: "QTUM"
    // })
    /*
    ​​​​​[ '1522249876413298',
​​​​​  '1522245862327279' ]*/
    // let result = await bithumbAPI({
    //     type: "CANCEL_ORDER",
    //     orderType: "BID",
    //     orderId: "1522249922292683",
    //     coinType: "QTUM"
    // })
    // let result = await bithumbAPI({
    //     type: "BALANCE"
    // })
    let result = await bithumbAPI({
        type: "RECENT_COMPLETE_ORDERS",
        coinType: "BCH"
    })
    console.log("after call ")
    // console.log(result)
    console.log(result)

    // let b = await fetcher.getCoinoneOrderbook("ETH")
    // b
    // const rsi = await rcOrders.getRSI({
    //     coinType: "XRP",
    //     periodInDay: 14,
    //     unitTimeInMin: 60 * 24
    // })
    // console.log(`rsi is ${rsi}`)
    // console.log("end: this should be last", rcOrders.length, Date.now())
}
return


// go()
async function go() {
    const startTime = new Date()
    const coinoneRecentCompleteOrdersPromise = fetcher.getCoinoneRecentCompleteOrders("ETH", "day")
    const coinoneRecentCompleteOrders = await coinoneRecentCompleteOrdersPromise
    // const fetchingTime = ((new Date() - startTime) / 1000).toFixed(2) // sec

    console.log("answer:", isInclined(coinoneRecentCompleteOrders))
}


function isInclined(recentCompleteOrders) {
    recentCompleteOrders = recentCompleteOrders.reverse()
    // console.log(recentCompleteOrders)

    const lastTimestamp = recentCompleteOrders[0].timestamp * 1
    const TERM = 60 * 3  // 3 mins

    const candles = recentCompleteOrders.reduce((candles, o) => {
        const index = Math.floor((lastTimestamp - (o.timestamp * 1)) / TERM)

        if (_.isArray(candles[index]))
            candles[index].push(o)
        else
            candles[index] = [o]  // It's new Array
        return candles
    }, []).map(c => {
        const lastIndex = c.length - 1
        const open = c[lastIndex].price * 1,
            close = c[0].price * 1,
            volume = c.reduce((sum, el) => {
                return sum + (el.qty || 0) * 1
            }, 0)

        return {
            v: Math.round(volume),
            count: c.length,
            open: open,
            close: close,
            // low: 0,
            // hight: 0,
            body: (close > open) ? "+" : "-"
        }
    })


    for (let i = 0; i < 5; i++)
        console.log(candles[i])
    // console.log( candles[candles.length - 1])
    if (candles[0].open == candles[0].close || _.isUndefined(candles[0]) || _.isUndefined(candles[1]))
        return false
    return (candles[0].body == candles[1].body) ? true : false
}