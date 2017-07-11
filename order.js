"use strict"

const Backbone = require('backbone'),
    _ = require('underscore'),
    backsync = require('backsync'),
    coinoneAPI = require("./coinone.js");

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
        console.log("machine id:", machine.id)
        await machine.accomplish(this.get("price"))
      }
      // for (let mId of this.get("machineIds")){
      //   await global.rabbit.machines.get(mId).accomplish(this.get("price"))
      // }
      // let that = this
      // that.save({
      //   haha: true,
      //   isDone: true
      // })
      this.destroy()
    }
})

exports.Orders = Backbone.Collection.extend({
    url: "mongodb://localhost:27017/rabbit/orders",
    sync: backsync.mongodb(),
    model: exports.Order,
    // machines.mind()'s return object will be this options
    placeOrder: async function(options){
      if (!_.isObject(options))
        throw new Error("[order.placeOrder()] options needed")

      let marketAPI
      switch (options.marketName) {
        case "COINONE":
          marketAPI = coinoneAPI
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
          console.log(options)
          // This order won't save in db. only runtime
          let newOrder = new exports.Order({
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

      if (internalTradeQuantity > 0)
        console.log("Whoa! internalTradeQuantity:", internalTradeQuantity)

      // Actual order here
      let marketResult = await marketAPI({
        type: type,
        // price: price -100000,
        price: price,
        qty: quantity,
        coinType: options.coinType.toLowerCase()
      })
      console.log("[order.js] order is placed", type, price, quantity, marketResult)

      // NEW ORDER ONLY HERE! ..and when perpect internal occur
      if (_.isString(marketResult.orderId)){
        let newOrder = new exports.Order({
          orderId: marketResult.orderId,
          machineIds: options.machineIds,
          marketName: options.marketName,
          coinType: options.coinType,
          type: type,
          price: price,
          quantity: quantity,
          internalTradeQuantity: internalTradeQuantity
        });

        // Here
        for(let m of options.participants)
          await m.pend()
        console.log("[order.js] All participants are successfully pended.")

        newOrder.save({},{
          success: function(){
            // This will be called after order.placeOrder() ended. but it's okay i think
            console.log("[order.js] New order successfully saved.")
          }
        })

        newOrder.participants = options.participants  // machines array. not as attributes
        this.push(newOrder);
        console.log("[order.js] end of order.placeOrder()")
      }
    },
    // Refresh All of this orders. no matter what marketName or coinType. All of them.
    refresh: async function(options) {
      if (this.length == 0)
        return

      // Fetch from Coinone with Ethereum
      let uncompletedOrderIds = _.pluck((await coinoneAPI({
        type: "UNCOMPLETED_ORDERS",
        coinType: "ETH"
      })).limitOrders, "orderId")

      for(let order of this.models){  // this.models returns array so can use for...of
        if (_.contains(uncompletedOrderIds, order.get("orderId")) ){
          // It's uncompleted order. Doesn't do anything.
          console.log("[order.js] Uncompleted orderId:", order.get("orderId"),
            order.get("price"), order.get("quantity").toFixed(2), order.get("type"),
            ((new Date() - order.get("created_at")) / 60000).toFixed(2), "min ago\t",
            order.get("internalTradeQuantity"))
        }else{
          console.log("[order.js] New completed order! id:", order.get("orderId"), order.get("type"))
          // New complete order!
          await order.completed()
        }
      }
    } // end of refresh
/*    refresh_old: function(resolve, reject){
        if(this.length == 0){
            resolve && resolve();
            return;
        }
        let thisOrders = this;
        coinoneAPI.call("/v2/order/limit_orders", {"currency": this.coinType}, function(result){
            let uncompletedOrderIds = [];

            if(_.isObject(result) && result.result == 'success' ){
                // console.log(result.limitOrders);
                uncompletedOrderIds = _.pluck(result.limitOrders, "orderId");

                one(0);
            }else{
                console.log("[order.js] coinone refresh error. not a big deal maybe.");
                console.log(result);
                reject && reject();
                return;
            }

            function one(index){
                if( index >= thisOrders.length){
                    // finally
                    resolve && resolve();
                    return;
                }
                let o = thisOrders.at(index);
                if (_.contains(uncompletedOrderIds, o.get("orderId")) ){
                    console.log("[order.js] uncompleted order id: ", o.get("orderId"));
                    one(index+1);
                }else{
                    // new complete order
                    o.adjust(function(){
                        one(index+1);
                    });
                }

            }
        });
    }  */
})

/*
// depressed
exports.BithumbOrder = Order.extend({
  adjust: function(resolve, reject) {
      if (this.get("isDone")) {
          resolve();
          return;
      }

      const machines = this.machines,
          internalTradedUnits = this.get("internalTradedUnits"),
          data = this.get("data") || []; // bithumb results
      // type = this.get("btParams").type;
      const that = this;
      // let totalDuty = internalTradedUnits * 2 + this.get("btParams").units;

      let dealedUnits = 0; // dealed with bithumb
      if (this.get('status') == '0000') {
          _.each(this.get("data"), function(c) {
              dealedUnits += (c.units || c.units_traded) * 1;
          });
      }

      let pendingMachines = new Backbone.Collection(); // just container for runtime
      function one(index) {
          if (machines.length > index) {
              let m = machines.at(index);

              // successfully trade machines
              // if ((internalTradedUnits * 2 + dealedUnits - that.get('adjustedUnits')) >= (m.get("capacity") - 0.00001)) {  // 0.00001 is for mistake of javascript
              if ( (internalTradedUnits * 2 + dealedUnits - that.get('adjustedUnits') - m.get('capacity') ).toFixed(3) * 1 >= 0) {

                  m.trade(function() {
                      that.set({
                          adjustedUnits: (that.get('adjustedUnits') + m.get("capacity")).toFixed(3) * 1
                      });
                      one(index + 1);
                  });
              } else {
                  // penging machines..
                  pendingMachines.push(m);
                  m.save({
                      status: "PENDING"
                  }, {
                      success: function() {
                          one(index + 1);
                      }
                  });
              }
          } else {
              // console.log("[order.js] end with", pendingMachines.length, "pendingMachines");
              that.machines = pendingMachines; // Backbone collections for runtime
              that.save({
                  machineIds: pendingMachines.pluck('id'), // Array of machine's IDs
                  isDone: (pendingMachines.length == 0) ? true : false
              }, {
                  success: function() {
                      console.log("[order.js] saved with", that.get('machineIds').length, "pending machines");
                      resolve && resolve();
                      if (that.get('isDone'))
                          that.destroy();
                      return;
                  },
                  error: function(e) {
                      console.log("[order.js] error when save to db", e);
                  }
              });
          }
      }
      one(0);
  } // adjust
});
//
// exports.BithumbOrders = Orders.extend({
// });

// depressed
exports.CoinoneOrder = Order.extend({
    defaults: _.extend({
        marketName: "COINONE"
        // coinType: "ETH" // or "BTC"
    }, Order.defaults)
});

// depressed
exports.CoinoneOrders = Orders.extend({
    coinType: "ETH",  // or "BTC"
    refresh: function(resolve, reject){
        if(this.length == 0){
            resolve && resolve();
            return;
        }
        let thisOrders = this;
        coinoneAPI.call("/v2/order/limit_orders", {"currency": this.coinType}, function(result){
            let uncompletedOrderIds = [];

            if(_.isObject(result) && result.result == 'success' ){
                // console.log(result.limitOrders);
                uncompletedOrderIds = _.pluck(result.limitOrders, "orderId");

                one(0);
            }else{
                console.log("[order.js] coinone refresh error. not a big deal maybe.");
                console.log(result);
                reject && reject();
                return;
            }

            function one(index){
                if( index >= thisOrders.length){
                    // finally
                    resolve && resolve();
                    return;
                }
                let o = thisOrders.at(index);
                if (_.contains(uncompletedOrderIds, o.get("orderId")) ){
                    console.log("[order.js] uncompleted order id: ", o.get("orderId"));
                    one(index+1);
                }else{
                    // new complete order
                    o.adjust(function(){
                        one(index+1);
                    });
                }

            }
        });
    }
});
*/
