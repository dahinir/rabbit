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
        // craving_krw: 2000, // 2,000 won!
        capacity: 0.01, // min eth 0.01
        // negativeHope: -5000,
        // positiveHope: -3000,
        // neverHope: -10000,
        // maxHope: 0,
        status: "KRW", // "KRW" or "COIN" or "PENDING"
        coinType: "",  // "ETH" or "BTC"
        marketName: "",  // "COINONE" etcs..

        // profit_btc: 0,
        profit_krw: 0,
        profit_rate: 0, //	profit_krw/capacity
        traded_count: 0,
        last_traded_price: 0
    },
    initialize: function(attributes, options) {
      // if (attributes.orderId){
      //   console.log("SOMETHING WRONG!!")
      //   console.log(attributes)
      //   throw new Error("a")
      // }
      this.on("change:orderId", function(e){
        console.log(e.attributes)
        throw new Error("fuck.. orderId:")
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
        return {
          type: "PENDING"
        }
      // Fee is mo expensive.. depressed until Lv5
      // if (this.get("craving_krw") < 7000)
      //   return {
      //     type: "DEPRESSED"
      //   }

      options = options || {}
      let mind = {} //  will be new mind of this machine

      switch (this.get("name")) {
        case "SCATTERER": // These machines scatter every prices
          if (this.get("status") == "KRW") {
            if (options.minAskPrice == this.get("buy_at") || options.minAskPrice == this.get("buy_at") - 50)
              mind = {
                type: "BID",
                price: options.minAskPrice
              }
          } else if (this.get("status") == "COIN") {
            // Used this.get("last_traded_price") not this.get("buy_at") cuz I wanna know what craving_krw is best for profit per unit time
            if (options.maxBidPrice >= this.get("craving_krw") + this.get("last_traded_price"))
              mind = {
                type: "ASK",
                price: options.maxBidPrice
              }
          }
          break
      }

      mind.at = new Date()
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
        console.log("  accomplish() called!! id:", this.id)

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
          // FOR BIGGIE PROFIT KRW
          if (this.get("craving_krw") == 5000)
            changed.capacity = 0.01
          if (this.get("craving_krw") == 6000)
            changed.capacity = 0.01
          else if (this.get("craving_krw") == 7000)
            changed.capacity = 0.02
          else if (this.get("craving_krw") == 8000)
            changed.capacity = 0.02
          else if (this.get("craving_krw") == 9000)
            changed.capacity = 0.03
          else if (this.get("craving_krw") == 10000)
            changed.capacity = 0.05

          console.log("[machine.js] A machine accomplish with profit", thisProfit * this.get("capacity"),
            "krw. My craving_krw is", this.get("craving_krw"))
        }else if (this.get("mind").type == "BID"){
          changed.status = "COIN"
          console.log("[machine.js] A machine accomplish the bid at", order.get("price"), "I'm usually buy_at", this.get("buy_at"), "craving_krw", this.get("craving_krw"))
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
    coinType: "ETH", // "ETH" or "BTC"
    // status: "PENDING", // don't need
    profit_krw: 0,
    traded_count: 0,
    pend_count: 0,
    rollback_count: 0,
    orderIds: []
  },
  mind: function(options) {
    console.log("[machine.js] Don't ask Arbitrage's mind")
  },
  // The order is submitted
  pend: function(order){
    return new Promise(resolve => {
      _.isUndefined(this.orders)
        this.orders = []
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
    return new Promise(resolve => {
      console.log("[machine.js] Rollback arbitrage: ", this.attributes)
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
        success: () => {
          if (this.get("rollback_count") == 1 && this.get("traded_count") == 0 && this.get("status") == "PENDING"){
            console.log("[machine.js] one of an order of arbitrage was canceled. so cancel the other")
            this.orders.map(async o => {
              if (o.get("orderId") != order.get("orderId"))
                await o.cancel()
            })
          }
          resolve()
        }
      })
    })
  },  
  accomplish: function(order) {
    return new Promise(resolve => {
      console.log("  accomplish() called! id:", this.id)
      console.log("  args:order.get(machineIds):", order.get("machineIds"))
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
          console.log("[machine.js] Arbitrage saved with the changed:", changed)
          console.log(this.attributes)
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
    presentation: function(orderbook){
      const maxBidPrice = orderbook.bid[0].price

      let profit_krw_sum = 0,
        total_traded = 0,
        coin_sum = 0,
        krw_damage = 0,
        profit_rate_each_craving = [0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0],
        profit_rate_each_craving2,
        traded_count_each_craving = [0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0],
        traded_count_each_craving2

      this.each(m => {
        profit_krw_sum += m.get("profit_krw")
        total_traded += m.get("traded_count")
        coin_sum += m.get("status") == "COIN" ? m.get("capacity") : 0
        if (m.get("status") == "PENDING" && m.get("mind").type == "ASK")
          coin_sum += m.get("capacity")

        krw_damage += m.get("status") == "COIN" ?
          (m.get("last_traded_price") - maxBidPrice) * m.get("capacity") : 0

        const pIndex = m.get("craving_krw")/1000 - 1  //
        profit_rate_each_craving[pIndex] += m.get("profit_rate")
        // profit_rate_each_craving[pIndex] -= m.get("status") == "COIN" ? m.get("last_traded_price") - maxBidPrice : 0

        traded_count_each_craving[pIndex] += m.get("traded_count")
      })

      profit_rate_each_craving = profit_rate_each_craving.map(el => (el/3000).toFixed(0)*1) // 3000 machines each craving
      profit_rate_each_craving2 = profit_rate_each_craving.splice(10, 10) // 11,000 ~ 20,000
      traded_count_each_craving2 = traded_count_each_craving.splice(10, 10) // 11,000 ~ 20,000

      console.log("-- machines presentation ----")
      console.log("Rabbit made \u20A9", new Intl.NumberFormat().format(profit_krw_sum),
        ":", new Intl.NumberFormat().format((profit_krw_sum/((new Date() - global.rabbit.STARTED)/ 86400000)).toFixed(0)), "per day; ",
        "damage:", new Intl.NumberFormat().format(krw_damage),
        "so \u20A9", new Intl.NumberFormat().format(profit_krw_sum - krw_damage),
        ":", new Intl.NumberFormat().format(((profit_krw_sum - krw_damage)/((new Date() - global.rabbit.STARTED)/ 86400000)).toFixed(0)), "per day")
      console.log("Total Traded:", new Intl.NumberFormat().format(total_traded),
        ", Bought Coin:", coin_sum.toFixed(2))
      console.log("profit_rate_each_craving ~1:", JSON.stringify(profit_rate_each_craving))
      console.log("profit_rate_each_craving ~2:", JSON.stringify(profit_rate_each_craving2))
      console.log("traded_count_each_craving ~1:", JSON.stringify(traded_count_each_craving))
      console.log("traded_count_each_craving ~2:", JSON.stringify(traded_count_each_craving2))
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
            // machines.each(function(m) {
            //     console.log(m.attributes.id);
            //     console.log(m.attributes.craving_krw);
            //     console.log(m.attributes.negativeHope);
            //     console.log(m.attributes.positiveHope);
            // });
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
      const korbit = options.korbit,
        coinone = options.coinone

      let highBidMarket, lowAskMarket
      if (coinone.orderbook.bid[0].price >= korbit.orderbook.bid[0].price){
        // if (coinoneBalance.eth.available > MIN_ETH)
        highBidMarket = coinone
      }else {
        highBidMarket = korbit
      }
      if (coinone.orderbook.ask[0].price <= korbit.orderbook.ask[0].price){
        lowAskMarket = coinone
      }else {
        lowAskMarket = korbit
      }
      const bestOrderbook = {
        bid: highBidMarket.orderbook.bid,
        ask: lowAskMarket.orderbook.ask
      }
      console.log("high bid market:", highBidMarket.name, " low ask market:", lowAskMarket.name)



      // Make decision which orderbook to use
      const minAskPrice = bestOrderbook.ask[0].price,
          maxBidPrice = bestOrderbook.bid[0].price

      console.log("[machine.js] maxBid:", maxBidPrice, " minAsk:", minAskPrice)


      ///// Mind
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
      totalBid = totalBid.toFixed(2) * 1
      totalAsk = totalAsk.toFixed(2) * 1

      ///// Validate and Make a result
      let result  // will return this result
      if (totalAsk == 0 && totalBid == 0)
        return []
      if (bestOrderbook.bid[0].price <= bestOrderbook.ask[0].price){  // internal trade recommended
        // Validate the balance
        if (totalBid > totalAsk){
          if ((totalBid - totalAsk) * bestOrderbook.ask[0].price < lowAskMarket.balance.krw.available - 10000){
            console.log("[machine.js] I have money to buy coin at", lowAskMarket.name )
          }else{
            console.log("[machine.js] Not enough money at", lowAskMarket.name, "hurry up!!!!!")
            return []
          }
        }else{
          if (totalAsk - totalBid < highBidMarket.balance.eth.available - 1.0){ // 1.0 is buffer for fee
            console.log("[machine.js] I have coin to ask at", highBidMarket.name)
          }else{
            console.log("[machine.js] Not enough coin at", highBidMarket.name, "hurry up!!!!!")
            return []
          }
        }
        // Make result as one so that can be internal trade
        result = [{
          marketName: (totalBid > totalAsk) ? lowAskMarket.name : highBidMarket.name,
          coinType: this.at(0).get("coinType"),
          bidQuantity: totalBid,
          askQuantity: totalAsk,
          bidPrice: bestOrderbook.ask[0].price,  // Buy at minAskPrice
          askPrice: bestOrderbook.bid[0].price,
          participants: bidParticipants.concat(askParticipants),
          machineIds: bidMachineIds.concat(askMachineIds)
        }]
      } else {  // Don't make internal trade in this case.
        // Validate the balances
        if (totalBid * bestOrderbook.ask[0].price < lowAskMarket.balance.krw.available - 10000){
          console.log("[machine.js] Enough money at", lowAskMarket.name)
        }else {
          console.log("[machine.js] Put money at", lowAskMarket.name, "hurry up!!!!!!")
          totalBid = 0, bidMachineIds = [], bidParticipants = []
        }
        if (totalAsk < highBidMarket.balance.eth.available - 1.0){
          console.log("[machine.js] Enough Ethereum at", highBidMarket.name)
        }else {
          console.log("[machine.js] Put Ethereum at", highBidMarket.name, "hurry up!!!!!!")
          totalAsk = 0, askMachineIds = [], askParticipants = []
        }
        // Make two result to make order seprarately
        result = [{
          marketName: lowAskMarket.name,
          coinType: this.at(0).get("coinType"),
          bidQuantity: totalBid,
          askQuantity: 0,
          bidPrice: bestOrderbook.ask[0].price,  // Buy at minAskPrice
          // askPrice: bestOrderbook.bid[0].price,
          participants: bidParticipants,
          machineIds: bidMachineIds
        }, {
          marketName: highBidMarket.name,
          coinType: this.at(0).get("coinType"),
          bidQuantity: 0,
          askQuantity: totalAsk,
          // bidPrice: bestOrderbook.ask[0].price,  // Buy at minAskPrice
          askPrice: bestOrderbook.bid[0].price,
          participants: askParticipants,
          machineIds: askMachineIds
        }]
      }
      
      console.log("[machine.js] machines.mind() takes", ((new Date() - startTime) / 1000).toFixed(2), "sec")
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
      console.log("event", a.get("a"), a.get("status"))
      switch (a.get("status")) {
        case "COMPLETED":
        case "CANCELED":
        // case "FAILED":
          console.log("The arbitrage will be removed from the arbitrages. remain in db")
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
          console.log("Arbitrage Profit: \u20A9", new Intl.NumberFormat().format(profit_sum),
            ":", new Intl.NumberFormat().format((profit_sum/((new Date() - global.rabbit.ARBITRAGE_STARTED)/ 86400000)).toFixed(0)), "per day")
          console.log("quantity_sum:", new Intl.NumberFormat().format(quantity_sum))
          resolve()
        }
      })
    })
  },
  // Make new arbitrage machine!
  mind: function(options) {
    if (this.length > 2){
      console.log("[machine.js] arbitrages have more than 2. so just pass")
      return []
    }
    console.log("arbitrages.length:", this.length)

    const coinone = options.coinone,
      korbit = options.korbit

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
    quantity = (lowMarket.orderbook.ask[0].qty < highMarket.orderbook.bid[0].qty) ?
      lowMarket.orderbook.ask[0].qty : highMarket.orderbook.bid[0].qty
    quantity = quantity - 0.01  // Kind of flooring
    quantity = (quantity > 1.0) ? 1.0 : quantity  // Litmit
    quantity = quantity.toFixed(2) * 1
    // quantity = 0.02 // for test

    if (profitRate < 900 || quantity < 0.01){
      console.log("Pass arbitrage. profitRate:", profitRate, "quantity:", quantity)
      return []
    }

    console.log(" 💴  IT'S GOLDEN TIME 💴  quantity:", quantity, "profitRate:", profitRate)
    console.log(lowMarket.name, ":buy at", lowMarket.orderbook.ask[0].price,)
    console.log(highMarket.name, ":ask at", highMarket.orderbook.bid[0].price)

    // Validate balance
    if (lowMarket.balance.krw.available - 10000 < lowMarket.orderbook.ask[0].price * quantity){
      console.log("[machine.js] Not enough krw at", lowMarket.name)
      const newQunatity = (lowMarket.balance.krw.available / lowMarket.orderbook.ask[0].price - 0.01).toFixed(2) * 1
      if (newQunatity > 0.01){
        console.log("[machine.js] So just place order less quantity:", newQunatity)
        quantity = newQunatity
      } else {
        console.log("[machine.js] Real don't have krw at", lowMarket.name, "GIVE ME THE MONEY!!")
        return []
      }
    }
    if (highMarket.balance.eth.available - 1.0 < quantity){
      console.log("[machine.js] Not enough eth", highMarket.name)
      const newQunatity = (highMarket.balance.eth.available - 0.01).toFixed(2) * 1
      if (newQunatity > 0.01){
        console.log("[machine.js] So go less", newQunatity)
        quantity = newQunatity
      }else{
        console.log("[mahine.js] Real don't have eth at", highMarket.name, "GIVE ME THE MONEY!")
        return []
      }
    }

    console.log("Well. It looks like real money. Make new arbitrage")

    // New arbitrage only here
    const newArbitrage = new exports.Arbitrage({
      coinType: "ETH",
      lowMarketName: lowMarket.name,
      highMarketName: highMarket.name,
      // just for log below
      profit_krw: quantity * profitRate,
      quantity: quantity,
      profitRate: profitRate,
      bidPrice: lowMarket.orderbook.ask[0].price,
      askPrice: highMarket.orderbook.bid[0].price
    })

    this.push(newArbitrage)

    return [{
        marketName: lowMarket.name,
        coinType: "ETH",
        bidQuantity: quantity,
        askQuantity: 0,
        bidPrice: lowMarket.orderbook.ask[0].price, // Buy at minAskPrice
        // askPrice: maxBidPrice,
        participants: [newArbitrage],
        machineIds: [newArbitrage.id + ""]  // attached "" to avoid ObjectId("asoweugbalskug")
      },
      {
        marketName: highMarket.name,
        coinType: "ETH",
        bidQuantity: 0,
        askQuantity: quantity,
        // bidPrice: minAskPrice,
        askPrice: highMarket.orderbook.bid[0].price, // Ask at maxBidPrice
        participants: [newArbitrage],
        machineIds: [newArbitrage.id + ""] // attached "" to avoid ObjectId("asoweugbalskug")
      }
    ]
  }, // end of .mind()
  mind_test: function(){
    const newArbitrage = new exports.Arbitrage({
      coinType: "ETH",
    })
    return {
      machineIds: [newArbitrage.id + ""]
    }
  }
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
