"use strict";

const Backbone = require("backbone"),
  _ = require("underscore"),
  backsync = require("backsync");
const marketAPIs = require('./marketAPIs.js');
// const DB_ADDR = "mongodb://localhost:27017/"
const DB_ADDR = "mongodb://mongo:27017/"

exports.Order = Backbone.Model.extend({
  urlRoot: DB_ADDR + "rabbit/orders", // not url. cuz of backsync
  sync: backsync.mongodb(),
  idAttribute: "id",
  defaults: {
    status: "OPEN",
    machineIds: [],
    internalTradeQuantity: 0,
    adjustedQuantity: 0, // adjusted with machines
    coinType: "", // 'BTC' or 'ETH'
    marketName: ""
  },
  initialize: function (attributes, options) {
    if (!this.id) {
      this.set({
        id: require("mongodb").ObjectID(),
        created_at: new Date()
      });
    }
    this.on("change:buy_at", function (e) {
      console.log("fuck.. buy_at is setting at order..");
      console.log(e.attributes);
      throw new Error("KILL_ME");
    });
    this.participants = []
  },
  completed: async function () {
    if (
      this.get("marketName") == "KORBIT" &&
      new Date() - this.get("placed_at") < 5200 // ms
    ) {
      console.log("[order.js] Younger than 5200ms old Korbit order. so just ignore this complete()");
      return;
    }

    const that = this;
    for (let machine of this.participants || []) {
      // console.log("machine id:", machine.id)
      await machine.accomplish(this);
    }
    console.log(
      "[order.js] machine accomplish end. time to save order COMPLETED"
    );

    // Wait to save this order
    await new Promise(resolve => {
      // IDK why but sometimes when save this will override machine instance that is one of accomplished
      that.save(
        {
          status: "COMPLETED",
          completed_at: new Date()
        },
        {
          success: () => {
            console.log(
              "[order.js] Order saved as completed.",
              this.get("orderId")
            );
            resolve();
          }
        }
      );
    });
    console.log("[order.js] end of order.completed() ");
  },
  cancel: async function () {
    console.log(`[order.js] Cancel orderId: ${this.get("orderId")} at ${this.get("marketName")}`,
      this.get("price"),
      this.get("quantity"),
      this.get("type"),
      this.get("coinType"))

    try {
      await marketAPIs[this.get("marketName")].cancelOrder(this.get("orderId"), this.get("coinType") + "/KRW")
    } catch (e) {
      console.log("[order.js] Fail to cancel order. I'll just ignore");
      require("fs").appendFileSync("./error.json", new Date().toString() + ":\n" + JSON.stringify(e));
      // Don't return here. continue this canceling.
      // No..Coinone will return 104 not exist order when it busy. so don't continue this canceling
      return;
    }

    // Roll back the machines
    for (let machine of this.participants) {
      await machine.rollback(this);
      console.log("[order.js] Roll backed. machine id:", machine.id);
    }

    // Wait to save. This order will removed from the orders (in runtime)
    await new Promise(resolve => {
      this.save(
        {
          status: "CANCELED",
          canceled_at: new Date()
        },
        {
          success: () => {
            console.log("[order.js] Canceled order saved.");
            resolve();
          }
        }
      );
    });
  } // End of cancel
});

exports.Orders = Backbone.Collection.extend({
  url: DB_ADDR + "rabbit/orders",
  sync: backsync.mongodb(),
  comparator: function (order) {
    return order.get("created_at");
  },
  model: exports.Order,
  initialize: function (attributes, options) {
    console.log("orders init");
    this.on("change:status", o => {
      switch (o.get("status")) {
        case "COMPLETED":
          console.log(
            `"COMPLETED" event called. The orderId ${o.get(
              "orderId"
            )} will be removed from the orders. remain in db`
          );
          this.remove(o);
          // delete o
          break;
        case "CANCELED":
          console.log(
            `"CANCELED" event called. The orderId ${o.get(
              "orderId"
            )} will be removed from the orders. remain in db`
          );
          this.remove(o);
          // delete o
          break;
      }
    });
  },
  placeOrder: async function (options) {
    if (!_.isObject(options))
      throw new Error("[order.placeOrder()] options needed");

    const coinType = options.coinType,
      askQuantity = _.isUndefined(options.askQuantity)
        ? 0
        : options.askQuantity,
      bidQuantity = _.isUndefined(options.bidQuantity)
        ? 0
        : options.bidQuantity;

    if (bidQuantity == 0 && askQuantity == 0) {
      console.log("[order.js] It's zero quantity order. won't place order");
      return;
    }

    // NEW ORDER ONLY HERE
    const newOrder = new exports.Order({
      machineIds: options.machineIds,
      coinType: coinType
    });
    newOrder.participants = options.participants; // machines array. not as attributes

    let type, price, quantity, internalTradeQuantity;
    if (bidQuantity > askQuantity) {
      type = "BID";
      price = options.bidPrice;
      quantity = bidQuantity - askQuantity;
      internalTradeQuantity = askQuantity * 2; // Smaller one
    } else if (bidQuantity < askQuantity) {
      type = "ASK";
      price = options.askPrice;
      quantity = askQuantity - bidQuantity;
      internalTradeQuantity = bidQuantity * 2;
    } else if (bidQuantity == askQuantity) {
      console.log("[order.js] Perfect internal trade! Can you believe it?");
      // console.log(options)
      newOrder.set({
        marketName: "INTERNAL_TRADE",
        price: options.bidPrice, // It can be askPrice but I prefer
        quantity: 0,
        internalTradeQuantity: bidQuantity * 2
      });
      await newOrder.completed();
      return; // doesn't need deal with real market like Coinone
    }
    // quantity = quantity.toFixed(global.rabbit.constants[coinType].PRECISION) * 1
    quantity =
      Math.round(quantity / global.rabbit.constants[coinType].COIN_UNIT) *
      global.rabbit.constants[coinType].COIN_UNIT;
    quantity =
      quantity.toFixed(global.rabbit.constants[coinType].COIN_PRECISION) * 1;
    if (quantity * price < 10000) {
      // bithumb ASK result:  { status: '5600', message: '?????? ??????????????? 1 ETC ?????????.' }
      console.log(`[order.js] It's too little money order. quantity is ${quantity} price is ${price} so it will be ignored.`);
      return;
    }

    if (internalTradeQuantity > 0)
      console.log("Whoa! internalTradeQuantity:", internalTradeQuantity);

    // Actual order here
    let marketResult
    try {
      marketResult = await marketAPIs[options.marketName].createOrder(
        coinType + "/KRW", // like 'ETC/KRW', 
        'limit',  // 'limit' or 'market'. but don't use 'market'
        (type == "BID") ? "buy" : "sell", // "buy" or "sell"
        quantity,
        price);
    } catch (e) {
      console.log("[order.js] error while order to market")
      console.log("options was", options)
      throw e
    }

    // console.log(marketResult);
    console.log(
      "[order.js] The order is placed",
      options.marketName,
      type,
      price,
      quantity,
      marketResult.id
    );

    // When only success to place order
    if (marketResult.id) {
      newOrder.set({
        marketName: options.marketName,
        orderId: marketResult.id,
        type: type,
        price: price,
        quantity: quantity,
        internalTradeQuantity: internalTradeQuantity,
        placed_at: new Date()
      });

      // Pend the machines
      for (let m of options.participants) await m.pend(newOrder);
      console.log("[order.js] All participants are successfully pended.");

      // awiat to save this order at db
      await new Promise(resolve => {
        newOrder.save(
          {},
          {
            success: () => {
              console.log(
                "[order.js] New order successfully saved. orderId:",
                newOrder.get("orderId")
              );
              // console.log(newOrder.attributes)
              resolve();
            }
          }
        );
      });

      // Only succeeded to place order in this collection
      this.push(newOrder);

      console.log("[order.js] End of order.placeOrder() with new order");
      return newOrder;
    } else {
      console.log(
        "[order.js] Placed order but didn't receive orderId. It needed to check. maybe more than 10 orders at korbit?"
      );
      console.log(newOrder.attributes);
      console.log(marketResult);
      throw new Error("KILL_ME");
    }
  },
  refresh: async function (options) {
    if (this.length == 0) return;
    const coinType = options.coinType || this.at(0).get("coinType");
    const MARKETS = global.rabbit.constants[coinType].MARKET;

    console.log("100 [order.js] Will refresh", this.length, "the local", coinType, "orders");

    // Fetch uncompleted orders from markets
    let remoteOpenOrderIds = [];
    try {
      // fetchOpenOrders from all MARKETS
      let results = await Promise.all(MARKETS.map(marketName => marketAPIs[marketName].fetchOpenOrders(coinType + "/KRW")))
      // and push the openOrder id to `remoteOpenOrderIds`
      results.forEach(re => re.forEach(r => remoteOpenOrderIds.push(r.id)))

      console.log("101 [order.js] remoteOpenOrderIds:\n", remoteOpenOrderIds);
    } catch (e) {
      console.log(
        "101 [order.js] One or two of uncompleted orders fetch is failed. Skip this refresh."
      );
      throw e;
    }

    // Check new completed order in Market
    for (let order of this.where({ coinType: coinType })) {
      // DO NOT USE `this.models` that would be changed by remove event
      // if (_.contains(remoteOpenOrderIds, order.get("orderId").toString())) {
      if (remoteOpenOrderIds.includes(order.get("orderId").toString())) {
        // It's uncompleted order. Don't do anything.
        console.log(
          "104 [order.js] Uncompleted:",
          order.get("orderId"),
          order.get("price"),
          order.get("quantity"),
          order.get("type"),
          ((new Date() - order.get("created_at")) / 3600000).toFixed(1),
          "hours ago",
          order.get("internalTradeQuantity")
        );
      } else {
        if (order.get("status") == "OPEN") {
          console.log(
            "104 [order.js] Detect new completed order. id:",
            order.get("orderId"),
            order.get("type"),
            order.get("price")
          );
          // New complete order!
          await order.completed();
        } else {
          console.log(
            "104 [order.js] Why this order is here? orderId:",
            order.get("orderId"),
            order.get("status")
          );
          console.log(order.attributes);
          throw new Error("KILL_ME");
        }
      }
    } // End of for loop
    console.log("105 [order.js] refresh loop end");
  }, // End of refresh()
  cancel: async function (options) {
    if (this.length == 0) return;

    const coinType = options.coinType || this.at(0).get("coinType"),
      lastPrice = options.lastPrice;
    const MARKETS = global.rabbit.constants[coinType].MARKET;

    // Array.filter() returns `[]` if there is no order. not `undefined`
    const ordersWithCoinType = this.models.filter(order => order.get("coinType") == coinType);
    const ordersByMarket = MARKETS.map(marketName => ordersWithCoinType.filter(order => order.get("marketName") == marketName))
    // console.log(ordersByMarket.length)

    for (let orders of ordersByMarket) {
      // console.log("[order.js] orders.length", orders.length)
      if (orders.length > 7) {
        console.log("[order.js] Time to cancel order.", coinType, "lastPrice:", lastPrice);
        console.log("[order.js] Mo than 5", coinType, "orders at", orders[0].get("marketName"));
        // The most far from current price
        const uselessOrder = _.sortBy(
          orders,
          order => -Math.abs(lastPrice - order.get("price"))
        )[0];

        console.log("[order.js] uselessOrder's ObjectId is", uselessOrder.id);
        // Cancel useless order!
        await uselessOrder.cancel();
      }
    }
  } // End of cancel()
});
