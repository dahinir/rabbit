"use strict"

const Backbone = require('backbone'),
    _ = require('underscore'),
    backsync = require('backsync'),
    coinoneAPI = require("./coinone.js"),
    korbitAPI = require("./korbit.js")


exports.Order = Backbone.Model.extend({
    urlRoot: "mongodb://localhost:27017/rabbit/orders", // not url. cuz of backsync
    sync: backsync.mongodb(),
    idAttribute: "id",
    defaults: {
        isDone: false,  // even done adjust
        machineIds: [],
        internalTradeQuantity: 0,
        adjustedQuantity: 0, // adjusted with machines
        coinType: 'ETH', // 'btc' or 'eth'
        marketName: "COINONE"
    },
    initialize: function(attributes, options) {
      if (!this.id){
        this.set({
          id: require('mongodb').ObjectID(),
          created_at: new Date()
        })
      }
    },
    completed: async function(){
      console.log("[order.js] Completed order with", this.participants.length, "machines")

      for (let machine of this.participants){
        // console.log("machine id:", machine.id)
        await machine.accomplish(this)
      }

      // Wait to destroy this order
      await new Promise(resolve => {
        this.destroy({
          success: function() {
            console.log("[order.js] Completed order destroyed from db.")
            resolve()
          }
        })
      })
    },
    cancel: async function(){
      console.log("[order.js] Cancel orderId:", this.get("orderId"), "at", this.get("marketName"),
        this.get("price"), this.get("quantity"), this.get("type") )

      try {
        if (this.get("marketName") == "COINONE"){
          const remainQuantity = (await coinoneAPI({
            type: "ORDER_INFO",
            orderId: this.get("orderId"),
            coinType: this.get("coinType")
          })).info.remainQty * 1
          console.log("[order.js] useless order's remain quantity:", remainQuantity, "and It will be canceled")

          // Real cancel here
          await coinoneAPI({
            type: "CANCEL_ORDER",
            orderId: this.get("orderId"),
            isAsk: (this.get("type") == "ASK") ? 1 : 0,
            qty: remainQuantity,
            price: this.get("price"),
            coinType: this.get("coinType")
          })
        } else if (this.get("marketName") == "KORBIT"){

        }
      } catch (e) {
        console.log("[order.js] Fail to cancel order. maybe not a problem.")
        // Set this order Done. so this can't be completed
        await new Promise(resolve => {
          this.save({
            isDone: true
          }, {
            success: function(){
              console.log("[order.js] Failed to cancel order in coinone, so order is saved as isDone:true")
              resolve()
            }
          })
        })
        reject(e)
        return
      }

      // Roll back the machines
      for (let machine of this.participants){
        await machine.rollback()
        console.log("[order.js] Roll backed. machine id:", machine.id)
      }

      // Wait to destroy this order from db
      await new Promise(resolve => {
        this.destroy({
          success: function() {
            console.log("[order.js] Canceled order destroyed from db")
            resolve()
          }
        })
      })
    } // End of cancel
})

exports.Orders = Backbone.Collection.extend({
    url: "mongodb://localhost:27017/rabbit/orders",
    sync: backsync.mongodb(),
    comparator: function(order){
      return order.get("created_at")
    },
    model: exports.Order,
    // machines.mind()'s return object will be this options
    placeTest: async function(options){
      // console.log(options)
      return new Promise(resolve => {
        let aa = options.a

        const ms = (options.a == 1)?5000:3000
        console.log("ms:",ms)

        setTimeout(() => {
          console.log(options.a)
          resolve();
        }, ms);
      });
    },
    placeOrder: async function(options){
      if (!_.isObject(options))
        throw new Error("[order.placeOrder()] options needed")

      let marketAPI
      switch (options.marketName) {
        case "COINONE":
          marketAPI = coinoneAPI
          break
        case "KORBIT":
          marketAPI = korbitAPI
          break
      }

      let type, price, quantity, internalTradeQuantity
      if (options.bidQuantity > options.askQuantity){
        type = "BID"
        price = options.bidPrice
        quantity = options.bidQuantity - options.askQuantity
        internalTradeQuantity = options.askQuantity * 2 // Smaller one
      }else if (options.bidQuantity < options.askQuantity){
        type = "ASK"
        price = options.askPrice
        quantity = options.askQuantity - options.bidQuantity
        internalTradeQuantity = options.bidQuantity * 2
      }else if (options.bidQuantity == options.askQuantity){
        if (options.bidQuantity == 0){
          console.log("[order.js] Won't place order")
        }else{
          console.log("[order.js] Perpect internal trade! Can you believe it?")
          // console.log(options)
          // This order won't save in db. only runtime
          const newOrder = new exports.Order({
            machineIds: options.machineIds,
            coinType: options.coinType,
            price: options.bidPrice, // It can be askPrice but I prefer
            quantity: 0,
            internalTradeQuantity: options.bidQuantity * 2
          })
          newOrder.participants = options.participants  // machines array. not as attributes
          await newOrder.completed()
        }
        return  // doesn't need deal with real market like Coinone
      }
      quantity = quantity.toFixed(2) * 1

      if (internalTradeQuantity > 0)
        console.log("Whoa! internalTradeQuantity:", internalTradeQuantity)

      // Actual order here
      const marketResult = await marketAPI({
        type: type,
        // price: price -100000,
        price: price,
        qty: quantity,
        coinType: options.coinType
      })
      console.log("[order.js] The order is placed", options.marketName, type, price, quantity, marketResult)
      // console.log(marketResult.orderId)

      // NEW ORDER ONLY HERE ..and when a perpect internal occur
      if (marketResult.orderId){
        const newOrder = new exports.Order({
          orderId: marketResult.orderId,
          machineIds: options.machineIds,
          marketName: options.marketName,
          coinType: options.coinType,
          type: type,
          price: price,
          quantity: quantity,
          internalTradeQuantity: internalTradeQuantity
        });

        // Pend the machines
        for(let m of options.participants)
          await m.pend()
        console.log("[order.js] All participants are successfully pended.")

        // awiat: orders.placeOrder() won't be ended befor newOrder is save in db completly
        await new Promise(resolve => {
          newOrder.save({},{
            success: function(){
              console.log("[order.js] New order successfully saved.")
              resolve()
            }
          })
        })

        newOrder.participants = options.participants  // machines array. not as attributes
        this.push(newOrder)

        console.log("[order.js] End of order.placeOrder() with new order")
        return newOrder
      }else {
        console.log("[order.js] Placed order but didn't receive orderId. It needed to check")
        console.log(newOrder)
        throw new Error("KILL_ME")
      }
    },
    // Refresh All of this orders. no matter what marketName or coinType. All of them.
    refresh: async function(options) {
      console.log("[order.js] Will refresh", this.length, "the orders")
      if (this.length == 0)
        return

      // Fetch uncompleted orders from Coinone with Ethereum
      let uncompletedOrderIds
      try {
        let korbitPromise = korbitAPI({
          type: "UNCOMPLETED_ORDERS",
          coinType: "ETH"
        })
        let coinonePromise = coinoneAPI({
            type: "UNCOMPLETED_ORDERS",
            coinType: "ETH"
          })
        let coinoneUncompletedOrderIds = (await coinonePromise).limitOrders.map(o => o.orderId)
        let korbitUncompletedOrderIds = (await korbitPromise).map(o => o.id)

        uncompletedOrderIds = coinoneUncompletedOrderIds.concat(korbitUncompletedOrderIds)
        // console.log(uncompletedOrderIds)
      } catch (e) {
        console.log("[order.js] One or two of uncompleted orders fetch is failed. Skip this refresh.")
        reject(e)
        return
      }

      // Complete All of New completed order korbit and coinone
      for(let order of this.models){  // this.models is an array
        if (order.get("isDone")){
          // Maybe It's fail to cancel from market. and nothing to do
          console.log("[order.js] It's Done order. check this orderId:", order.get("orderId"))
          break
        }
        if (_.contains(uncompletedOrderIds, order.get("orderId")) ){
          // It's uncompleted order. Don't do anything.
          console.log("[order.js] Uncompleted orderId:", order.get("orderId"),
            order.get("price"), order.get("quantity"), order.get("type"),
            ((new Date() - order.get("created_at")) / 60000).toFixed(2), "min ago\t",
            order.get("internalTradeQuantity") )
        }else{
          console.log("[order.js] New completed order! id:", order.get("orderId"), order.get("type"), order.get("price"))

          // New complete order!
          await order.completed()
        }
      }

      // Time to cancel the old orders
      // Array.filter() return [] if there is no order. not undefined
      const coinoneOrders = this.models.filter(order => order.get("marketName") == "COINONE")
      const korbitOrders = this.models.filter(order => order.get("marketName") == "KORBIT")

      for (let orders of [coinoneOrders, korbitOrders]){
        if (orders.length > 5){
            // The most far from current price
            const uselessOrder = _.sortBy(orders, order => -Math.abs(global.rabbit.coinoneInfo.last - order.get("price")))[0]

            // Cancel useless order!
            await uselessOrder.cancel()
        }
      }
    } // end of refresh
})
