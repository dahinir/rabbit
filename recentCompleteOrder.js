"use strict"
////////////////////////////////////////
//// DON'T USE THIS MODULE    	////////
////////////////////////////////////////


// Need to set timestamp as index!!
// db.recentCompleteOrders.createIndex({timestamp:1})  

// remove old recentCompleteOrders
// db.recentCompleteOrders.remove({timestamp:{$lt:(Date.now()/1000 - 60*60*24*15)}})


const Backbone = require('backbone'),
    _ = require('underscore'),
    backsync = require('backsync'),
    fetcher = require('./fetcher.js'),
    bithumbAPI = require("./bithumb.js")
// const DB_ADDR = "mongodb://localhost:27017/"
const DB_ADDR = "mongodb://mongo:27017/"

//  { timestamp: '1512990444', price: '530100', qty: '5.8000' }
exports.RecentCompleteOrder = Backbone.Model.extend({
    urlRoot: DB_ADDR + "rabbit/recentCompleteOrders", // not url. cuz it's backsync
    sync: backsync.mongodb(),
    idAttribute: "id", // maybe ..change to "id".. using backsync..
    defaults: {
        // timestamp: 0,
        // price: 0,
        // qty: 0,
        // coinType: ""
    },
    savePromise: function () {
        // console.log("id",this.id)
        return new Promise(resolve => {
            this.save(arguments, {
                success: () => {
                    resolve()
                }
            })
        })
    }
})

exports.RecentCompleteOrders = Backbone.Collection.extend({
    url: DB_ADDR + "rabbit/recentCompleteOrders",
    sync: backsync.mongodb(),
    comparator: "timestamp",
    initialize: function (attributes, options) {
        console.log("recentCompleteOrders init")
    },
    model: exports.RecentCompleteOrder,

    getRSI: async function (options) {
        const COIN_TYPE = options.coinType || this.at(0).get("coinType"),
            MARKET_NAME = options.marketName,
            PERIOD_IN_MS = 1000 * 60 * 60 * 24 * (options.periodInDay || 14), // default 14 days
            UNIT_TIME_IN_MS = 1000 * 60 * (options.unitTimeInMin || 60 * 24), // defalut 24 hours
            UNIT_COUNT = Math.floor(PERIOD_IN_MS / UNIT_TIME_IN_MS)

        await this.refresh({
            coinType: COIN_TYPE,
            marketName: MARKET_NAME
        })
        // await this.fetchOne({
        //     coinType: COIN_TYPE
        // })

        // console.debug(`[RSI] recentCompleteOrder.length ${this.length}`)

        const lastTimestamp = this.last().get("timestamp")
        // console.log(`last timestamp is ${lastTimestamp}`)
        // console.log(`UNIT_COUNT: ${UNIT_COUNT}, ${lastTimestamp - PERIOD_IN_MS}, ${lastTimestamp - UNIT_TIME_IN_MS * UNIT_COUNT}`)

        let orderArray = []
        for (let t = lastTimestamp - PERIOD_IN_MS; t < lastTimestamp; t += UNIT_TIME_IN_MS) {
            let data = await this.fetchOne({ // .fetchOne() returns raw data
                coinType: COIN_TYPE,
                timeInMs: t
            })
            if (typeof data !== 'undefined')
                orderArray.push(data)
        }
        orderArray.push(this.last().attributes)

        if (this.length > 0 && this.at(0).get("timestamp") > Date.now() - PERIOD_IN_MS) {
            console.log(`Not ready to RSI, It just been ${((Date.now() - this.at(0).get("timestamp")) / 86400000).toFixed(3)} days.`)
            return 101 // It's impossible RSI
        }

        // orderArray.forEach(o => {
        //     console.log(`orderArray: ${o.coinType} ${o.timestamp}, ${o.price}`)
        // })
        let ups = 0,
            downs = 0,
            upCount = 0,
            downCount = 0
        for (let i = 0; i < orderArray.length - 1; i++) {
            const diff = orderArray[i + 1].price - orderArray[i].price
            // console.log(`diff is ${diff}`)
            if (diff > 0) {
                ups += diff
                upCount++
            } else if (diff < 0) {
                downs += -diff
                downCount++
            }
        }

        if (!Number.isSafeInteger(ups) || !Number.isSafeInteger(downs))
            throw new Error("[recentCompleteOrder.getRSI] too big number!")

        const AU = ups / (orderArray.length - 1),
            AD = downs / (orderArray.length - 1)
        // const AU = ups / upCount,
        //     AD = downs / downCount

        const RSI = (AU / (AU + AD)) * 100 // RSI = AU / (AU + AD)
        console.log(`AU: ${AU.toFixed(2)}, AD: ${AD.toFixed(2)},  sampled: ${orderArray.length},\t${COIN_TYPE} RSI: ${RSI.toFixed()}`)

        return RSI
    },
    getCandles: function (options) {
        console.debug(`recentCompleteOrder.length ${this.length}`)
        if (this.length == 0) return []
        const PERIOD = 1000 * 60 * 60 * 24 * (options.periodInDay || 14), // 14 days
            UNIT_TIME = 1000 * 60 * (options.unitTimeInMin || 15) // 15 mins

        const lastTimestamp = this.last().get("timestamp"),
            startTimestamp = lastTimestamp - PERIOD
        // console.debug("s~l:", startTimestamp, lastTimestamp)

        const candles = this.reduce((candles, o) => { // Order sensitive.. so don't use this.models
            if (o.get('timestamp') <= startTimestamp) return candles

            // const INDEX = Math.floor((o.get("timestamp") - startTimestamp) / UNIT_TIME)
            const INDEX = Math.ceil((o.get("timestamp") - startTimestamp) / UNIT_TIME) - 1

            if (Array.isArray(candles[INDEX]))
                candles[INDEX].push(o)
            else
                candles[INDEX] = [o]

            return candles
        }, []).reduce((candles, c) => {
            if (!c) return candles

            const open = c[0].get("price"),
                close = c[c.length - 1].get("price")

            candles.push({
                // count: c.length,
                // volumn: c.reduce((sum, el) => sum + el.get("qty"), 0),
                open: open,
                close: close,
                body: close > open ? "+" : (close == open ? "=" : "-")
            })
            return candles
        }, [])

        // console.debug("candles.length:", candles.length)
        // for (let candle of candles) {
        //     if (candle) console.debug(candle)
        // }

        return candles
    },
    refresh: async function (options) {
        const COIN_TYPE = options.coinType,
            MARKET_NAME = options.marketName
        let period = "hour"

        // If this refresh is first time in runtime
        if (this.length == 0) {
            // Fetch last one. That's enough
            await this.fetchOne({
                coinType: COIN_TYPE,
                timeInMs: Date.now()
            })
            period = "day"
        }

        // lastTimestamp in this collection
        const LAST_TIMESTAMP = (this.length == 0) ? 0 : this.last().get("timestamp")

        console.debug(`[recentCompleteOrder.refresh] Last timeStamp was ${(Date.now() - LAST_TIMESTAMP).toFixed(0)} ms ago.`)
        if (Date.now() - LAST_TIMESTAMP > 1000 * 60 * 60) { // lastTimestamp is older than an hour
            period = "day"
            console.log(`It's been a long time! I need a day!`)
        }

        // fetch from remote (Now Coinone only tho)
        let recentCompleteOrders
        try {
            if (MARKET_NAME == "COINONE")
                recentCompleteOrders = await fetcher.getCoinoneRecentCompleteOrders(COIN_TYPE, period)
            else if (MARKET_NAME == "KORBIT")
                recentCompleteOrders = await fetcher.getKorbitRecentCompleteOrders(COIN_TYPE, period)
            else if (MARKET_NAME == "BITHUMB")
                recentCompleteOrders = await bithumbAPI({
                    type: "RECENT_COMPLETE_ORDERS",
                    coinType: COIN_TYPE
                })
        } catch (e) {
            console.log(e)
        }

        this.reset() // Empty previous collection: ONLY USE ONCE AT A TIME! RSI, CANDLE
        // console.debug("[recentCompleteOrder.refresh] this.length:", this.length, LAST_TIMESTAMP)
        for (let o of recentCompleteOrders) {
            // console.log(o.timestamp)
            const rcOrder = new exports.RecentCompleteOrder({
                timestamp: o.timestamp * 1,
                price: o.price * 1,
                qty: o.qty * 1,
                coinType: COIN_TYPE
            })

            // Save at DB only didn't exists
            if (o.timestamp * 1 > LAST_TIMESTAMP) {
                await rcOrder.savePromise()
            }
            this.push(rcOrder)
        }
        // console.debug("[recentCompleteOrder.refresh] this.length:", this.length, this.last().get("timestamp"))

        return
    }, // End of refresh()
    fetchFrom: async function (options) {
        const AMOUNT = 100,
            NOW = Date.now(), // in ms
            COIN_TYPE = options.coinType,
            // PERIOD = 60 * 60 * 24 * (options.periodInday || 14.1)   // 14.1 days in seconds
            PERIOD = 1000 * 60 * 60 * 1.5 // 1.5 hours.. i don't have enough memory..

        const that = this

        console.log("[recentCompleteOrder.fetchFrom] It may be take a long time..")
        for (let skip = 0, loaded = [], isRemain = true; isRemain; skip += AMOUNT)
            await new Promise(resolve => {
                that.fetch({
                    data: {
                        timestamp: {
                            $gt: NOW - PERIOD
                        },
                        coinType: COIN_TYPE,
                        $skip: skip,
                        $limit: AMOUNT
                    },
                    success: rcOrders => {
                        loaded = loaded.concat(rcOrders.models);
                        // console.log("chunk:", loaded.length, rcOrders.length, rcOrders.models.length);
                        if (rcOrders.length == AMOUNT) { } else {
                            rcOrders.reset(loaded)
                            isRemain = false
                        }
                        console.log(`loaded.length: ${loaded.length}\t Last timestamp: ${rcOrders.last().get("timestamp")}\t It was ${(Date.now() - rcOrders.last().get("timestamp")).toFixed()} ms ago.`)
                        resolve()
                    },
                    error: function (c, r, o) {
                        console.log("[recentCompleteOrder.fetchFrom] from db error");
                        console.log(r);
                        process.exit()
                    }
                })
            })

        console.log("[recentCompleteOrder.fetchFrom] Load completed. this.length:", this.length, " last rcOrder was", Date.now() - this.last().get("timestamp"), "ms ago")
        return
    },
    fetchOne: async function (options) {
        const AMOUNT = 100,
            NOW = Date.now(), // in sec not ms
            COIN_TYPE = options.coinType,
            TIME_IN_MS = options.timeInMs || Date.now()
        // PERIOD = 60 * 60 * 24 * (options.periodInday || 14.1)   // 14.1 days in seconds
        // PERIOD = 60 * 60 * 1.5 // 1.5 hours.. i don't have enough memory..

        const result = await new Promise(resolve => {
            // Backbone Collection.fetch() will reset the collection
            this.fetch({
                remove: false, // so .fetch() will `add` not `reset`
                data: {
                    coinType: COIN_TYPE,
                    timestamp: {
                        $lt: TIME_IN_MS
                    },
                    $sort: {
                        timestamp: -1
                    },
                    $limit: 1
                },
                success: (rcOrders, res) => {
                    // console.log(res[0].timestamp)
                    resolve(res[0]) // This returns a raw data of recentOrder. not a Backbone model
                },
                error: function (c, r, o) {
                    console.log("[recentCompleteOrder.fetchOne] from db error");
                    console.log(r);
                    process.exit()
                }
            })
        })
        // console.log("[recentCompleteOrder.fetchOne] Load completed. this.length:", this.length, " last rcOrder was", Date.now() - this.last().get("timestamp"), "ms ago")
        return result // This returns a raw data of recentOrder. not a Backbone model
    },
    removeOlds: async function (options) {
        const PERIOD = 60 * 60 * 24 * (options.periodInday || 14.1) // 14.1 days in seconds
        return
    }
})