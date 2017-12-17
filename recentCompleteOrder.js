"use strict"

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
    getRSI: async function (options) {
        const COIN_TYPE = options.coinType,
            MARKET_NAME = options.marketName,
            PERIOD = options.periodInDay || 14
        
        if (this.length > 0 && this.last().get("timestamp") > Date.now()/1000 - options.periodInDay * 60 * 60 * 24)
            console.log(`Not ready to RSI, It just been ${((Date.now()/1000 - this.last().get("timestamp")) / 86400).toFixed(3)} days.`)

        await this.refresh({
            coinType: COIN_TYPE,
            marketName: MARKET_NAME,
            periodInday: PERIOD
        })

        const candles = this.getCandles({periodInDay: PERIOD})
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
// console.log("AU:", AU)
// console.log("AD:", AD)
// console.log("ups:", ups)
// console.log("downs:", downs)
// console.log("RSI:", (AU / (AU + AD)) * 100)
        return (AU / (AU + AD)) * 100   // RSI = AU / (AU + AD)
    },
    getCandles: function(options){
        if (this.length == 0) return []
        const PERIOD = 60 * 60 * 24 * (options.periodInDay || 14),   // 14 days
            UNIT_TIME = 60 * (options.unitTimeInMin || 5)  // 5 mins
            
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
            await this.fetchFrom({
                coinType: COIN_TYPE,
                periodInday: options.periodInday
            })
            period = "day"
        }

        await this.removeOlds({
            periodInday: options.periodInday
        })

        // lastTimestamp in this collection
        const lastTimestamp = (this.length == 0) ? 0 : this.last().get("timestamp")

        console.log(`[recentCompleteOrder.refresh] Last timeStamp was ${(Date.now()/1000 - lastTimestamp).toFixed(0)} sec ago.`)
        if (Date.now() / 1000 - lastTimestamp > 60 * 60)    // lastTimestamp is older than an hour
            period = "day"
        
        // return
        // period = "hour"

        let recentCompleteOrders 
        try {
            if (MARKET_NAME == "COINONE")
                recentCompleteOrders = await fetcher.getCoinoneRecentCompleteOrders(COIN_TYPE, period)
            else if (MARKET_NAME == "KORBIT") 
                recentCompleteOrders = await fetcher.getKorbitRecentCompleteOrders(COIN_TYPE, period)
        }catch (e){
            console.log(e)
        }

        // console.log("recent length:", recentCompleteOrders.length)
        for (let o of recentCompleteOrders) {
            // Add only didn't exists
            if (o.timestamp * 1 > lastTimestamp){
                // console.log(o.timestamp)
                const rcOrder = new exports.RecentCompleteOrder({
                    timestamp: o.timestamp * 1,
                    price: o.price * 1,
                    qty: o.qty * 1,
                    coinType: COIN_TYPE
                })
                await rcOrder.savePromise()
                this.push(rcOrder)
            }
        }
        
        return
    }, // End of refresh()
    fetchFrom: async function (options){
        const AMOUNT = 100,
            NOW = Date.now() / 1000,    // in sec not ms
            COIN_TYPE = options.coinType,
            PERIOD = 60 * 60 * 24 * (options.periodInday || 14.1)   // 14.1 days in seconds
            
        const that = this

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
                            rcOrders.add(loaded)
                            isRemain = false
                        }
                        resolve()
                    },
                    error: function (c, r, o) {
                        console.log("[rcOrders.fetchAll()] from db error");
                        console.log(r);
                        process.exit()
                    }
                })
            })

        return
    },
    removeOlds: async function(options){
        const PERIOD = 60 * 60 * 24 * (options.periodInday || 14.1)  // 14.1 days in seconds
        return
    }
})
