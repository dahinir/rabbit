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
        status: "OPEN",
        machineIds: [],
        internalTradeQuantity: 0,
        adjustedQuantity: 0, // adjusted with machines
        coinType: 'ETH', // 'btc' or 'eth'
        marketName: ""
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
      const that = this
      for (let machine of this.participants){
        // console.log("machine id:", machine.id)
        await machine.accomplish(this)
      }
      console.log("[order.js] machine accomplish end. time to save order COMPLETED")


      // Wait to save this order
      await new Promise(resolve => {
          // IDK why but sometimes when save this will override machine instance that is one of accomplished
          console.log(" SET TIME OUT 100ms")
          
          that.save({  
            status: "COMPLETED",
            completed_at: new Date()
          }, {
            success: () => {
              console.log("[order.js] Order saved as completed.", this.attributes)
              resolve()
            }
          })
      })
      console.log("[order.js] end of order.completed() ")
    },
    cancel: async function(){
      console.log("[order.js] Cancel orderId:", this.get("orderId"), "at", this.get("marketName"),
        this.get("price"), this.get("quantity"), this.get("type") )

      try {
        if (this.get("marketName") == "COINONE"){
          // Get order info first
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
          // Real cancel here
          const korbitResult = await korbitAPI({
            type: "CANCEL_ORDER",
            orderId: this.get("orderId"),
            coinType: this.get("coinType")
          })[0] // kobitAPI returns Array
          // korbitAPI won't reject even if there is an error
          // Just act like the order was canceled successfully. Most of cast It's okay or little mistake of old order shit
        }
      } catch (e) {
        console.log("[order.js] Fail to cancel order. I'll just ignore")
        // Don't return here. continue this canceling.
      }

      // Roll back the machines
      for (let machine of this.participants){
        await machine.rollback(this)
        console.log("[order.js] Roll backed. machine id:", machine.id)
      }

      // Wait to save. and this order will removed from the orders
      await new Promise(resolve => {
        this.save({
          status: "CANCELED",
          canceled_at: new Date()
        }, {
          success: () => {
            console.log("[order.js] Canceled order saved.")
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
    initialize: function(attributes, options) {
      console.log("orders init")
      this.on("change:status", o => {
        switch (o.get("status")) {
          case "COMPLETED":
          case "CANCELED":
            console.log("The order will be removed from the orders. remain in db")
            this.remove(o)
            // delete o
            break
        }
      })
    },
    createOrder: function(options){
      console.log("createOrder")
      const newOrder = new exports.Order();
      // newOrder.on("change:status", o => {
        // console.log("event!", o.get("status"))
        // console.log(arguments)
        // if (o.get("status"))
        //   this.remove(o)
        // else {
        //   console.log("wwwwww")
        // }
      // })
      this.push(newOrder)
      return newOrder
    },
    placeOrder: async function(options){
      if (!_.isObject(options))
        throw new Error("[order.placeOrder()] options needed")
      
      options.askQuantity = _.isUndefined(options.askQuantity) ? 0 : options.askQuantity
      options.bidQuantity = _.isUndefined(options.bidQuantity) ? 0 : options.bidQuantity

      if ((options.bidQuantity == 0) && (options.askQuantity == 0)){
        console.log("[order.js] It's zero quantity order. won't place order")
        return
      }

      let marketAPI
      switch (options.marketName) {
        case "COINONE":
          marketAPI = coinoneAPI
          break
        case "KORBIT":
          marketAPI = korbitAPI
          break
        case undefined:
          throw new Error("Trying place order without marketName")
      }

      // NEW ORDER ONLY HERE
      const newOrder = new exports.Order({
        machineIds: options.machineIds,
        coinType: options.coinType
      })
      newOrder.participants = options.participants  // machines array. not as attributes


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
        console.log("[order.js] Perpect internal trade! Can you believe it?")
        // console.log(options)
        newOrder.set({
          marketName: "INTERNAL_TRADE",
          price: options.bidPrice, // It can be askPrice but I prefer
          quantity: 0,
          internalTradeQuantity: options.bidQuantity * 2
        })
        await newOrder.completed()
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

      // Only success to place order
      if (marketResult.orderId){
        newOrder.set({
          marketName: options.marketName,
          orderId: marketResult.orderId,
          type: type,
          price: price,
          quantity: quantity,
          internalTradeQuantity: internalTradeQuantity,
          placed_at: new Date()
        });

        // Pend the machines
        for(let m of options.participants)
          await m.pend(newOrder)
        console.log("[order.js] All participants are successfully pended.")

        // awiat to save this order at db
        await new Promise(resolve => {
          newOrder.save({},{
            success: () => {
              console.log("[order.js] New order successfully saved.")
              console.log(newOrder.attributes)
              resolve()
            }
          })
        })

        // Only succeeded to place order in this collection
        this.push(newOrder)

        console.log("[order.js] End of order.placeOrder() with new order")
        return newOrder
      }else {
        console.log("[order.js] Placed order but didn't receive orderId. It needed to check")
        console.log(newOrder.attributes)
        console.log(marketResult)
        throw new Error("KILL_ME")
      }
    },
    // Refresh All of this orders. no matter what marketName or coinType. All of them.
    refresh: async function(options) {
      console.log("100 [order.js] Will refresh", this.length, "the orders")
      if (this.length == 0)
        return

      // Fetch uncompleted orders from markets
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
        console.log("101 [order.js] One or two of uncompleted orders fetch is failed. Skip this refresh.")
        throw new Error(e)
      }

      console.log("102 [order.js] orders.length:", this.length, "models.length:", this.models.length)
      // Check all of new completed order in Korbit and Coinone
      for(let order of this.models){  // this.models is an array
        console.log("103 [oder.js] now refreshing orderId: ", order.get("orderId"))
        if (_.contains(uncompletedOrderIds, order.get("orderId") + "") ){ // korbit orderId is number so add ""
          // It's uncompleted order. Don't do anything.
          console.log("104 [order.js] Uncompleted orderId:", order.get("orderId"),
            order.get("price"), order.get("quantity"), order.get("type"),
            ((new Date() - order.get("created_at")) / 3600000).toFixed(2), "hours ago\t",
            order.get("internalTradeQuantity") )
        }else{
          if (order.get("status") == "OPEN"){
            console.log("104 [order.js] Detect new completed order. id:", order.get("orderId"), order.get("type"), order.get("price"))
            // New complete order!
            await order.completed()
          }else{
            console.log("104 [order.js] Why this order is here? orderId:", order.get("orderId") ,order.get("status"))
            throw new Error("KILL_ME")
          }
        }
      } // End of for loop
      console.log("105 [order.js] refresh loop end")

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
