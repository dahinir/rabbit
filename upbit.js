"use strict"
/* this file will be called like below
const upbit = require("./upbit")
upbit({
    type: "BID",
    price: 162400,
    qty: 0.01,
    coinType: "ETH"
}).then()
.catch()
*/

const ccxt = require('ccxt');
const KEYS = require('./credentials/keys.json');
const _ = require("underscore");

// for (const exchange of ccxt.exchanges)
//     console.log(exchange) // print all available exchanges

let upbit = new ccxt.upbit({
    // nonce: () => Date.now(),
    apiKey: KEYS.UPBIT.API_KEY,
    secret: KEYS.UPBIT.SECRET_KEY,
});

module.exports = async function (options) {
    if (!_.isObject(options))
        throw new Error("[upbit.js] options needed")

    // something like 'ETH/KRW', 'BTC/KRW'
    const currencyPair = (options.coinType || options.currency).toUpperCase() + "/KRW";

    if (options.type == "BID") {
        const result = await upbit.createLimitBuyOrder(currencyPair, options.qty || options.quantity, options.price)
        return {
            orderId: result.id
        }
    }
    // console.log(upbit.id)
    // console.log(await upbit.fetchBalance())
    // console.log(await upbit.createLimitBuyOrder('ETC/KRW', 0.2, 25000))

}


