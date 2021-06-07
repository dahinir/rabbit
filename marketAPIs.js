"use strict";

const ccxt = require('ccxt');
const request = require('request');
const KEYS = require('./credentials/keys.json');
const fetcher = require('./fetcher.js');
const korbitAPI = require("./korbit.js");

console.log("marketAPIs.js called haha--------------------------------------------")

//// COINONE ////
const coinone = new ccxt.coinone({
    nonce: () => Date.now(),
    apiKey: KEYS.COINONE.API_KEY,
    secret: KEYS.COINONE.SECRET_KEY
});
const coinoneWrap = Object.create(coinone);

//// KORBIT does not use CCTX ////
const korbit = {
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
        const bals = {}
        for (const name in result) {
            bals[name.toUpperCase()] = {
                free: result[name].available * 1,
                used: result[name].trade_in_use * 1,
                total: result[name].available * 1 + result[name].trade_in_use * 1
            }
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
    }
}

//// BITHUMB ////
const bithumb = new ccxt.bithumb({
    nonce: () => Date.now(),
    apiKey: KEYS.BITHUMB.API_KEY,
    secret: KEYS.BITHUMB.SECRET_KEY
});

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

module.exports = {
    "COINONE": coinoneWrap,
    "KORBIT": korbit,
    "BITHUMB": bithumb,
    "UPBIT": upbitWrap
}