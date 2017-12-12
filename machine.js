"use strict"

const Backbone = require('backbone'),
    backsync = require('backsync'),
    _ = require('underscore')


exports.Machine = Backbone.Model.extend({
    // urlRoot: "mongodb://localhost:27017/rabbit/bithumb_btc_machines",
    urlRoot: "mongodb://localhost:27017/rabbit/machines",
    sync: backsync.mongodb(),
    idAttribute: "id", // cuz of Backsync
    defaults: {
        capacity: 0.0, // min eth 0.01
        status: "KRW", // "KRW" or "COIN" or "PENDING"
        coinType: "",  // "ETH" or "BTC"
        profit_krw: 0,
        profit_rate: 0, //	profit_krw/capacity
        traded_count: 0
    },
    initialize: function(attributes, options) {
      this.on("change:orderId", function(e){
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
    mind: function(options) {
      if (this.get("status") == "PENDING")
        return {type: "PENDING"}

      let mind = {} //  will be new mind of this machine
      const coinType = this.get("coinType")

      if (this.get("status") == "KRW") {
        const snapedPrice = (() => {
          const BU = global.rabbit.constants[coinType].BUY_AT_UNIT || 1
          return Math.ceil(options.minAskPrice / BU) * BU
        })()
        if (snapedPrice == this.get("buy_at")) {
          const MB = global.rabbit.constants[coinType].MAX_BUY_AT || Infinity
          if (snapedPrice < MB) {
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
            console.log(`[machine.mind]Wow~ MAX_BUY_AT of ${coinType} is ${MB} And now I'm higher~ I won't buy ~~ ~  ~    ~`)
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
    pend: function(){
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
    rollback: function(){
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
    accomplish: function(order) {
      // Use order.get("price") than this.get("mind").price cuz of the internal trade
      return new Promise(resolve => {
        // console.log("  accomplish() called!! id:", this.id)
        const coinType = this.get("coinType")
        const changed = {
            traded_count: this.get("traded_count") + 1,
            last_traded_price: order.get("price"),
            last_traded_at: new Date(),
            mind: {}  // Empty your mind
          }

        // Don't check with order.get("type") Think about a case of internal trade
        if (this.get("mind").type == "ASK"){
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
        }else if (this.get("mind").type == "BID"){
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
  mind: function(options) {
    console.log("[Arbitrage.mind] Don't ask Arbitrage's mind")
  },
  // When the order is submitted
  pend: function(order){
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
  rollback: function(order){
    return new Promise((resolve, reject) => {
      console.log("[Arbitrage.rollback] Rollback arbitrage: ", this.attributes)
      const changed = {
        rollback_count: this.get("rollback_count") + 1
      }
      if (changed.rollback_count >= 2 || this.get("pend_count") == 1){
        changed.status = "CANCELED"
      }
      if (this.get("traded_count") == 1){
        changed.status = "FAILED"
      }
 
      this.save(changed, {
        success: () => {  // DON'T PASS THE SYNC FUNCTION!!
          if (this.get("rollback_count") == 1 && this.get("traded_count") == 0 && this.get("status") == "PENDING"){
            console.log("[Arbitrage.rollback] one of an order of this arbitrage was canceled. so cancel the other order")
            for (let o of this.orders){
              if (o.get("orderId") != order.get("orderId"))
                o.cancel().then(() => { resolve() })
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
  accomplish: function(order) {
    return new Promise(resolve => {
      console.log("  accomplish() called! arbitrages id:", this.id, order.get("machineIds"))
      if (this.id != order.get("machineIds")[0])
        throw new Error("KILL_ME")

      const changed = {
          traded_count: this.get("traded_count") + 1,
          last_traded_at: new Date()
        }

      if (changed.traded_count >= 2){
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
})  // End of exports.Arbitrage

exports.Machines = Backbone.Collection.extend({
    url: "mongodb://localhost:27017/rabbit/machines",
    sync: backsync.mongodb(),
    model: exports.Machine,
    initialize: function(attributes, options) {
      console.log("machines init")
    },
    presentation: function(options){
      const maxBidPrice = options.orderbook.bid[0].price,
        coinType = options.coinType || this.at(0).get("coinType"),
        PREVIOUS_PROFIT_SUM = global.rabbit.constants[coinType].PREVIOUS_PROFIT_SUM || 0,
        BORN = global.rabbit.constants[coinType].BORN,
        STARTED = global.rabbit.constants[coinType].STARTED,
        MIN_CRAVING_PERCENTAGE = global.rabbit.constants[coinType].MACHINE_SETTING.MIN_CRAVING_PERCENTAGE

      // const sameCoinMachines = this.filter(m => m.get("coinType") == coinType)
      // console.log("LENGTH:", this.length, sameCoinMachines.length)
      // console.log("Is it Array?", _.isArray(sameCoinMachines))

      let profit_krw_sum = 0,
        total_traded = 0,
        coin_sum = 0,
        krw_damage = 0,
        profit_rate_each_craving = Array.from(global.rabbit.constants[coinType].PREVIOUS_PROFIT_RATE_EACH_CRAVING) || [0,0,0,0,0, 0,0,0,0,0],
        traded_count_each_craving = Array.from(global.rabbit.constants[coinType].PREVIOUS_TRADED_COUNT_EACH_CRAVING) || [0,0,0,0,0, 0,0,0,0,0]

      for (let m of this.models){
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
      profit_rate_each_craving = profit_rate_each_craving.map(el => Math.round(el/1000)) // 1000 machines each craving
      
      console.log("--", this.length, coinType, "machines presentation ----  \u20A9", new Intl.NumberFormat().format(PREVIOUS_PROFIT_SUM + profit_krw_sum),
        ":", new Intl.NumberFormat().format(((PREVIOUS_PROFIT_SUM + profit_krw_sum) / ((new Date() - BORN ) / 86400000)).toFixed(0)), "per day" )

      console.log("Rabbit made \u20A9", new Intl.NumberFormat().format(profit_krw_sum),
        ":", new Intl.NumberFormat().format((profit_krw_sum / ((new Date() - STARTED)/ 86400000)).toFixed(0)), "per day; ",
        "damage:", new Intl.NumberFormat().format(krw_damage),
        "so \u20A9", new Intl.NumberFormat().format(profit_krw_sum - krw_damage),
        ":", new Intl.NumberFormat().format(((profit_krw_sum - krw_damage) / ((new Date() - STARTED)/ 86400000)).toFixed(0)), "per day")

      console.log("Total Traded:", new Intl.NumberFormat().format(total_traded),
        ", Bought Coin:", coin_sum.toFixed(3))

      console.log("[profit rate]  ", JSON.stringify(profit_rate_each_craving))
      console.log("[traded count] ", JSON.stringify(traded_count_each_craving))

      // for index.js presentation //
      global.rabbit.constants[coinType].profit_krw_sum = PREVIOUS_PROFIT_SUM + profit_krw_sum
      global.rabbit.constants[coinType].krw_damage = krw_damage
    },
    fetchAll: function(options) {
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
          success: function(machines) {
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
          error: function(c, r, o) {
            console.log("[machines.fetchAll()] from db error");
            console.log(r);
          }
        });
      }
      chunk(0);
    },
    mind: function(options) {
      const startTime = new Date()
      const coinType = options.coinType || this.at(0).get("coinType"),
        korbit = options.korbit,
        coinone = options.coinone,
        MIN_KRW_UNIT = global.rabbit.constants[coinType].MIN_KRW_UNIT

      let highBidMarket, lowAskMarket
      if (coinone.orderbook.bid[0].price > korbit.orderbook.bid[0].price){
        highBidMarket = coinone
      }else {
        highBidMarket = korbit
      }
      if (coinone.orderbook.ask[0].price < korbit.orderbook.ask[0].price){
        lowAskMarket = coinone
      }else {
        lowAskMarket = korbit
      }

      ///// Validate balance: pre .mind /////
      const valueOfCoinSum = (highBidMarket.balance[coinType].available + lowAskMarket.balance[coinType].available) * highBidMarket.orderbook.bid[0].price
      if (valueOfCoinSum > 3000000){
        // using one market
        if (highBidMarket.balance[coinType].available * highBidMarket.orderbook.bid[0].price < 500000){
          console.log(`[machines.mind()] Not enough coin at ${highBidMarket.name}.. so won't sell here`)
          highBidMarket = lowAskMarket
        }else if (lowAskMarket.balance.KRW.available < 500000){
          console.log(`[machines.mind()] Not enough krw at ${lowAskMarket.name}.. so won't buy here`)
          lowAskMarket = highBidMarket
        }
      }

      const bestOrderbook = {
        bid: highBidMarket.orderbook.bid,
        ask: lowAskMarket.orderbook.ask
      }
      console.log("[machines.mind()] Low ask market:", lowAskMarket.name, "\tHigh bid market:", highBidMarket.name)

      // Make decision which orderbook to use
      const minAskPrice = bestOrderbook.ask[0].price,
          maxBidPrice = bestOrderbook.bid[0].price
      console.log("[machines.mind()] maxBid:", maxBidPrice, " minAsk:", minAskPrice)


      
      ///// Find or Create //////
      const snapedPrice = (() => {
        const BU = global.rabbit.constants[coinType].BUY_AT_UNIT || 1
        return Math.round(Math.ceil(minAskPrice / BU) * BU )
      })()
      if (this.where({ buy_at: snapedPrice}).length == 0){
        const MB = global.rabbit.constants[coinType].MAX_BUY_AT || Infinity
        if (snapedPrice < MB){
          console.log(`There is no machine for ${minAskPrice} krw in ${this.length} machines, so I will create`)
          const MIN_CRAVING_PERCENTAGE = global.rabbit.constants[coinType].MACHINE_SETTING.MIN_CRAVING_PERCENTAGE
          const CAPACITY_EACH_CRAVING = global.rabbit.constants[coinType].MACHINE_SETTING.CAPACITY_EACH_CRAVING
          
          for (let i = 1; i <= 10; i++){
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
        } else {
          console.log(`Wow~ MAX_BUY_AT of ${coinType} is ${MB} And now I'm higher~ I won't create new machine ~~ ~  ~    ~`)
          return []
        }
      }

      
      // const MB = global.rabbit.constants[coinType].MAX_BUY_AT || Infinity
      // if (snapedPrice < MB) {
      if (this.where({buy_at: snapedPrice}).length == 0) {
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
      // } else {
      //   console.log(`MAX_BUY_AT of ${coinType} is ${MB} And now I'm higher. I won't create new machine.`)
      //   return []
      // }


      ///// Mind /////
      let bidParticipants = [], askParticipants = [],
        bidMachineIds = [], askMachineIds = [],
        totalBid = 0.0, totalAsk = 0.0,
        internalTradedUnits = 0.0

      this.each(m => {
        const mind = m.mind({
          minAskPrice: minAskPrice,
          maxBidPrice: maxBidPrice
        })
        if (mind.type == "BID"){
          totalBid += m.get('capacity')

          bidParticipants.push(m)
          bidMachineIds.push(m.id + "") // attached "" to avoid ObjectId("asoweugbalskug")
          // DONT USE `_.pluck(options.participants, "id")` It will push ObjectID("adf0oqh3t")
        }else if (mind.type == "ASK"){
          totalAsk += m.get('capacity')

          askParticipants.push(m)
          askMachineIds.push(m.id + "") // attached "" to avoid ObjectId("asoweugbalskug")
        }
      })
      const PRECISION = global.rabbit.constants[coinType].PRECISION
      totalBid = totalBid.toFixed(PRECISION) * 1
      totalAsk = totalAsk.toFixed(PRECISION) * 1

      ///// Validate balance: after .mind /////
      ///// And Make a result /////
      let result  // will return this result
      if (totalAsk == 0 && totalBid == 0)
        return []
      if (bestOrderbook.bid[0].price <= bestOrderbook.ask[0].price){  // internal trade recommended
        // Validate the balance
        if (totalBid > totalAsk){
          if ((totalBid - totalAsk) * bestOrderbook.ask[0].price < lowAskMarket.balance.KRW.available - 10000){
            console.log("[machine.js] I have money to buy coin at", lowAskMarket.name )
          }else{
            console.log("[machine.js] Not enough money at", lowAskMarket.name, "hurry up!!!!!")
            return []
          }
        }else{
          if ((totalAsk - totalBid) * 1.1 < highBidMarket.balance[coinType].available) { // 0.1% headroom for fee
            console.log("[machine.js] I have coin to ask at", highBidMarket.name)
          }else{
            console.log("[machine.js] Not enough coin at", highBidMarket.name, "hurry up!!!!!")
            return []
            // return [{
            //   marketName: marketName,
            //   coinType: coinType,
            //   bidQuantity: totalBid,
            //   askQuantity: 0,
            //   bidPrice: bestOrderbook.ask[0].price - MIN_KRW_UNIT,  // Buy at minAskPrice
            //   askPrice: (marketName == "KORBIT") ? bestOrderbook.bid[0].price + MIN_KRW_UNIT : bestOrderbook.bid[0].price,
            //   participants: bidParticipants,
            //   machineIds: bidMachineIds
            // }]
          }
        }
        const marketName = (totalBid > totalAsk) ? lowAskMarket.name : highBidMarket.name
        // Make result as one so that can be internal trade
        result = [{
          marketName: marketName,
          coinType: coinType,
          bidQuantity: totalBid,
          askQuantity: totalAsk,
          bidPrice: bestOrderbook.ask[0].price - MIN_KRW_UNIT,  // Buy at minAskPrice
          askPrice: (marketName == "KORBIT") ? bestOrderbook.bid[0].price + MIN_KRW_UNIT : bestOrderbook.bid[0].price,
          participants: bidParticipants.concat(askParticipants),
          machineIds: bidMachineIds.concat(askMachineIds)
        }]
      } else {  // Don't make internal trade in this case.
        // Validate the balances
        if (totalBid * bestOrderbook.ask[0].price < lowAskMarket.balance.KRW.available - 10000){
          console.log("[machine.js] Enough money at", lowAskMarket.name)
        }else {
          console.log("[machine.js] Put money at", lowAskMarket.name, "hurry up!!!!!!")
          totalBid = 0, bidMachineIds = [], bidParticipants = []
        }
        if (totalAsk * 1.1 < highBidMarket.balance[coinType].available) {  // 0.1% headroom for fee
          console.log("[machine.js] Enough",coinType ,"at", highBidMarket.name)
        }else {
          console.log("[machine.js] Put",coinType ,"at", highBidMarket.name, "hurry up!!!!!!")
          totalAsk = 0, askMachineIds = [], askParticipants = []
        }
        // Make two result to make order seprarately
        result = [{
          marketName: lowAskMarket.name,
          coinType: coinType,
          bidQuantity: totalBid,
          askQuantity: 0,
          bidPrice: bestOrderbook.ask[0].price - MIN_KRW_UNIT,  // Buy at minAskPrice
          // askPrice: bestOrderbook.bid[0].price,
          participants: bidParticipants,
          machineIds: bidMachineIds
        }, {
          marketName: highBidMarket.name,
          coinType: coinType,
          bidQuantity: 0,
          askQuantity: totalAsk,
          // bidPrice: bestOrderbook.ask[0].price,  // Buy at minAskPrice
          askPrice: (highBidMarket.name == "KORBIT") ? bestOrderbook.bid[0].price + MIN_KRW_UNIT : bestOrderbook.bid[0].price,
          participants: askParticipants,
          machineIds: askMachineIds
        }]
      }
      
      console.log("[machine.js] machines.mind() takes", ((new Date() - startTime) / 1000).toFixed(3), "sec")
      return result
    }
});

exports.Arbitrages = exports.Machines.extend({
  url: "mongodb://localhost:27017/rabbit/arbitrages",
  sync: backsync.mongodb(),
  model: exports.Arbitrage,
  initialize: function(attributes, options) {
    console.log("arbitrages init")
    this.on("change:status", a => {
      console.log("event", a.id, a.get("status"))
      switch (a.get("status")) {
        case "COMPLETED":
        case "CANCELED":
        case "FAILED":
          console.log("The arbitrage", a.get("status") ," and will be removed from runtime. but remains in DB")
          this.remove(a)
          // delete o
          break
      }
    })
  },
  presentation: function(){
    return new Promise(resolve => {
      const completedArbitrages  = new exports.Arbitrages()
      completedArbitrages.fetch({
        data: {
          status: "COMPLETED"
        },
        success: () => {
          let profit_sum = 0, quantity_sum = 0
          completedArbitrages.each(a =>{
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
  mind: function(options) {
    const coinType = options.coinType,
      coinone = options.coinone,
      korbit = options.korbit
    
    console.log(`[arbitrages.mind] ${coinType} arbitrages length ${this.length}`)
    if (this.length > 8){
      return []
    }

    const coinoneMaxBid = coinone.orderbook.bid[0].price,
      coinoneMinAsk = coinone.orderbook.ask[0].price,
      korbitMaxBid = korbit.orderbook.bid[0].price,
      korbitMinAsk = korbit.orderbook.ask[0].price

    const korbit2coinone = coinoneMaxBid - korbitMinAsk,
      coinone2korbit = korbitMaxBid - coinoneMinAsk

    const profitRate = (korbit2coinone > coinone2korbit) ? korbit2coinone : coinone2korbit
    // console.log(coinoneMaxBid, coinoneMinAsk, korbitMaxBid, korbitMinAsk)
    console.log("(korbit to coinone:", korbit2coinone, ", coinone to korbit:", coinone2korbit, ")")

    let lowMarket, highMarket, quantity = 0
    if (korbit2coinone > coinone2korbit){
      lowMarket = korbit
      highMarket = coinone
    } else if (korbit2coinone < coinone2korbit) {
      lowMarket = coinone
      highMarket = korbit
    } else if (korbit2coinone == coinone2korbit) {  // It happens
      return []
    }

    //// Decide quantity ////
    const prPerPrice = (profitRate / highMarket.orderbook.ask[0].price) * 100
    const LIMIT = (() => {  // quantity
      // FOR BIGGIE PROFIT
      const COIN_FOR_700000 = 700000 / highMarket.orderbook.ask[0].price // about 700,000 krw value coin
      // If prPerPrice were 1%, then Deal about 700,000 krw value coin
      return prPerPrice * COIN_FOR_700000
    })()
    // const LIMIT = (profitRate > 4000) ? 2.0 : 0.5 // 2.0 or 0.5
    quantity = (lowMarket.orderbook.ask[0].qty < highMarket.orderbook.bid[0].qty) ?
      lowMarket.orderbook.ask[0].qty : highMarket.orderbook.bid[0].qty
    // quantity = quantity - 0.01  // Kind of flooring
    quantity = (quantity > LIMIT) ? LIMIT : quantity  // Limit
    quantity = quantity.toFixed(global.rabbit.constants[coinType].PRECISION) * 1

    if (profitRate < 4 || prPerPrice < 0.7 || quantity < Math.pow(0.1, global.rabbit.constants[coinType].PRECISION).toFixed(global.rabbit.constants[coinType].PRECISION) * 1){
      console.log("Pass arbitrage. profitRate: \u20A9", profitRate, "prPerPrice(min 0.7):", prPerPrice, "quantity:", quantity)
      return []
    }

    console.log(" 💴  IT'S GOLDEN TIME 💴  quantity:", quantity, "profitRate:", profitRate, "prPerPrice(%):", prPerPrice)
    console.log(lowMarket.name, ":buy at", lowMarket.orderbook.ask[0].price,)
    console.log(highMarket.name, ":ask at", highMarket.orderbook.bid[0].price)


    //// Validate balance ////
    if ((lowMarket.balance[coinType].available + highMarket.balance[coinType].available) * lowMarket.orderbook.ask[0].price < 2000000){
      console.log(`[arbitrages.mind] Not enough ${coinType} to arbitrage yet..`)
      return []
    }
    if (lowMarket.balance.KRW.available < lowMarket.orderbook.ask[0].price * quantity * 1.1) { // 0.1% headroom for fee
      console.log("[arbitrages.mind] Not enough krw at", lowMarket.name, "GIVE ME THE MONEY!!")
      return []
    }
    if (highMarket.balance[coinType].available < quantity * 1.1){ // 0.1% headroom for fee
      console.log(`[arbitrages.mind] Not enough ${coinType} at ${highMarket.name} MOVE THE COIN!`)
      return []
    }


    //// New arbitrage only here ////
    console.log("Well. It looks like real money. Make new arbitrage!")
    const newArbitrage = new exports.Arbitrage({
      coinType: coinType,
      lowMarketName: lowMarket.name,
      highMarketName: highMarket.name,
      // just for log below
      profit_krw: quantity * profitRate,
      quantity: quantity,
      profitRate: profitRate,
      bidPrice: lowMarket.orderbook.ask[0].price + global.rabbit.constants[coinType].MIN_KRW_UNIT,  // Buy at minAskPrice
      askPrice: highMarket.orderbook.bid[0].price - global.rabbit.constants[coinType].MIN_KRW_UNIT  // Ask at maxBidPrice
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
        machineIds: [newArbitrage.id + ""]  // attached "" to avoid ObjectId("asoweugbalskug")
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