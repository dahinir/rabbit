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
    // Set new mind in runtime instance! won't deal with databases
    mind: function(options) {
      if (this.get("status") == "PENDING")
        return {
          type: "PENDING"
        }

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
/*    mind_old: function(attr, options) {
        const success = options.success;

        let hope = attr.hope * 1,
            thePrice,
            btc_krw_rate_of_24h = attr.btc_krw_rate_of_24h * 1;

        if (this.get("status") == "KRW") {
            thePrice = attr.minAskPrice * 1;
        } else if (this.get("status" == "COIN")) {
            thePrice = attr.maxBidPrice * 1;
        } else {
            // `status` maybe `pending`
            success();
            return;
        }

        let negativeHope = this.get('negativeHope'),
            positiveHope = this.get('positiveHope'),
            propensity = this.get('propensity'); // it's an Array

        let mind = {
            type: "none",
            thePrice: thePrice,
            at: new Date()
        };

        if (this.get("traded_count") > 0) {
            if (this.get("status") == "KRW") {
                if (_.contains(propensity, "DECRAVING_KRW_BID")) {
                    if (thePrice <= this.get("last_traded_price") - this.get("decraving_krw")) {
                        mind.type = "bid";
                    }
                }
                if (_.contains(propensity, "NEGATIVE_HOPE_BID")) {
                    if (hope <= negativeHope) {
                        mind.type = "bid";
                    }
                }
                if (_.contains(propensity, "BTC_KRW_BID")) {
                    if (thePrice == this.get("btc_krw_bid")) { // Exactly same only!
                        if(hope < 50000)  // at least..
                            mind.type = "bid";
                    }
                }
                if (_.contains(propensity, "DYNAMIC_DECRAVING_KRW_BY_TIME_BID")) {
                    // lastTradedAt - now
                    let old = new Date() - this.get("lastTradedAt");

                    if (old < 1000 * 60 * 5) {
                        if (thePrice <= this.get("last_traded_price") - 1000)
                            mind.type = "bid";
                    } else if (old < 1000 * 60 * 20) {
                        if (thePrice <= this.get("last_traded_price") - 2000)
                            mind.type = "bid";
                    } else if (old < 1000 * 60 * 30) {
                        if (thePrice <= this.get("last_traded_price") - 3000)
                            mind.type = "bid";
                    } else if (old < 1000 * 60 * 60 * 2) {
                        if (thePrice <= this.get("last_traded_price") - 10000)
                            mind.type = "bid";
                    } else if (old < 1000 * 60 * 60 * 24) {
                        if (thePrice <= this.get("last_traded_price") - 30000)
                            mind.type = "bid";
                    } else if (old < 1000 * 60 * 60 * 24 * 14) {
                        if (thePrice <= this.get("last_traded_price") - 40000)
                            mind.type = "bid";
                    } else {
                        if (thePrice <= this.get("last_traded_price") - 1000)
                            mind.type = "bid";
                    }
                }
                if (_.contains(propensity, "DYNAMIC_CRAVINGRATIO_BY_HOPE_BID")) {
                    // if (hope <= negativeHope) {
                    //     mind.type = "bid";
                    // }
                }
            } else if (this.get("status") == "COIN") {
                if (_.contains(propensity, "CRAVING_KRW_ASK")) {
                    if (thePrice >= this.get("last_traded_price") + this.get("craving_krw")) {
                        mind.type = "ask";
                    }
                }
                if (_.contains(propensity, "CRAVING_KRW_AND_NEGATIVE_HOPE_ASK")) {
                    if (thePrice >= this.get("last_traded_price") + this.get("craving_krw")) {
                        if (hope > this.get('negativeHope')) // at least..
                            mind.type = "ask";
                    }
                }
                if (_.contains(propensity, "POSITIVE_HOPE_ASK")) {
                    if (thePrice >= this.get("last_traded_price") + this.get("craving_krw")) {
                        if (hope >= this.get('positiveHope'))
                            mind.type = "ask";
                    }
                }
                if (_.contains(propensity, "DYNAMIC_CRAVING_KRW_BY_TIME_ASK")) {
                    // lastTradedAt - now
                    let old = new Date() - this.get("lastTradedAt");

                    if (old < 1000 * 60 * 5) {
                        // 5 mins
                        if (thePrice >= this.get("last_traded_price") + 1000)
                            mind.type = "ask";
                    } else if (old < 1000 * 60 * 60 * 2) {
                        //  2 hours
                        if (thePrice >= this.get("last_traded_price") + 2000)
                            mind.type = "ask";
                    } else if (old < 1000 * 60 * 60 * 5) {
                        // 5 hours
                        if (thePrice >= this.get("last_traded_price") + 3000)
                            mind.type = "ask";
                    } else if (old < 1000 * 60 * 60 * 24) {
                        if (thePrice >= this.get("last_traded_price") + 10000)
                            mind.type = "ask";
                    } else if (old < 1000 * 60 * 60 * 24 * 30) {
                        if (thePrice >= this.get("last_traded_price") + 30000)
                            mind.type = "ask";
                    } else if (old < 1000 * 60 * 60 * 24 * 30 * 6) {
                        if (thePrice >= this.get("last_traded_price") + 50000)
                            mind.type = "ask";
                    } else {
                        if (thePrice >= this.get("last_traded_price") + 20000)
                            mind.type = "ask";
                    }
                }
            }
        } else if (this.get("traded_count") == 0) {
            if (this.get("status") == "KRW") {
                if (_.isNumber(this.get("neverHope"))) {
                    if (hope < this.get("neverHope"))
                        mind.type = "bid";
                }
                if (_.isNumber(this.get('maxHope')) ){
                    if(hope > this.get('maxHope'))
                        mind.type = "bid";
                }
                if (_.contains(propensity, "BTC_KRW_BID")) {
                    if (thePrice == this.get("btc_krw_bid"))
                        mind.type = "bid";
                }
            }
        }

        if (_.contains(propensity, "BTC_KRW_RATE_OF_24H_AND_HOPE_BID")) {
            if (this.get("status") == "KRW") {
                if(btc_krw_rate_of_24h < this.get("negativeRate"))
                    if(hope < this.get("negativeHope"))
                        mind.type = "bid";
            }else if(this.get("status") == "COIN"){
                if(btc_krw_rate_of_24h > this.get("positiveRate"))
                    if(hope > this.get("positiveHope"))
                        if (thePrice >= this.get("last_traded_price") + 2000)
                            mind.type = "ask";
            }
        }

        this.set({
            mind: mind
        });
        // To avoid RangeError: Maximum call stack size exceeded
        process.nextTick(success);  // call `success` as next tick!
    },*/
    // The order is submitted
    pend: function(){
      return new Promise(resolve => {
        this.save({
          status: "PENDING"
        }, {
          success: function(){
            // console.log("[machine.js] pending successfully. id:", this.id)
            resolve()
          }
        })
      })
    },
    // YES
    accomplish: function(order) {
      return new Promise(resolve => {
        const tradedPrice = order.get("price")
        const changed = {
            traded_count: this.get("traded_count") + 1,
            last_traded_price: tradedPrice,
            last_traded_at: new Date(),
            mind: {}  // Empty your mind
          }

        if (this.get("mind").type == "ASK"){
          _.extend(changed, {
            status: "KRW",
            profit_krw: this.get("profit_krw") + (tradedPrice - this.get("last_traded_price")) * this.get("capacity"),
            profit_rate: this.get("profit_rate") + (tradedPrice - this.get("last_traded_price"))
          })

          // GO BIGGIE
          if (this.get("craving_krw") == 6000)
            changed.capacity = 0.02
          else if (this.get("craving_krw") == 7000)
            changed.capacity = 0.02
          else if (this.get("craving_krw") == 8000)
            changed.capacity = 0.04
          else if (this.get("craving_krw") == 9000)
            changed.capacity = 0.02
          else if (this.get("craving_krw") == 10000)
            changed.capacity = 0.02
        }else if (this.get("mind").type == "BID"){
          changed.status = "COIN"
        }

        // console.log("[machine.js] save with changed:", changed)
        // console.log(this.attributes)
        this.save(changed, {
          success: function(){
            resolve()
          }
        })
      })
    },
    // depressed
    trade_old: function(resolve, reject) { // machine always trade completly with its mind..
        let mind = this.get("mind");

        let changed = {
            traded_count: this.get("traded_count") + 1,
            last_traded_price: mind.thePrice,
            last_traded_at: new Date()
        };
        if (mind.type == "ASK") {
            changed.status = "KRW";
            changed.profit_krw =
                this.get("profit_krw") + (mind.thePrice - this.get("last_traded_price")) * this.get('capacity'); // there is no float in this line
            // changed.profit_rate = changed.profit_krw / this.get('capacity');
            changed.profit_rate = this.get('profit_rate') + (mind.thePrice - this.get("last_traded_price"));
        } else if (mind.type == "BID") {
            changed.status = "COIN";
        }
        // console.log("[machines.js] changed:", changed);
        // this.set(changed);
        this.save(changed, {
            success: function() {
                resolve && process.nextTick(resolve);
            }
        });
    }
})

exports.Arbitrage = exports.Machine.extend({
  urlRoot: "mongodb://localhost:27017/rabbit/arbitrages",
  sync: backsync.mongodb(),
  idAttribute: "id", // cuz of Backsync
  defaults: {
    coinType: "ETH", // "ETH" or "BTC"
    profit_krw: 0,
    traded_count: 0
  },
  initialize: function(attributes, options) {
    if (!this.id)
      this.set({
        id: require('mongodb').ObjectID(),
        created_at: new Date()
      })
  },
  mind: function(options) {
    console.log("[machine.js] Don't ask Arbitrage's mind")
  },
  accomplish: function(order) {
    return new Promise(resolve => {
      console.log("Arbitrage accomplish()")

      const changed = {
          traded_count: this.get("traded_count") + 1,
          last_traded_at: new Date()
        }

      if (changed.traded_count >= 2){
        changed.status = "DONE"
      }

      this.save(changed, {
        success: function(){
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
    presentation: function(){
      let profit_krw_sum = 0,
        total_traded = 0,
        coin_sum = 0

      this.each(m => {
        profit_krw_sum += m.get("profit_krw")
        total_traded += m.get("traded_count")
        coin_sum += (m.get("status")=="COIN")? m.get("capacity"):0
        if (m.get("status") == "PENDING" && m.get("mind").type == "ASK")
          coin_sum += m.get("capacity")
      })

      console.log("Profit: \u20A9 " + new Intl.NumberFormat().format(profit_krw_sum),
        "(" + (profit_krw_sum/((new Date() - global.rabbit.STARTED)/ 86400000)).toFixed(0) + " per day)",
        ", Bought Coin:", coin_sum.toFixed(2))
      console.log("Total Traded:", new Intl.NumberFormat().format(total_traded))
    },
    presentation_old: function(attrs) {
        attrs = attrs || {};
        let btc_krw_b = attrs.btc_krw_b,
            btc_krw = attrs.btc_krw;

        let profit_krw_sum = 0,
            profit_rate_sum = 0,
            total_traded = 0,
            estimated_damage = 0,
            wanna_buy_btc = 0,
            bought_btc = 0,
            pending_btc = 0,
            wanna_btc_for_netting = 0,
            bought_btc_for_netting = 0,
            profit_krw_sum_for_netting = 0;


        this.each(function(m) {
            if (_.contains(m.get("propensity"), "BTC_KRW_BID"))
                profit_krw_sum_for_netting += m.get("profit_krw");
            else
                profit_krw_sum += m.get("profit_krw");
            profit_rate_sum += m.get("profit_rate");
            total_traded += m.get('traded_count');
            if (m.get("status") == "KRW") {
                if (_.contains(m.get("propensity"), "BTC_KRW_BID"))
                    wanna_btc_for_netting += m.get("capacity");
                else
                    wanna_buy_btc += m.get("capacity");
            } else if (m.get("status") == "COIN") {
                if (_.contains(m.get("propensity"), "BTC_KRW_BID"))
                    bought_btc_for_netting += m.get("capacity");
                else
                    bought_btc += m.get("capacity");

                if (m.get('last_traded_price') * 1 > 0)
                    estimated_damage += (m.get('last_traded_price') - btc_krw_b) * m.get('capacity');
            } else {
                pending_btc += m.get("capacity");
            }
        });
        return {
            so: this.length + " machines work",
            total_traded: new Intl.NumberFormat().format(total_traded),
            profit_krw_sum: "\u20A9 " + new Intl.NumberFormat().format(profit_krw_sum),
            profit_krw_sum_for_netting: "\u20A9 " + new Intl.NumberFormat().format(profit_krw_sum_for_netting),
            total_profit_krw: "\u20A9 " + new Intl.NumberFormat().format(profit_krw_sum+ profit_krw_sum_for_netting),
            estimated_damage: "\u20A9 " + new Intl.NumberFormat().format(estimated_damage),
            estimated_profit_krw: "\u20A9 " + new Intl.NumberFormat().format(profit_krw_sum+ profit_krw_sum_for_netting - estimated_damage),
            // average_profit_krw: profit_krw_sum / this.length,
            // average_profit_rate: profit_rate_sum / this.length,
            need_krw: "\u20A9 " + new Intl.NumberFormat().format(wanna_buy_btc * btc_krw),
            bought_btc: bought_btc.toFixed(3),
            need_krw_for_netting: "\u20A9 " + new Intl.NumberFormat().format(wanna_btc_for_netting*btc_krw),
            bought_btc_for_netting: bought_btc_for_netting.toFixed(3),
            pending_btc: pending_btc
        };
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
      let startTime = new Date()
      let minAskPrice = options.orderbook.ask[0].price * 1,
          maxBidPrice = options.orderbook.bid[0].price * 1

      console.log("[machine.js] maxBid:", maxBidPrice, " minAsk:", minAskPrice, )

      let participants = [],
        machineIds = [],
        totalBid = 0,
        totalAsk = 0,
        internalTradedUnits = 0

      this.each(function(m) {
        let mind = m.mind({
          minAskPrice: minAskPrice,
          maxBidPrice: maxBidPrice
        })
        if (mind.type == "BID"){
          totalBid += m.get('capacity')
          participants.push(m)
          machineIds.push(m.id)
          // DONT USE `_.pluck(options.participants, "id")` It will push ObjectID("adf0oqh3t")
        }else if (mind.type == "ASK"){
          totalAsk += m.get('capacity')
          participants.push(m)
          machineIds.push(m.id)
        }
      })

      let result = {
        marketName: this.at(0).get("marketName"),
        coinType: this.at(0).get("coinType"),
        bidQuantity: totalBid.toFixed(2) * 1,
        askQuantity: totalAsk.toFixed(2) * 1,
        // bidPrice: minAskPrice - 50,  // Buy at minAskPrice, -50 for to be a maker not taker
        // askPrice: maxBidPrice + 50,
        bidPrice: minAskPrice,  // Buy at minAskPrice
        askPrice: maxBidPrice,
        participants: participants,
        machineIds: machineIds
      }

      console.log("[machine.js] machines.mind() takes", ((new Date() - startTime) / 1000).toFixed(2), "sec")
      return result
    }
});

exports.Arbitrages = exports.Machines.extend({
  url: "mongodb://localhost:27017/rabbit/arbitrages",
  sync: backsync.mongodb(),
  model: exports.Arbitrage,
  presentation: function(){
    return new Promise(resolve => {
      const doneArbitrages  = new exports.Arbitrages()
      doneArbitrages.fetch({
        data: {
          status: "DONE"
        },
        success: function(){
          let profit_sum = 0,
            quantity_sum = 0
          doneArbitrages.each(m =>{
            profit_sum += m.get("profitRate") * m.get("quantity")
            quantity_sum += m.get("quantity")
          })
          console.log("Arbitrage Profit: \u20A9 " + new Intl.NumberFormat().format(profit_sum),
            "(" + (profit_sum/((new Date() - global.rabbit.STARTED)/ 86400000)).toFixed(0) + " per day)")
          console.log("quantity_sum:", new Intl.NumberFormat().format(quantity_sum))
          resolve()
        }
      })
    })
  },
  // Make new arbitrage machine!
  mind: function(options) {
    const coinoneEthOrderbook = options.coinoneEthOrderbook,
      korbitEthOrderbook = options.korbitEthOrderbook

    const coinoneBestBid = options.coinoneEthOrderbook.bid[0].price,
      coinoneBestAsk = options.coinoneEthOrderbook.ask[0].price,
      korbitBestBid = options.korbitEthOrderbook.bid[0].price,
      korbitBestAsk = options.korbitEthOrderbook.ask[0].price

    const korbit2coinone = coinoneBestBid - korbitBestAsk,
      coinone2korbit = korbitBestBid - coinoneBestAsk

    const profitRate = (korbit2coinone > coinone2korbit) ? korbit2coinone : coinone2korbit
    // console.log(coinoneBestBid, coinoneBestAsk, korbitBestBid, korbitBestAsk)
    // console.log("==Arbitrage==== korbit to coinone:", korbit2coinone, ", coinone to korbit:", coinone2korbit)


    // console.log("BAM!!", profitRate)
    let lowMarketName,  // "KORBIT" or "COINONE"
      highMarketName,
      lowMarketEthOrderbook,
      highMarketEthOrderbook,
      quantity = 0
    if (korbit2coinone > coinone2korbit){
      lowMarketEthOrderbook = korbitEthOrderbook
      highMarketEthOrderbook = coinoneEthOrderbook
      lowMarketName = "KORBIT"
      highMarketName = "COINONE"

    } else if (korbit2coinone < coinone2korbit) {
      lowMarketEthOrderbook = coinoneEthOrderbook
      highMarketEthOrderbook = korbitEthOrderbook
      lowMarketName = "COINONE"
      highMarketName = "KORBIT"
    }
    quantity = (lowMarketEthOrderbook.ask[0].qty < highMarketEthOrderbook.bid[0].qty) ?
      lowMarketEthOrderbook.ask[0].qty : highMarketEthOrderbook.bid[0].qty
    quantity = quantity - 0.01  // Kind of flooring
    quantity = (quantity > 1.0) ? 1.0 : quantity  // Litmit
    quantity = quantity.toFixed(2) * 1
    quantity = 0.01 // for test

    // if (profitRate < 800 || quantity < 0.01){
    if (false){
      console.log("[machine.js] Pass arbitrage. profitRate:", profitRate, "quantity:", quantity)
      return []
    }

    console.log("[machine.js] Arbitrage! quantity:", quantity, "profitRate:", profitRate)
    console.log(lowMarketName, ":buy at", lowMarketEthOrderbook.ask[0].price,)
    console.log(highMarketName, ":ask at", highMarketEthOrderbook.bid[0].price)

    const newMachine = new exports.Arbitrage({
      coinType: "ETH",
      lowMarketName: lowMarketName,
      highMarketName: highMarketName,
      quantity: quantity, // just for log
      profitRate: profitRate  // just for log
    })

    this.push(newMachine)

    return [{
        marketName: lowMarketName,
        coinType: "ETH",
        bidQuantity: quantity,
        askQuantity: 0,
        bidPrice: lowMarketEthOrderbook.ask[0].price -50000, // Buy at minAskPrice
        // askPrice: maxBidPrice,
        participants: [newMachine],
        machineIds: [newMachine.id]
      },
      {
        marketName: highMarketName,
        coinType: "ETH",
        bidQuantity: 0,
        askQuantity: quantity,
        // bidPrice: minAskPrice,
        askPrice: highMarketEthOrderbook.bid[0].price +100000, // Ask at maxBidPrice
        participants: [newMachine],
        machineIds: [newMachine.id]
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
