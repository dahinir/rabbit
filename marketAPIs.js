"use strict";

const ccxt = require('ccxt');
const request = require('request');
const KEYS = require('./credentials/keys.json');
const korbitAPI = require("./korbit.js");

console.log("marketAPIs.js called haha-------------------this should be called once..-------------------------")

//// COINONE ////
const coinone = new ccxt.coinone({
    nonce: () => Date.now(),
    apiKey: KEYS.COINONE.API_KEY,
    secret: KEYS.COINONE.SECRET_KEY
});
const coinoneWrap = Object.create(coinone);
coinoneWrap.cancelOrder = async function (orderId, coinPair) {
    // Coinone requires qty of the order
    const result = await coinone.fetchOrder(orderId, coinPair)
    // console.log(result, result.side == 'sell' ? 1 : 0)

    return await coinone.cancelOrder(orderId, coinPair, {
        price: result.price,
        qty: result.remaining,
        is_ask: result.side == 'sell' ? 1 : 0
    })
}

//// KORBIT does not use CCTX ////
const korbit = {
    loadMarkets: async function () {
        // do nothing
    },
    fetchTicker: async function (coinPair) {
        // regex: do something like 'ETH/KRW' to "ETH"
        const result = await korbitAPI({
            type: "TICKER",
            coinType: coinPair.split(/\//)[0]
        })
        for (let key in result)
            result[key] = result[key] * 1
        return result
    },
    fetchBalance: async function () {
        const result = await korbitAPI({
            type: "BALANCE"
        })
        const bals = {
            total: {}  // just for summary in index.js
        }
        for (const name in result) {
            bals[name.toUpperCase()] = {
                free: result[name].available * 1,
                used: result[name].trade_in_use * 1,
                total: result[name].available * 1 + result[name].trade_in_use * 1
            }
            // just for summary in index.js
            bals.total[name.toUpperCase()] = result[name].available * 1 + result[name].trade_in_use * 1
        }
        return bals
    },
    fetchOrderBook: async function (coinPair) {
        const result = await korbitAPI({
            type: "ORDERBOOK",
            coinType: coinPair.split(/\//)[0]
        })
        result.symbol = coinPair
        result.bids = result.bids.map(([p, q, notUsed]) => [p * 1, q * 1])
        result.asks = result.asks.map(([p, q, notUsed]) => [p * 1, q * 1])
        return result
    },
    createOrder: async function (coinPair, orderType, side, amount, price) {
        const result = await korbitAPI({
            type: (side == "buy") ? "BID" : "ASK",
            price: price,
            qty: amount,
            coinType: coinPair.split(/\//)[0]
        })
        return {
            id: result.orderId.toString()
        }
    },
    fetchOpenOrders: async function (coinPair) {
        const results = await korbitAPI({
            type: "UNCOMPLETED_ORDERS",
            coinType: coinPair.split(/\//)[0]
        })
        // console.log(results)
        const modified = results.map(result => {
            return {
                id: result.id.toString(),
                timestamp: +result.timestamp,
                symbol: coinPair,
                // type: "limit",
                side: (result.type == "bid") ? "buy" : "sell",
                price: +result.price.value,
                amount: +result.total.value,
                remaining: +result.open.value
            }
        })
        // console.log(modified)
        return modified
    },
    cancelOrder: async function (orderId, coinPair) {
        const result = (await korbitAPI({
            type: "CANCEL_ORDER",
            orderId: orderId,
            coinType: coinPair.split(/\//)[0]
        }))[0]; // kobitAPI returns Array

        if (result.status == "success")
            return result
        else
            throw new Error("fail to cancel at Korbit. result was:" + JSON.stringify(result))
    }
}

//// BITHUMB ////
const bithumb = new ccxt.bithumb({
    'timeout': 60000,
    nonce: () => Date.now(),
    apiKey: KEYS.BITHUMB.API_KEY,
    secret: KEYS.BITHUMB.SECRET_KEY
});
const bithumbWrap = Object.create(bithumb);
bithumbWrap.cancelOrder = async function (orderId, coinPair) {
    const result = await bithumb.fetchOrder(orderId, coinPair)
    if (result.status == "canceled")
        return { msg: "already canceled" }

    return await bithumb.cancelOrder(orderId, coinPair, {
        side: result.side   // 'buy' or 'sell'
    })
}
bithumbWrap.fetchOpenOrders = async function (coinPair) {
    let result
    try {
        result = await bithumb.fetchOpenOrders(coinPair)
    } catch (e) {
        // ????????? openOrder??? ????????? ??????????????? 
        // { status: '5600', message: '?????? ???????????? ????????? ???????????? ????????????.' }
        // ??? ?????? cctx??? ????????? ?????????. ????????? ?????? ????????? pull request ????????? ??????????????????..
        // ????????? ??????????????? ???????????? ???????????? 5600 ??????????????? ?????? ?????? ?????? ???????????? ??????
        // https://apidocs.bithumb.com/docs/err_code
        // ????????? ?????? ????????? ???????????? ????????? ?????????.
        const err = JSON.parse(e.message.replace("bithumb {", "{"))
        if (err.status === '5600' || err.message === '?????? ???????????? ????????? ???????????? ????????????')
            return []   // success
        else
            throw e
    }
    return result
}

//// UPBIT ////
const upbit = new ccxt.upbit({
    nonce: () => Date.now(),
    apiKey: KEYS.UPBIT.API_KEY,
    secret: KEYS.UPBIT.SECRET_KEY,
});

const upbitWrap = Object.create(upbit);
upbitWrap.fetchTicker = async function (opt) {
    const result = await upbit.fetchTicker(opt)
    result.marketName = "UPBIT"
    return result
}
upbitWrap.fetchBalance = async function () {
    const result = await upbit.fetchBalance()
    // Upbit omits 0 value coins in balance
    for (let coinName in global.rabbit.constants) {
        if (!result[coinName])
            result[coinName] = {
                free: 0,
                used: 0,
                total: 0
            }
    }
    return result
}

//// GOPAX ////
// const gopax = new ccxt.gopax({
//     nonce: () => Date.now(),
//     apiKey: KEYS.GOPAX.API_KEY,
//     secret: KEYS.GOPAX.SECRET_KEY,
// });


// await coinone.loadMarkets();
// await korbit.loadMarkets();
// await bithumb.loadMarkets();

module.exports = {
    "COINONE": coinoneWrap,
    "KORBIT": korbit,
    "BITHUMB": bithumbWrap,
    "UPBIT": upbitWrap
}