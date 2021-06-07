"use strict";

const ccxt = require('ccxt');
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
    fetchTicker: function (coinPair) {
        // regex: do something like 'ETH/KRW' to "ETH"
        const coinType = coinPair.split(/\//)[0];
        return fetcher.getKorbitInfo(coinType)  // returns Promise
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