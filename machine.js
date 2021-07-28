"use strict"

const Backbone = require('backbone'),
  backsync = require('backsync'),
  _ = require('underscore')
const broadcast = require("./telegramBot.js").broadcast

exports.Machine = Backbone.Model.extend({
  // urlRoot: "mongodb://localhost:27017/rabbit/bithumb_btc_machines",
  urlRoot: "mongodb://localhost:27017/rabbit/machines",
  sync: backsync.mongodb(),
  idAttribute: "id", // cuz of Backsync
  defaults: {
    capacity: 0.0, // min eth 0.01
    status: "KRW", // "KRW" or "COIN" or "PENDING"
    coinType: "", // "ETH" or "BTC"
    profit_krw: 0,
    profit_rate: 0, //	profit_krw/capacity
    traded_count: 0
  },
  initialize: function (attributes, options) {
    this.on("change:orderId", function (e) {
      console.log("fuck.. orderId is setted at this machine instance..")
      console.log(e.attributes)
      throw new Error("KILL_ME")
    });
    if (!this.id)
      this.set({
        id: require('mongodb').ObjectID(),
        created_at: new Date()
      })
  },
  // Set new mind in runtime instance only. won't deal with databases
  mind: function (options) {
    if (this.get("status") == "PENDING")
      return {
        type: "PENDING"
      }

    let mind = {} //  will be new mind of this machine
    const coinType = this.get("coinType")

    if (this.get("status") == "KRW") {
      // ㅠㅠ
      // this.set({
      //   mind: mind
      // })
      // return mind
      const snapedPrice = (() => {
        const BU = global.rabbit.constants[coinType].BUY_AT_UNIT || 1
        return Math.ceil(options.minAskPrice / BU) * BU
      })()
      if (snapedPrice == this.get("buy_at")) {
        const MB = global.rabbit.constants[coinType].MAX_BUY_AT || Infinity
        if (snapedPrice < MB) {
          if (options.rsi < 37) { // 42
            // FOR BIGGIE PROFIT //
            this.set({
              capacity: (() => {
                const MIN_CRAVING_PERCENTAGE = global.rabbit.constants[coinType].MACHINE_SETTING.MIN_CRAVING_PERCENTAGE
                const INDEX = Math.round(this.get("craving_percentage") / MIN_CRAVING_PERCENTAGE - 1)
                return global.rabbit.constants[coinType].MACHINE_SETTING.CAPACITY_EACH_CRAVING[INDEX]
              })()
            })
            mind = {
              type: "BID",
              price: options.minAskPrice,
              at: new Date()
            }
          } else {
            console.log(`[machine.mind] ${coinType} RSI is ${options.rsi} so I won't buy`)
          }
        } else {
          console.log(`[machine.mind]Wow~ MAX_BUY_AT of ${coinType} is ${MB} And now I'm higher~ I won't buy ~~~`)
        }
      }
    } else if (this.get("status") == "COIN") {
      if (options.maxBidPrice >= (this.get("last_traded_price") * this.get("craving_percentage") / 100) + this.get("last_traded_price"))
        mind = {
          type: "ASK",
          price: options.maxBidPrice,
          at: new Date()
        }
    }

    this.set({
      mind: mind
    })
    return mind
  },
  // The order is submitted
  pend: function () {
    return new Promise(resolve => {
      this.save({
        status: "PENDING"
      }, {
        success: () => {
          // console.log("[machine.js] pending successfully. id:", this.id)
          resolve()
        }
      })
    })
  },
  rollback: function () {
    return new Promise(resolve => {
      const prevStatus = (this.get("mind").type == "ASK") ? "COIN" : "KRW"
      this.save({
        // mind: {},
        status: prevStatus
      }, {
        success: () => {
          resolve()
        }
      })
    })
  },
  // YES
  accomplish: function (order) {
    // Use order.get("price") than this.get("mind").price cuz of the internal trade
    return new Promise(resolve => {
      // console.log("  accomplish() called!! id:", this.id)
      const coinType = this.get("coinType")
      const changed = {
        traded_count: this.get("traded_count") + 1,
        last_traded_price: order.get("price"),
        last_traded_at: new Date(),
        mind: {} // Empty your mind
      }

      // Don't check with order.get("type") Think about a case of internal trade
      if (this.get("mind").type == "ASK") {
        const thisProfit = order.get("price") - this.get("last_traded_price")
        _.extend(changed, {
          status: "KRW",
          profit_krw: this.get("profit_krw") + thisProfit * this.get("capacity"),
          profit_rate: this.get("profit_rate") + thisProfit
        })

        // FOR BIGGIE PROFIT //
        changed.capacity = (() => {
          const MIN_CRAVING_PERCENTAGE = global.rabbit.constants[coinType].MACHINE_SETTING.MIN_CRAVING_PERCENTAGE
          const INDEX = Math.round(this.get("craving_percentage") / MIN_CRAVING_PERCENTAGE) - 1
          return global.rabbit.constants[coinType].MACHINE_SETTING.CAPACITY_EACH_CRAVING[INDEX]
        })()

        console.log("[machine.js] A machine", this.id, "accomplish with profit", thisProfit * this.get("capacity"), "krw. craving_percentage:", this.get("craving_percentage"))
      } else if (this.get("mind").type == "BID") {
        changed.status = "COIN"
        console.log("[machine.js] A machine accomplish", this.id, "bid at", order.get("price"), "I'm usually buy_at", this.get("buy_at"), "craving_percentage", this.get("craving_percentage"))
      }

      // console.log("[machine.js] save with changed:", changed)
      // console.log(this.attributes)
      this.save(changed, {
        success: () => {
          resolve()
        }
      })
    })
  }
})

exports.Arbitrage = exports.Machine.extend({
  urlRoot: "mongodb://localhost:27017/rabbit/arbitrages",
  sync: backsync.mongodb(),
  idAttribute: "id", // cuz of Backsync
  defaults: {
    coinType: "", // "ETH" or "BTC"
    // status: "PENDING", // don't need
    profit_krw: 0,
    traded_count: 0,
    pend_count: 0,
    rollback_count: 0,
    orderIds: []
  },
  mind: function (options) {
    console.log("[Arbitrage.mind] Don't ask Arbitrage's mind")
  },
  // When the order is submitted
  pend: function (order) {
    return new Promise(resolve => {
      if (_.isUndefined(this.orders)) this.orders = []
      this.orders.push(order) // for runtime

      // this.get("orderIds").push(order.get("orderId"))

      this.save({
        status: "PENDING",
        pend_count: this.get("pend_count") + 1,
        orderIds: this.get("orderIds").concat([order.get("orderId")])
      }, {
        success: () => {
          resolve()
        }
      })
    })
  },
  rollback: function (order) {
    return new Promise((resolve, reject) => {
      console.log("[Arbitrage.rollback] Rollback arbitrage: ", this.attributes)
      const changed = {
        rollback_count: this.get("rollback_count") + 1
      }
      if (changed.rollback_count >= 2 || this.get("pend_count") == 1) {
        changed.status = "CANCELED"
      }
      if (this.get("traded_count") == 1) {
        changed.status = "FAILED"
      }

      this.save(changed, {
        success: () => { // DON'T PASS THE SYNC FUNCTION!!
          if (this.get("rollback_count") == 1 && this.get("traded_count") == 0 && this.get("status") == "PENDING") {
            console.log("[Arbitrage.rollback] one of an order of this arbitrage was canceled. so cancel the other order")
            for (let o of this.orders) {
              if (o.get("orderId") != order.get("orderId"))
                o.cancel().then(() => {
                  resolve()
                })
            }
          } else if (this.get("status") == "CANCELED" || this.get("status") == "FAILED") {
            resolve()
          } else {
            console.log("now attributes:", this.attributes)
            reject("rollback result is funny")
          }
        }
      })
    })
  },
  accomplish: function (order) {
    return new Promise(resolve => {
      console.log("  accomplish() called! arbitrages id:", this.id, order.get("machineIds"))
      if (this.id != order.get("machineIds")[0])
        throw new Error("KILL_ME")

      const changed = {
        traded_count: this.get("traded_count") + 1,
        last_traded_at: new Date()
      }

      if (changed.traded_count >= 2) {
        changed.status = "COMPLETED"
      }

      this.save(changed, {
        success: () => {
          console.log("  Arbitrage saved with this:", changed)
          // console.log(this.attributes)
          resolve()
        }
      })
    })
  }
}) // End of exports.Arbitrage

exports.Machines = Backbone.Collection.extend({
  url: "mongodb://localhost:27017/rabbit/machines",
  sync: backsync.mongodb(),
  model: exports.Machine,
  initialize: function (attributes, options) {
    console.log("machines init")
  },
  presentation: function (options) {
    const maxBidPrice = options.orderbook.bids[0][0],
      coinType = options.coinType || this.at(0).get("coinType"),
      PREVIOUS_PROFIT_SUM = global.rabbit.constants[coinType].PREVIOUS_PROFIT_SUM || 0,
      BORN = global.rabbit.constants[coinType].BORN,
      STARTED = global.rabbit.constants[coinType].STARTED,
      MIN_CRAVING_PERCENTAGE = global.rabbit.constants[coinType].MACHINE_SETTING.MIN_CRAVING_PERCENTAGE

    // const sameCoinMachines = this.filter(m => m.get("coinType") == coinType)
    // console.log("LENGTH:", this.length, sameCoinMachines.length)

    let profit_krw_sum = 0,
      total_traded = 0,
      coin_sum = 0,
      krw_damage = 0,
      profit_rate_each_craving = Array.from(global.rabbit.constants[coinType].PREVIOUS_PROFIT_RATE_EACH_CRAVING) || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      traded_count_each_craving = Array.from(global.rabbit.constants[coinType].PREVIOUS_TRADED_COUNT_EACH_CRAVING) || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

    for (let m of this.models) {
      profit_krw_sum += m.get("profit_krw")
      total_traded += m.get("traded_count")
      coin_sum += m.get("status") == "COIN" ? m.get("capacity") : 0
      if (m.get("status") == "PENDING" && m.get("mind").type == "ASK")
        coin_sum += m.get("capacity")

      krw_damage += m.get("status") == "COIN" ?
        (m.get("last_traded_price") - maxBidPrice) * m.get("capacity") : 0

      const pIndex = Math.round(m.get("craving_percentage") / MIN_CRAVING_PERCENTAGE - 1)
      profit_rate_each_craving[pIndex] += m.get("profit_rate")
      traded_count_each_craving[pIndex] += m.get("traded_count")
    }
    // global.rabbit.bought_coin = coin_sum
    profit_krw_sum = profit_krw_sum.toFixed(0) * 1
    profit_rate_each_craving = profit_rate_each_craving.map(el => Math.round(el / 1000)) // 1000 machines each craving

    console.log("--", this.length, coinType, "machines presentation ----  \u20A9", new Intl.NumberFormat().format(PREVIOUS_PROFIT_SUM + profit_krw_sum),
      ":", new Intl.NumberFormat().format(((PREVIOUS_PROFIT_SUM + profit_krw_sum) / ((new Date() - BORN) / 86400000)).toFixed(0)), "per day")

    console.log("Rabbit made \u20A9", new Intl.NumberFormat().format(profit_krw_sum),
      ":", new Intl.NumberFormat().format((profit_krw_sum / ((new Date() - STARTED) / 86400000)).toFixed(0)), "per day; ",
      "damage:", new Intl.NumberFormat().format(krw_damage),
      "so \u20A9", new Intl.NumberFormat().format(profit_krw_sum - krw_damage),
      ":", new Intl.NumberFormat().format(((profit_krw_sum - krw_damage) / ((new Date() - STARTED) / 86400000)).toFixed(0)), "per day")

    console.log("Total Traded:", new Intl.NumberFormat().format(total_traded),
      coinType, "Bought Coin:", coin_sum.toFixed(3))

    console.log("[profit rate]  ", JSON.stringify(profit_rate_each_craving))
    console.log("[traded count] ", JSON.stringify(traded_count_each_craving))

    // for index.js presentation //
    global.rabbit.constants[coinType].profit_krw_sum = PREVIOUS_PROFIT_SUM + profit_krw_sum
    global.rabbit.constants[coinType].krw_damage = krw_damage
  },
  fetchAll: function (options) {
    options = options || {};
    const success = options.success;
    const AMOUNT = 100;
    const that = this;
    let loaded = this.models || [];

    function chunk(skip) {
      that.fetch({
        data: {
          $skip: skip,
          $limit: AMOUNT
        },
        success: function (machines) {
          loaded = loaded.concat(machines.models);
          // console.log(loaded.length, machines.length, machines.models.length);
          if (machines.length == AMOUNT) {
            chunk(skip + AMOUNT);
          } else {
            machines.reset(loaded);
            // console.log("[machines.fetchAll()]", machines.length, "machines are loaded");
            success && success();
          }
        },
        error: function (c, r, o) {
          console.log("[machines.fetchAll()] from db error");
          console.log(r);
        }
      });
    }
    chunk(0);
  },
  mind: function (options) {
    const startTime = Date.now()
    const coinType = options.coinType || this.at(0).get("coinType"),
      markets = options.markets,
      // korbit = options.korbit,
      // coinone = options.coinone,
      KRW_UNIT = global.rabbit.constants[coinType].KRW_UNIT

    let lowAskMarket, highBidMarket
    markets.map(m => {
      if (_.isUndefined(lowAskMarket) || m.orderbook.asks[0][0] < lowAskMarket.orderbook.asks[0][0])
        lowAskMarket = m
      if (_.isUndefined(highBidMarket) || m.orderbook.bids[0][0] > highBidMarket.orderbook.bids[0][0])
        highBidMarket = m
    })


    ///// Validate balance: pre .mind /////
    const valueOfCoinSum = (highBidMarket.balance[coinType].free + lowAskMarket.balance[coinType].free) * highBidMarket.orderbook.bids[0][0]
    if (valueOfCoinSum > 3000000) {
      // using one market
      if (highBidMarket.balance[coinType].free * highBidMarket.orderbook.bids[0][0] < 500000) {
        console.log(`[machines.mind()] Not enough coin at ${highBidMarket.name}.. so won't sell here`)
        highBidMarket = lowAskMarket
      } else if (lowAskMarket.balance.KRW.free < 500000) {
        console.log(`[machines.mind()] Not enough krw at ${lowAskMarket.name}.. so won't buy here`)
        lowAskMarket = highBidMarket
      }
    }

    const bestOrderbook = {
      bids: highBidMarket.orderbook.bids,
      asks: lowAskMarket.orderbook.asks
    }
    console.log("[machines.mind()] Low ask market:", lowAskMarket.name, "\tHigh bid market:", highBidMarket.name)

    // Make decision which orderbook to use
    const minAskPrice = bestOrderbook.asks[0][0],
      maxBidPrice = bestOrderbook.bids[0][0]
    console.log("[machines.mind()] maxBid:", maxBidPrice, " minAsk:", minAskPrice)



    ///// Find or Create //////
    const snapedPrice = (() => {
      const BU = global.rabbit.constants[coinType].BUY_AT_UNIT || 1
      return Math.round(Math.ceil(minAskPrice / BU) * BU)
    })()
    if (this.where({ buy_at: snapedPrice }).length == 0) {
      console.log(`There is no machine for ${minAskPrice} krw in ${this.length} machines, so I will create`)
      const MIN_CRAVING_PERCENTAGE = global.rabbit.constants[coinType].MACHINE_SETTING.MIN_CRAVING_PERCENTAGE
      const CAPACITY_EACH_CRAVING = global.rabbit.constants[coinType].MACHINE_SETTING.CAPACITY_EACH_CRAVING

      for (let i = 1; i <= 10; i++) {
        /// Create new machine! ///
        this.add({
          coinType: coinType,
          capacity: CAPACITY_EACH_CRAVING[i - 1],
          buy_at: snapedPrice,
          craving_percentage: MIN_CRAVING_PERCENTAGE * i
          // craving_krw: Math.round(snapedPrice * MIN_CRAVING_PERCENTAGE * i / 100)
        })
      }
      console.log(`Now "buy_at" as ${snapedPrice} added. ${coinType} machines are ${this.length}`)
    }


    ///// Mind /////
    let bidParticipants = [],
      askParticipants = [],
      bidMachineIds = [],
      askMachineIds = [],
      totalBid = 0.0,
      totalAsk = 0.0,
      internalTradedUnits = 0.0

    this.each(m => {
      const mind = m.mind({
        rsi: options.rsi,
        minAskPrice: minAskPrice,
        maxBidPrice: maxBidPrice
      })
      if (mind.type == "BID") {
        totalBid += m.get('capacity')

        bidParticipants.push(m)
        bidMachineIds.push(m.id + "") // attached "" to avoid ObjectId("asoweugbalskug")
        // DONT USE `_.pluck(options.participants, "id")` It will push ObjectID("adf0oqh3t")
      } else if (mind.type == "ASK") {
        totalAsk += m.get('capacity')

        askParticipants.push(m)
        askMachineIds.push(m.id + "") // attached "" to avoid ObjectId("asoweugbalskug")
      }
    })
    // const PRECISION = global.rabbit.constants[coinType].PRECISION
    // totalBid = totalBid.toFixed(PRECISION) * 1
    // totalAsk = totalAsk.toFixed(PRECISION) * 1
    const CU = global.rabbit.constants[coinType].COIN_UNIT
    totalBid = (Math.round(totalBid / CU) * CU).toFixed(global.rabbit.constants[coinType].COIN_PRECISION) * 1
    totalAsk = (Math.round(totalAsk / CU) * CU).toFixed(global.rabbit.constants[coinType].COIN_PRECISION) * 1

    ///// Validate balance: after .mind /////
    ///// And Make a result /////
    let result // will return this result
    if (totalAsk == 0 && totalBid == 0)
      return []
    if (bestOrderbook.bids[0][0] <= bestOrderbook.asks[0][0]) { // internal trade recommended
      // Validate the balance
      if (totalBid > totalAsk) {
        if ((totalBid - totalAsk) * bestOrderbook.asks[0][0] < lowAskMarket.balance.KRW.free - 10000) {
          console.log("[machine.js] I have money to buy coin at", lowAskMarket.name)
        } else {
          console.log("[machine.js] Not enough money at", lowAskMarket.name, "hurry up!!!!!")
          return []
        }
      } else {
        if ((totalAsk - totalBid) * 1.1 < highBidMarket.balance[coinType].free) { // 10% headroom for fee
          console.log("[machine.js] I have coin to ask at", highBidMarket.name)
        } else {
          console.log("[machine.js] Not enough coin at", highBidMarket.name, "hurry up!!!!!")
          return []
        }
      }
      const marketName = (totalBid > totalAsk) ? lowAskMarket.name : highBidMarket.name
      // Make result as one so that can be internal trade
      result = [{
        marketName: marketName,
        coinType: coinType,
        bidQuantity: totalBid,
        askQuantity: totalAsk,
        bidPrice: (marketName == "BITHUMB") ? bestOrderbook.asks[0][0] : bestOrderbook.asks[0][0] - KRW_UNIT, // Buy at minAskPrice
        askPrice: (marketName == "KORBIT") ? bestOrderbook.bids[0][0] + KRW_UNIT : bestOrderbook.bids[0][0],
        participants: bidParticipants.concat(askParticipants),
        machineIds: bidMachineIds.concat(askMachineIds)
      }]
    } else { // Don't make internal trade in this case.
      // Validate the balances
      if (totalBid * bestOrderbook.asks[0][0] < lowAskMarket.balance.KRW.free - 10000) {
        console.log("[machine.js] Enough money at", lowAskMarket.name)
      } else {
        console.log("[machine.js] Put money at", lowAskMarket.name, "hurry up!!!!!!")
        totalBid = 0, bidMachineIds = [], bidParticipants = []
      }
      if (totalAsk * 1.1 < highBidMarket.balance[coinType].free) { // 10% headroom for fee..
        console.log("[machine.js] Enough", coinType, "at", highBidMarket.name)
      } else {
        console.log("[machine.js] Put", coinType, "at", highBidMarket.name, "hurry up!!!!!!")
        totalAsk = 0, askMachineIds = [], askParticipants = []
      }
      // Make two result to make order seprarately
      result = [{
        marketName: lowAskMarket.name,
        coinType: coinType,
        bidQuantity: totalBid,
        askQuantity: 0,
        bidPrice: (lowAskMarket.name == "BITHUMB") ? bestOrderbook.asks[0][0] : bestOrderbook.asks[0][0] - KRW_UNIT, // Buy at minAskPrice
        participants: bidParticipants,
        machineIds: bidMachineIds
      }, {
        marketName: highBidMarket.name,
        coinType: coinType,
        bidQuantity: 0,
        askQuantity: totalAsk,
        askPrice: (highBidMarket.name == "KORBIT") ? bestOrderbook.bids[0][0] + KRW_UNIT : bestOrderbook.bids[0][0],
        participants: askParticipants,
        machineIds: askMachineIds
      }]
    }

    console.log("[machine.js] machines.mind() takes", ((Date.now() - startTime) / 1000).toFixed(3), "sec")
    return result
  }
});

exports.Arbitrages = exports.Machines.extend({
  url: "mongodb://localhost:27017/rabbit/arbitrages",
  sync: backsync.mongodb(),
  model: exports.Arbitrage,
  initialize: function (attributes, options) {
    console.log("arbitrages init")
    this.on("change:status", a => {
      console.log("event", a.id, a.get("status"))
      switch (a.get("status")) {
        case "COMPLETED":
        case "CANCELED":
        case "FAILED":
          console.log("The arbitrage", a.get("status"), " and will be removed from runtime. but remains in DB")
          this.remove(a)
          // delete o
          break
      }
    })
  },
  presentation: function () {
    return new Promise(resolve => {
      const completedArbitrages = new exports.Arbitrages()
      completedArbitrages.fetch({
        data: {
          status: "COMPLETED"
        },
        success: () => {
          let profit_sum = 0,
            quantity_sum = 0
          completedArbitrages.each(a => {
            // console.log(a.get("profitRate"), a.id)
            profit_sum += a.get("profitRate") * a.get("quantity")
            quantity_sum += a.get("quantity")
          })
          console.log("Arbitrage Profit: \u20A9", new Intl.NumberFormat().format(profit_sum))
          console.log("quantity_sum:", new Intl.NumberFormat().format(quantity_sum))
          resolve()
        }
      })
    })
  },
  // Make new arbitrage machine!
  mind: function (options) {
    const coinType = options.coinType,
      markets = options.markets

    console.log(`[arbitrages.mind] ${coinType}  arbitrages length ${this.length} !!`)

    let lowMarket, highMarket, quantity = 0
    markets.forEach(m => {
      if (_.isUndefined(lowMarket) || m.orderbook.asks[0][0] < lowMarket.orderbook.asks[0][0])
        lowMarket = m
      if (_.isUndefined(highMarket) || m.orderbook.bids[0][0] > highMarket.orderbook.bids[0][0])
        highMarket = m
    })

    const profitRate = (highMarket.orderbook.bids[0][0] - lowMarket.orderbook.asks[0][0])
      - global.rabbit.constants[coinType].KRW_UNIT * 2
      - highMarket.orderbook.bids[0][0] * 0.0025
      - lowMarket.orderbook.asks[0][0] * 0.0025; // 0.25% fee
    console.log(`lowMarket: ${lowMarket.name}:${lowMarket.orderbook.asks[0][0]}, highMarket: ${highMarket.name}:${highMarket.orderbook.bids[0][0]}`)

    //// Decide quantity ////
    const prPerPrice = (profitRate / highMarket.orderbook.asks[0][0]) * 100
    const LIMIT = (() => { // quantity
      // FOR BIGGIE PROFIT
      const COIN_FOR_150 = 1500000 / highMarket.orderbook.asks[0][0] // about 1,500,000 krw value coin
      // If prPerPrice were 1%, then Deal about 800,000 krw value coin
      return prPerPrice * COIN_FOR_150
    })()

    quantity = Math.min(LIMIT, lowMarket.orderbook.asks[0][1], highMarket.orderbook.bids[0][1])
    // quantity = quantity.toFixed(global.rabbit.constants[coinType].PRECISION) * 1
    quantity = Math.round(quantity / global.rabbit.constants[coinType].COIN_UNIT) * global.rabbit.constants[coinType].COIN_UNIT
    quantity = quantity.toFixed(global.rabbit.constants[coinType].COIN_PRECISION) * 1 // Round

    if (profitRate < 4 || prPerPrice < 0.5 ||
      // quantity < Math.pow(0.1, global.rabbit.constants[coinType].PRECISION) ||
      quantity < global.rabbit.constants[coinType].COIN_UNIT * 10 ||
      quantity * lowMarket.orderbook.asks[0][0] < 10000) {
      console.log("Pass arbitrage. profitRate: \u20A9", profitRate, "prPerPrice(min 0.5):", prPerPrice, "quantity:", quantity)
      return []
    }

    console.log(" 💴  IT'S GOLDEN TIME 💴 ", coinType, "quantity:", quantity, "profitRate:", profitRate, "prPerPrice(%):", prPerPrice)
    broadcast(" 💴  IT'S GOLDEN TIME 💴 " + coinType + "quantity:" + quantity + "profitRate:" + profitRate + "prPerPrice(%):" + prPerPrice)
    console.log(lowMarket.name, ":buy at", lowMarket.orderbook.asks[0][0])
    console.log(highMarket.name, ":ask at", highMarket.orderbook.bids[0][0])

    //// Validate balance ////
    if ((lowMarket.balance[coinType].free + highMarket.balance[coinType].free) * lowMarket.orderbook.asks[0][0] < 2000000) {
      console.log(`[arbitrages.mind] Not enough ${coinType} to arbitrage yet..`)
      return [{}, {}]
    }
    if (lowMarket.balance.KRW.free < lowMarket.orderbook.asks[0][0] * quantity * 1.1) { // 10% headroom for fee
      console.log("[arbitrages.mind] Not enough krw at", lowMarket.name, "GIVE ME THE MONEY!!")
      return [{}, {}]
    }
    if (highMarket.balance[coinType].free < quantity * 1.1) { // 10% headroom for fee
      console.log(`[arbitrages.mind] Not enough ${coinType} at ${highMarket.name} MOVE THE COIN!`)
      return [{}, {}]
    }

    /// If There is too many uncompleted arbitrages..
    if (this.length > 11) {
      console.log(`[arbitrages.mind] Too many arbitrages. length: ${this.length}`)
      return []
    }

    //// New arbitrage only here ////
    console.log("[arbitrages.mind] Well. It looks like real money. Make new arbitrage!")
    const newArbitrage = new exports.Arbitrage({
      coinType: coinType,
      lowMarketName: lowMarket.name,
      highMarketName: highMarket.name,
      // just for log below
      profit_krw: quantity * profitRate,
      quantity: quantity,
      profitRate: profitRate,
      bidPrice: lowMarket.orderbook.asks[0][0], // + global.rabbit.constants[coinType].KRW_UNIT,  // Buy at minAskPrice
      askPrice: highMarket.orderbook.bids[0][0] // - global.rabbit.constants[coinType].KRW_UNIT  // Ask at maxBidPrice
    })
    this.push(newArbitrage)

    return [{
      marketName: lowMarket.name,
      coinType: newArbitrage.get("coinType"),
      bidQuantity: quantity,
      askQuantity: 0,
      bidPrice: newArbitrage.get("bidPrice"),
      // askPrice: maxBidPrice,
      participants: [newArbitrage],
      machineIds: [newArbitrage.id + ""] // attached "" to avoid ObjectId("asoweugbalskug")
    },
    {
      marketName: highMarket.name,
      coinType: newArbitrage.get("coinType"),
      bidQuantity: 0,
      askQuantity: quantity,
      // bidPrice: minAskPrice,
      askPrice: newArbitrage.get("askPrice"),
      participants: [newArbitrage],
      machineIds: [newArbitrage.id + ""] // attached "" to avoid ObjectId("asoweugbalskug")
    }
    ]
  } // end of .mind()
})




// exports.Machine = Machine;
// exports.Machines = Machines;
// exports.BithumbBtcMachine = Machine.extend({
// });
// exports.BithumbBtcMachines = Machines.extend({
// });
//
// exports.CoinOneEthMachine = Machine.extend({
// });
// exports.CoinOneEthMachines = Machines.extend({
// });