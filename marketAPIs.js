"use strict";

const ccxt = require('ccxt');
const KEYS = require('./credentials/keys.json');
const fetcher = require('./fetcher.js')

console.log("marketAPIs.js called haha--------------------------------------------")

// COINONE
const coinone = new ccxt.coinone({
    nonce: () => Date.now(),
    apiKey: KEYS.COINONE.API_KEY,
    secret: KEYS.COINONE.SECRET_KEY
});
const coinoneWrap = Object.create(coinone);
coinoneWrap.fetchBalance = function (opt) {
}

// KORBIT
const korbit = {
    fetchTicker: function (coinPair) {
        // regex: do something like 'ETH/KRW' to "ETH"
        const coinType = coinPair.split(/\//)[0];
        return fetcher.getKorbitInfo(coinType)
    }
}

// BITHUMB
const bithumb = new ccxt.bithumb({
    nonce: () => Date.now(),
    apiKey: KEYS.BITHUMB.API_KEY,
    secret: KEYS.BITHUMB.SECRET_KEY
});

// UPBIT
const upbit = new ccxt.upbit({
    nonce: () => Date.now(),
    apiKey: KEYS.UPBIT.API_KEY,
    secret: KEYS.UPBIT.SECRET_KEY,
});

const upbitWrap = Object.create(upbit);
upbitWrap.fetchTicker = function (opt) {
    // console.log("upbitt!!", opt)
    return upbit.fetchTicker(opt)
}

module.exports = {
    "COINONE": coinoneWrap,
    "KORBIT": korbit,
    "BITHUMB": bithumb,
    "UPBIT": upbitWrap
}