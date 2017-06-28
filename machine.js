"use strict"

const Backbone = require('backbone'),
    backsync = require('backsync'),
    _ = require('underscore');

// ONLY CASE: KRW WITH SEED MONEY!
let Machine = Backbone.Model.extend({
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
        status: "KRW", // "KRW" or "COIN"
        coinType: "",  // "ETH" or "BTC"
        marketName: "",  // "COINONE" etcs..

        // profit_btc: 0,
        profit_krw: 0,
        profit_rate: 0, //	profit_krw/capacity
        traded_count: 0,
        last_traded_price: 0
    },
    initialize: function() {
      if (!this.id)
        this.set({
          id: require('mongodb').ObjectID(),
          created_at: new Date()
        })
    },
    // Set new mind! won't deal with databases
    mind: function(options) {
      if (this.get("status") == "PENDING")
        return {
          type: "pending"
        }

      options = options || {}
      let mind //  will be new mind of this machine

      switch (this.get("name")) {
        case "SCATTERER": // These machines scatter every prices
          if (this.get("status") == "KRW") {
            if (options.minAskPrice == this.get("buy_at"))
              mind = {
                type: "bid",
                thePrice: options.minAskPrice
              }
          } else if (this.get("status") == "COIN") {
            if (options.maxBidPrice >= this.get("craving_krw") + this.get("last_traded_price"))
              mind = {
                type: "ask",
                thePrice: options.maxBidPrice
              }
          }
          break
      }

      mind.at = new Date()
      this.set({
        mind: mind
      });
      return mind;
    },
    mind_old: function(attr, options) {
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
    },
    // new_trade: async function(){  // This is a async function cuz of usin database
    // },
    trade: function(resolve, reject) { // machine always trade completly with its mind..
        let mind = this.get("mind");

        let changed = {
            traded_count: this.get("traded_count") + 1,
            last_traded_price: mind.thePrice,
            last_traded_at: new Date()
        };
        if (mind.type == "ask") {
            changed.status = "KRW";
            changed.profit_krw =
                this.get("profit_krw") + (mind.thePrice - this.get("last_traded_price")) * this.get('capacity'); // there is no float in this line
            // changed.profit_rate = changed.profit_krw / this.get('capacity');
            changed.profit_rate = this.get('profit_rate') + (mind.thePrice - this.get("last_traded_price"));
        } else if (mind.type == "bid") {
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
});

let Machines = Backbone.Collection.extend({
    url: "mongodb://localhost:27017/rabbit/machines",
    sync: backsync.mongodb(),
    model: exports.Machine,
    presentation: function(attrs) {
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
    // fetalAll_new: async function(){
    // },
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
      let orderBook = options.orderBook

      let participants = []
      let totalBid = 0,
        totalAsk = 0,
        internalTradedUnits = 0

      // console.log(orderBook)
      // console.log("minAsk:", orderBook.ask[0])
      // console.log("maxBid:", orderBook.bid[0])
      this.each(function(m) {
        let mind = m.mind({
          minAskPrice: orderBook.ask[0],
          maxBidPrice: orderBook.bid[0]
        })
        if (mind.type == "bid")
          totalBid += m.get('capacity')
        else if (mind.type == "ask")
          totalAsk += m.get('capacity')
      })

      if (totalBid > totalAsk)
        internalTradedUnits = totalAsk
      else if (totalBid < totalAsk)
        internalTradedUnits = totalBid
      else if (totalBid == totalAsk)
        internalTradedUnits = totalBid

      let result = {
        totalBid: totalBid,
        totalAsk: totalAsk,
        internalTradedUnits: internalTradedUnits,
        participants: participants
      }

      console.log("[machine.js] machines.mind() takes", ((new Date() - startTime) / 1000).toFixed(2), "sec")
      return result
    },
    mind_old: function(options) {
        let startTime = new Date();

        let hope = options.hope,
            minAskPrice = options.minAskPrice,
            maxBidPrice = options.maxBidPrice,
            success = options.success;
        let index = 0, totalBid = 0, totalAsk = 0;
        let participants = []; // array of participants
        const that = this;

        function one(index) {
            if (that.length > index) {
                let m = that.at(index);

                m.mind({
                    hope: hope,
                    minAskPrice: minAskPrice,
                    maxBidPrice: maxBidPrice
                }, {
                    success: () => {
                        // maybe machine's status is `pending` or something else
                        if (_.contains(['COIN', 'KRW'], m.get('status'))) {
                            switch (m.get('mind').type) {
                                case "bid":
                                    participants.push(m);
                                    totalBid += m.get('capacity') * 1;
                                    break;
                                case "ask":
                                    participants.push(m);
                                    totalAsk += m.get('capacity') * 1;
                                    break;
                                default:
                                    // does not participate this tic()
                            }
                        }
                        one(index + 1);
                    }
                });
            } else {
                console.log("[machine.js] machines.mind() takes", ((new Date() - startTime) / 1000).toFixed(2), "sec");
                // if(totalBid > 0 && totalAsk > 0){
                //     // Internal trading! Yeah!
                //     let internalTradedUnits = (totalBid > totalAsk)? totalAsk:totalBid;
                //     _.each();
                // }
                success({
                    total: that.length || 0,
                    totalBid: totalBid.toFixed(3) * 1,
                    totalAsk: totalAsk.toFixed(3) * 1,
                    participants: participants // just Array, not Machines
                });
                return;
            }
        }
        one(0);
    },
    makeRealPlayer: function(attr) {
        attr = attr || {};
        let btc_krw_b = attr.btc_krw_b,
            hope = attr.hope;

        // let SEED_BTC_AMOUNT = 10; // 10 btc
        let that = this;
        let goodMachines = this.filter(function(m) {
            // if (m.get('status') != "KRW") {
            // return false;
            // } else {
            // return (m.get('profit_rate') >= 1000) ? true : false;
            // }
            return (m.get('profit_rate') >= 1000) ? true : false;
        });
        console.log("[machine.js] goodMachines.length: ", goodMachines.length);

        let rank = _.sortBy(goodMachines, function(m) {
            let profit_rate = m.get('profit_rate');
            if(m.get('status') == 'COIN')
                profit_rate = profit_rate - (m.get('last_traded_price') - btc_krw_b);
            return -profit_rate;
        });

        let totalCapacity = 0;
        function one(index) {
            if (rank.length <= index) {
                console.log("[machine.js] New machines are created. End index:", index);
                return;
            }

            // 33.116 btc
            let c = 0.004;
            if (index < 63) {
                c = 0.256;
            } else if (index < 210) {
                c = 0.064;
            } else if (index < 467) {  // 20 % of 2334 machines
                c = 0.016;
            }
            // rank[index].save({
            //     capacity: c
            // }, {
            //     success: function() {
            //         one(index + 1);
            //     }
            // });
            let setting = {
              kind: "REAL"
            };
            if (_.contains(rank[index].get('propensity'), "DECRAVING_KRW_BID")) {
                setting = {
                    capacity: c,
                    propensity: ["DECRAVING_KRW_BID", "CRAVING_KRW_ASK"],
                    neverHope: -50000,
                    craving_krw: rank[index].get('craving_krw'),
                    decraving_krw: rank[index].get('decraving_krw')
                };
            } else if (_.contains(rank[index].get('propensity'), "NEGATIVE_HOPE_BID")) {
                setting = {
                    capacity: c,
                    propensity: ["NEGATIVE_HOPE_BID", "CRAVING_KRW_ASK"],
                    neverHope: rank[index].get('neverHope'),
                    negativeHope: rank[index].get('negativeHope'),
                    craving_krw: rank[index].get('craving_krw')
                };
            } else if (_.contains(rank[index].get('propensity'), "CRAVING_KRW_AND_NEGATIVE_HOPE_ASK")) {
                setting = {
                    capacity: c,
                    propensity: ["NEGATIVE_HOPE_BID", "CRAVING_KRW_AND_NEGATIVE_HOPE_ASK"],
                    neverHope: rank[index].get('neverHope'),
                    negativeHope: rank[index].get('negativeHope'),
                    craving_krw: rank[index].get('craving_krw')
                };
            } else if (_.contains(rank[index].get('propensity'), "DYNAMIC_DECRAVING_KRW_BY_TIME_BID")) {
                setting = {
                    capacity: c,
                    propensity: ["DYNAMIC_DECRAVING_KRW_BY_TIME_BID", "DYNAMIC_CRAVING_KRW_BY_TIME_ASK"],
                    neverHope: rank[index].get('nerverHope')
                };
            } else if (_.contains(rank[index].get('propensity'), "POSITIVE_HOPE_ASK")) {
                setting = {
                    capacity: c,
                    propensity: ["NEGATIVE_HOPE_BID", "POSITIVE_HOPE_ASK"],
                    neverHope: rank[index].get('neverHope'),
                    negativeHope: rank[index].get('negativeHope'),
                    craving_krw: rank[index].get('craving_krw'),
                    positiveHope: rank[index].get('positiveHope')
                };
            } else if(_.contains(rank[index].get('propensity'),  "BTC_KRW_RATE_OF_24H_AND_HOPE_BID")){
                setting = {
                    capacity: c,
                    propensity: rank[index].get('propensity'),
                    negativeHope: rank[index].get('negativeHope'),
                    positiveHope: rank[index].get('positiveHope'),
                    craving_krw: rank[index].get('craving_krw'),
                    negativeRate: rank[index].get('negativeRate'),
                    positiveRate: rank[index].get('positiveRate')
                };
            // } else if(_.contains(rank[index].get('propensity'), "BTC_KRW_BID")) {
            //     setting = {
            //         capacity: c,
            //         propensity: ["BTC_KRW_BID", "CRAVING_KRW_ASK"],
            //         btc_krw_bid: ,
            //         craving_krw: rank[index].get('craving_krw')
            //     };
            } else {
                one(index + 1);
                return;
            }
            let newMachine = new exports.Machine();
            newMachine.save(setting, {
                success: function() {
                    totalCapacity += c;
                    that.add(newMachine);
                    one(index + 1);
                }
            });
        }
        one(0);
        console.log("[machine.js] New REAL type machines have ", totalCapacity, "capacity");
        // console.log(rank.length);
        // console.log(rank[0].attributes);
    }
});


exports.Machine = Machine;
exports.Machines = Machines;

// exports.BithumbBtcMachine = Machine.extend({
// });
// exports.BithumbBtcMachines = Machines.extend({
// });
//
// exports.CoinOneEthMachine = Machine.extend({
// });
// exports.CoinOneEthMachines = Machines.extend({
// });
