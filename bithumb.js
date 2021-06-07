"use strict"
/* this file will be called like below
const bithumb = require("./bithumb")
bithumb({
    type: "BID",
    price: 162400,
    qty: 0.01,
    coinType: "ETH"
}).then()
*/

// done types: INFO, ORDERBOOK, RECENT_COMPLETE_ORDERS, ASK, BID, UNCOMPLETED_ORDERS, CANCEL_ORDER, BALANCE

const request = require('request'),
    fetch = require("node-fetch"),
    FormData = require('form-data'),
    crypto = require("crypto"),
    _ = require("underscore")

const KEYS = require('./credentials/keys.json').BITHUMB,
    ROOT_URL = 'https://api.bithumb.com'

const api = {
    INFO: function (options) {
        // console.log("INFO hooray!")
        const endPoint = "/public/ticker/" + options.coinType.toUpperCase() + "_KRW"
        // returns a promise
        return fetch(ROOT_URL + endPoint, {
            method: "GET"
        })
            .then(res => res.json())
            .then(result => {
                if (result.status != '0000') {
                    console.log(result)
                    throw new Error("wtf!")
                }

                return {
                    // bid: result.data.buy_price,
                    // ask: result.data.sell_price,
                    high: result.data.max_price,
                    low: result.data.min_price,
                    first: result.data.opening_price,
                    last: result.data.closing_price,
                    volume: result.data.volume_1day
                }
            })
    },
    ORDERBOOK: function (options) {
        // console.log("ORDERBOOK hooray!!")
        const endPoint = "/trade/orderbook/" + options.coinType.toUpperCase() + "_KRW"
        // returns a promise
        return fetch(ROOT_URL + endPoint, {
            method: "GET"
        })
            .then(res => res.json())
            .then(result => {
                if (result.status != '0000') {
                    console.log(result)
                    throw new Error("wtf!")
                }

                const data = result.data
                const ob = {
                    timestamp: data.timestamp * 1 / 1000,
                    bid: data.bids.map(el => {
                        return {
                            price: el.price * 1,
                            qty: el.quantity * 1
                        }
                    }),
                    ask: data.asks.map(el => {
                        return {
                            price: el.price * 1,
                            qty: el.quantity * 1
                        }
                    })
                }
                return ob
            })
    },
    RECENT_COMPLETE_ORDERS: function (options) {
        // console.log("RECENT_COMPLETE_ORDERS hooray!")
        // const endPoint = "/public/recent_transactions/" + options.coinType.toUpperCase() + "?count=100"
        const endPoint = "/public/transaction_history/" + options.coinType.toUpperCase() + "_KRW" + "?count=100"
        // returns a promise
        return fetch(ROOT_URL + endPoint, {
            method: "GET"
        })
            .then(res => res.json())
            .then(result => {
                if (result.status != '0000') {
                    console.log(result)
                    throw new Error("wtf!")
                }

                return result.data.map(o => {
                    return {
                        timestamp: new Date(o.transaction_date).getTime() / 1000, // Math.round(o.timestamp/1000),
                        price: o.price * 1,
                        qty: o.units_traded * 1
                    }
                })
                return result
            })
    },
    // ASK or BID
    ASK: function (options) {
        // console.log("ASK/BID hooray!")
        const endPoint = "/trade/place"
        const params = {
            type: options.type.toLowerCase(),
            order_currency: options.coinType.toUpperCase(),
            payment_currency: "KRW",
            price: options.price,
            units: options.qty || options.quantity
        }
        const fetchOpts = getFetchOpts(endPoint, params)
        return fetch(ROOT_URL + endPoint, fetchOpts)
            .then(res => res.json())
            .then(result => {
                if (result.status != '0000') {
                    console.log("[bithumb.js] ASK's result: ", result)
                    throw new Error("wtf!")
                }
                // only the orderId is needed
                return {
                    orderId: result.order_id + ""
                }
            })
    },
    UNCOMPLETED_ORDERS: function (options) {
        // console.log("UNCOMPLETED_ORDERS hooray!")
        const endPoint = "/info/orders"
        const params = {
            count: 1000,
            payment_currency: "KRW",
            order_currency: options.coinType.toUpperCase()
        }
        const fetchOpts = getFetchOpts(endPoint, params)
        return fetch(ROOT_URL + endPoint, fetchOpts)
            .then(res => res.json())
            .then(result => {
                // console.log(result)
                if (result.message === '거래 진행중인 내역이 존재하지 않습니다.') {
                    // Bithumb will emit '5600' err if there is no "UNCOMPLETED_ORDERS"
                    return [] // in this case, return empty 'order id' array
                } else if (result.status != '0000') {
                    console.log("[bithumb.js] ASK's result: ", result)
                    throw new Error("wtf!")
                }
                // returns an array of order id
                return result.data.map(o => o.order_id + "")
            })
    },
    CANCEL_ORDER: function (options) {
        // console.log("CANCEL_ORDER hooray!")
        const endPoint = "/trade/cancel"
        const params = {
            type: options.orderType.toLowerCase(), // "bid" or "ask"
            order_id: options.orderId,
            payment_currency: "KRW",
            order_currency: options.coinType.toUpperCase()
        }
        const fetchOpts = getFetchOpts(endPoint, params)
        return fetch(ROOT_URL + endPoint, fetchOpts)
            .then(res => res.json())
            .then(result => {
                console.log(result)
                if (result.status != '0000') {
                    console.log("[bithumb.js] CANCEL_ORDER's result: ", result)
                    throw new Error("wtf!")
                }
                return result // data format doesn't matter
            })
    },
    BALANCE: function (options) {
        // console.log("BALANCE hooray!")
        const endPoint = "/info/balance"
        const params = {
            currency: "ALL"
        }
        const fetchOpts = getFetchOpts(endPoint, params)
        return fetch(ROOT_URL + endPoint, fetchOpts)
            .then(res => res.json())
            .then(result => {
                // console.log(result)
                if (result.status != '0000') {
                    console.log("[bithumb.js] ASK's result: ", result)
                    throw new Error("wtf!")
                }

                // data format
                const bal = {},
                    data = result.data
                for (const name in data) {
                    if (name.startsWith('available_')) {
                        const coinType = name.slice(10).toUpperCase()
                        // bal[coinType] = bal[coinType] || {}
                        if (coinType in bal === false)
                            bal[coinType] = {}
                        bal[coinType].free = data[name] * 1
                    } else if (name.startsWith('total_')) {
                        const coinType = name.slice(6).toUpperCase()
                        if (coinType in bal === false)
                            bal[coinType] = {}
                        bal[coinType].total = data[name] * 1
                    }
                }
                return bal
            })
    }
}
api.BID = api.ASK

module.exports = function (options) {
    if (!_.isObject(options))
        throw new Error("[bithumb.js] options needed")

    return api[options.type.toUpperCase()](options)
}


//// HELPER FUNCTIONS /////
function getFetchOpts(endPoint, params) {
    const form = new FormData()
    const NONCE = Date.now()
    for (const key in params) {
        form.append(key, params[key])
    }
    return {
        method: "POST",
        headers: {
            'Api-Key': KEYS.API_KEY,
            'Api-Sign': Buffer.from(crypto
                .createHmac("sha512", KEYS.SECRET_KEY)
                .update(endPoint + chr(0) + http_build_query(params) + chr(0) + NONCE, KEYS.SECRET_KEY)
                .digest('hex')).toString('base64'),
            'Api-Nonce': NONCE
        },
        body: form
    }
}

function http_build_query(obj) {
    var output_string = []
    Object.keys(obj).forEach(function (val) {
        var key = val;
        key = encodeURIComponent(key.replace(/[!'()*]/g, escape));

        if (typeof obj[val] === 'object') {
            var query = build_query(obj[val], null, key)
            output_string.push(query)
        } else {
            var value = encodeURIComponent((obj[val] + "").replace(/[!'()*]/g, escape));
            output_string.push(key + '=' + value)
        }
    })
    // console.log("output_string:", output_string.join('&'));
    return output_string.join('&');
}

function chr(codePt) {
    //  discuss at: http://phpjs.org/functions/chr/
    // original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // improved by: Brett Zamir (http://brett-zamir.me)
    //   example 1: chr(75) === 'K';
    //   example 1: chr(65536) === '\uD800\uDC00';
    //   returns 1: true
    //   returns 1: true

    if (codePt > 0xFFFF) { // Create a four-byte string (length 2) since this code point is high
        //   enough for the UTF-16 encoding (JavaScript internal use), to
        //   require representation with two surrogates (reserved non-characters
        //   used for building other characters; the first is "high" and the next "low")
        codePt -= 0x10000;
        return String.fromCharCode(0xD800 + (codePt >> 10), 0xDC00 + (codePt & 0x3FF));
    }
    return String.fromCharCode(codePt);
}