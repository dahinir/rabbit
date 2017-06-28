"use strict"

const Backbone = require('backbone'),
    _ = require('underscore'),
    backsync = require('backsync');
// const Machines = require('./machine.js').Machines;

/*
{ status: '0000', order_id: '1485052731599', data: [] }
or
{ status: '0000',
	order_id: '1485011389177',
	data:
	 [ { cont_id: '1445825',
			 units: '0.001',
			 price: '1096000',
			 total: 1096,
			 fee: '0.00000150' } ] }
*/
let Order = Backbone.Model.extend({
    // urlRoot: "mongodb://localhost:27017/rabbit/orders",
    url: "mongodb://localhost:27017/rabbit/orders",
    sync: backsync.mongodb(),
    idAttribute: "id",
    defaults: {
        isDone: false,  // even done adjust
        machineIds: [],
        internalTradedUnits: 0,
        // dealedUnits: 0,	// dealed with bithumb. not store. calculate everytime
        adjustedUnits: 0, // adjusted with machines
        coinType: 'btc' // 'btc' or 'eth'
    },
    initialize: function(attributes, options) {
        if (!this.id) {
            this.set({
                id: require('mongodb').ObjectID(),
                createdAt: new Date()
            });
        }
    },
    // refresh: function(resolve, reject){
    //     if (this.get('isDone')){
    //         resolve();
    //     }
    // },
    adjust: function(resolve, reject){
        _.each(this.get("machineIds"), function(mId){
            console.log("[order.js] traded machine id: ", mId);
            global.rabbit.machines.get(mId).trade();
        });
        this.destroy();
    }
}); // Order

let Orders = Backbone.Collection.extend({
    url: "mongodb://localhost:27017/rabbit/orders",
    sync: backsync.mongodb(),
    model: Order
});

exports.Order = Order;
exports.Orders = Orders;

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
//

const coinoneAPI = require("./coinone.js");
exports.CoinoneOrder = Order.extend({
    defaults: _.extend({
        marketName: "COINONE",
        coinType: "ETH" // or "BTC"
    }, Order.defaults)
});

exports.CoinoneOrders = Orders.extend({
    coinType: "eth",  // or "btc"
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
    },
    makeOrder: function(resolve, reject, options){
      let thisOrders = this;
        let params = {
            price: options.price,
            qty: options.qty,
            currency: thisOrders.coinType
        };
        let url = "/v2/order/limit_";
        if( options.type == "bid")
            url += "buy/";
        else if( options.type == "ask")
            url += "sell/";

        console.log(url, params);

        coinoneAPI.call(url, params, function(result){
            if(_.isObject(result) && _.isString(result.orderId)){
                // NEW ORDER ONLY HERE!
                let newOrder = new exports.CoinoneOrder({
                    orderId: result.orderId,
                    coinType: thisOrders.coinType
                });
                thisOrders.push(newOrder);
                resolve && resolve();
            }else{
                console.log("[order.js] Coinone order error. maybe not a problem.");
                reject && reject();
            }
        });
    }
});
