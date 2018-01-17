"use strict"
// Need to set timestamp as index!!
// db.recentCompleteOrders.createIndex({timestamp:1})  

// remove old recentCompleteOrders
// db.recentCompleteOrders.remove({timestamp:{$lt:(Date.now()/1000 - 60*60*24*15)}})


const Backbone = require('backbone'),
    _ = require('underscore'),
    backsync = require('backsync'),
    fetcher = require('./fetcher.js'),
    coinoneAPI = require("./coinone.js"),
    korbitAPI = require("./korbit.js")

//  { timestamp: '1512990444', price: '530100', qty: '5.8000' }
exports.RecentCompleteOrder = Backbone.Model.extend({
    urlRoot: "mongodb://localhost:27017/rabbit/recentCompleteOrders", // not url. cuz of backsync
    sync: backsync.mongodb(),
    idAttribute: "id",   // maybe ..change to "id".. using backsync..
    defaults: {
        // timestamp: 0,
        // price: 0,
        // qty: 0,
        // coinType: ""
    },
    savePromise: function(){
        // console.log("id",this.id)
        return new Promise(resolve => {
            this.save(arguments,
                {success: () => {
                    resolve()
                }})
        })
    }
})

exports.RecentCompleteOrders = Backbone.Collection.extend({
    url: "mongodb://localhost:27017/rabbit/recentCompleteOrders",
    sync: backsync.mongodb(),
    comparator: "timestamp",
    initialize: function (attributes, options) {
        console.log("recentCompleteOrders init")
    },
    model: exports.RecentCompleteOrder,
    getRSI_old: async function (options) {
        const COIN_TYPE = options.coinType || this.at(0).get("coinType"),
            MARKET_NAME = options.marketName,
            PERIOD = options.periodInDay || 14,
            UNIT_TIME = options.unitTimeInMin || 15
        
        if (this.length > 0 && this.at(0).get("timestamp") > Date.now() / 1000 - options.periodInDay * 60 * 60 * 24 * PERIOD)
            console.log(`Not ready to RSI, It just been ${((Date.now()/1000 - this.at(0).get("timestamp")) / 86400).toFixed(3)} days.`)

        await this.refresh({
            coinType: COIN_TYPE,
            marketName: MARKET_NAME,
            periodInday: PERIOD
        })

        const candles = this.getCandles({
            periodInDay: PERIOD,
            unitTimeInMin: UNIT_TIME
        })
        let ups = 0, downs = 0

        for (let i = 0; i < candles.length - 1; i++) {
            const diff = candles[i + 1].close - candles[i].close
            if (diff > 0)
                ups += diff
            else if (diff < 0)
                downs += -diff
        }

        if (!Number.isSafeInteger(ups) || !Number.isSafeInteger(downs))
            throw new Error("[recentCompleteOrder.getRSI] too big number!")

        const AU = ups / (candles.length - 1),
            AD = downs / (candles.length - 1)

        return (AU / (AU + AD)) * 100   // RSI = AU / (AU + AD)
    },
    getRSI: async function (options) {
        const COIN_TYPE = options.coinType || this.at(0).get("coinType"),
            MARKET_NAME = options.marketName,
            PERIOD_IN_SEC = 60 * 60 * 24 * (options.periodInDay || 14), // default 14 days
            UNIT_TIME_IN_SEC = 60 * (options.unitTimeInMin || 60 * 24),  // defalut 24 hours
            UNIT_COUNT = Math.floor(PERIOD_IN_SEC / UNIT_TIME_IN_SEC)

        await this.refresh({
            coinType: COIN_TYPE,
            marketName: MARKET_NAME
        })
        // await this.fetchOne({
        //     coinType: COIN_TYPE
        // })

        const lastTimestamp = this.last().get("timestamp")
        console.log(`last timestamp is ${lastTimestamp}`)
        console.log(`UNIT_COUNT: ${UNIT_COUNT}, ${lastTimestamp - PERIOD_IN_SEC}, ${lastTimestamp - UNIT_TIME_IN_SEC * UNIT_COUNT}`)
        
        let orderArray = []
        for (let t = lastTimestamp - PERIOD_IN_SEC; t < lastTimestamp; t += UNIT_TIME_IN_SEC){
            orderArray.push(await this.fetchOne({   // .fetchOne() returns raw data
                coinType: COIN_TYPE,
                timeInSec: t
            }))
        }
        orderArray.push(this.last().attributes)

        if (this.length > 0 && this.at(0).get("timestamp") > Date.now() / 1000 - PERIOD_IN_SEC)
            console.log(`Not ready to RSI, It just been ${((Date.now() / 1000 - this.at(0).get("timestamp")) / 86400).toFixed(3)} days.`)

        // orderArray.forEach(o => {
        //     console.log(`orderArray: ${o.coinType} ${o.timestamp}, ${o.price}`)
        // })

        let ups = 0, downs = 0, upCount = 0, downCount = 0
        for (let i = 0; i < orderArray.length - 1; i++){
            const diff = orderArray[i + 1].price - orderArray[i].price
            // console.log(`diff is ${diff}`)
            if (diff > 0){
                ups += diff
                upCount++
            }else if (diff < 0){
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
        
        const RSI = (AU / (AU + AD)) * 100   // RSI = AU / (AU + AD)
        console.log(`AU: ${AU}, AD: ${AD},  sampled: ${orderArray.length},\t${COIN_TYPE} RSI: ${RSI.toFixed()}`)

        return RSI
    },
    getCandles: function(options){
        if (this.length == 0) return []
        const PERIOD = 60 * 60 * 24 * (options.periodInDay || 14),   // 14 days
            UNIT_TIME = 60 * (options.unitTimeInMin || 15)  // 15 mins
            
        const lastTimestamp = this.last().get("timestamp"),
            startTimestamp = lastTimestamp - PERIOD
        // console.log("s~l:", startTimestamp, lastTimestamp)
    
        const candles = this.reduce((candles, o) => {   // Order sensitive.. so don't use this.models
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

        // console.log("candles.length:", candles.length)
        // for(let candle of candles){
        //     if (candle) console.log(candle)
        // }
        
        return candles
    },
    refresh: async function (options) {
        const COIN_TYPE = options.coinType,
            MARKET_NAME = options.marketName
        let period = "hour"

        // If this refresh is first time in runtime
        if (this.length == 0){
            // Fetch last one. That's enough
            await this.fetchOne({
                coinType: COIN_TYPE,
                timeInSec: Date.now() / 1000
            })
            period = "day"
        }

        // lastTimestamp in this collection
        const LAST_TIMESTAMP = (this.length == 0) ? 0 : this.last().get("timestamp")

        console.log(`[recentCompleteOrder.refresh] Last timeStamp was ${(Date.now()/1000 - LAST_TIMESTAMP).toFixed(0)} sec ago.`)
        if (Date.now() / 1000 - LAST_TIMESTAMP > 60 * 60) {   // lastTimestamp is older than an hour
            period = "day"
            console.log(`It's been a long time! I need a day!`)
        }
        
        let recentCompleteOrders 
        try {
            if (MARKET_NAME == "COINONE")
                recentCompleteOrders = await fetcher.getCoinoneRecentCompleteOrders(COIN_TYPE, period)
            else if (MARKET_NAME == "KORBIT") 
                recentCompleteOrders = await fetcher.getKorbitRecentCompleteOrders(COIN_TYPE, period)
        }catch (e){
            console.log(e)
        }

        console.log("Remote recent length:", recentCompleteOrders.length)
        this.reset()    // Empty previous collection
        console.log("[recentCompleteOrder.refresh] this.length:", this.length, LAST_TIMESTAMP)
        for (let o of recentCompleteOrders) {
            // console.log(o.timestamp)
            const rcOrder = new exports.RecentCompleteOrder({
                timestamp: o.timestamp * 1,
                price: o.price * 1,
                qty: o.qty * 1,
                coinType: COIN_TYPE
            })

            // Save at DB only didn't exists
            if (o.timestamp * 1 > LAST_TIMESTAMP)
                await rcOrder.savePromise()
            
            this.push(rcOrder)
        }
        console.log("[recentCompleteOrder.refresh] this.length:", this.length, this.last().get("timestamp"))
        
        return
    }, // End of refresh()
    fetchFrom: async function (options){
        const AMOUNT = 100,
            NOW = Date.now() / 1000,    // in sec not ms
            COIN_TYPE = options.coinType,
            // PERIOD = 60 * 60 * 24 * (options.periodInday || 14.1)   // 14.1 days in seconds
            PERIOD = 60 * 60 * 1.5 // 1.5 hours.. i don't have enough memory..
            
        const that = this

        console.log("[recentCompleteOrder.fetchFrom] It may be take a long time..")
        for (let skip = 0, loaded = [], isRemain = true; isRemain; skip += AMOUNT)
            await new Promise(resolve => {
                that.fetch({
                    data: {
                        timestamp: { $gt: NOW - PERIOD },
                        coinType: COIN_TYPE,
                        $skip: skip,
                        $limit: AMOUNT
                    },
                    success: rcOrders => {
                        loaded = loaded.concat(rcOrders.models);
                        // console.log("chunk:", loaded.length, rcOrders.length, rcOrders.models.length);
                        if (rcOrders.length == AMOUNT) {
                        } else {
                            rcOrders.reset(loaded)
                            isRemain = false
                        }
                        console.log(`loaded.length: ${loaded.length}\t Last timestamp: ${rcOrders.last().get("timestamp")}\t It was ${(Date.now() / 1000 - rcOrders.last().get("timestamp")).toFixed()} sec ago.`)
                        resolve()
                    },
                    error: function (c, r, o) {
                        console.log("[recentCompleteOrder.fetchFrom] from db error");
                        console.log(r);
                        process.exit()
                    }
                })
            })

        console.log("[recentCompleteOrder.fetchFrom] Load completed. this.length:", this.length," last rcOrder was" ,Date.now()/1000 - this.last().get("timestamp"), "sec ago")
        return
    },
    fetchOne: async function (options) {
        const AMOUNT = 100,
            NOW = Date.now() / 1000,    // in sec not ms
            COIN_TYPE = options.coinType,
            TIME_IN_SEC = options.timeInSec || Date.now()/1000
            // PERIOD = 60 * 60 * 24 * (options.periodInday || 14.1)   // 14.1 days in seconds
            // PERIOD = 60 * 60 * 1.5 // 1.5 hours.. i don't have enough memory..

        const result = await new Promise(resolve => {
            // Backbone Collection.fetch() will reset the collection
            this.fetch({
                remove: false,  // so .fetch() will `add` not `reset`
                data: {
                    coinType: COIN_TYPE,
                    timestamp: { $lt: TIME_IN_SEC },
                    $sort: { timestamp: -1 },
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
        // console.log("[recentCompleteOrder.fetchOne] Load completed. this.length:", this.length, " last rcOrder was", Date.now() / 1000 - this.last().get("timestamp"), "sec ago")
        return result   // This returns a raw data of recentOrder. not a Backbone model
    },
    removeOlds: async function(options){
        const PERIOD = 60 * 60 * 24 * (options.periodInday || 14.1)  // 14.1 days in seconds
        return
    }
})
