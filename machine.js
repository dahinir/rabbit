"use strict"

const Backbone = require('backbone'),
    backsync = require('backsync'),
    _ = require('underscore');

// ONLY CASE: KRW WITH SEED MONEY!
exports.Machine = Backbone.Model.extend({
    urlRoot: "mongodb://localhost:27017/rabbit/machines",
    sync: backsync.mongodb(),
    idAttribute: "id", // cuz of Backsync
    defaults: {
        // propensity: [], // sell immediately when craving_krw
        // craving_krw: 2000, // 2,000 won!
        // cravingRatio: 0.5, // means 50%
        capacity: 0.001, // min btc 0.001
        // negativeHope: -5000,
        // positiveHope: -3000,
        // neverHope: -10000,
        // maxHope: 0,
        status: "krw", // "krw" or "btc"

        // profit_btc: 0,
        profit_krw: 0,
        profit_rate: 0, //	profit_krw/capacity
        traded_count: 0,
        last_traded_btc_krw: 0
    },
    initialize: function() {
        if (!this.id) {
            this.set({
                id: require('mongodb').ObjectID(),
                createdAt: new Date()
            });
        }
    },
    mind: function(attr, options) {
        const success = options.success;

        let hope = attr.hope * 1,
            btc_krw;

        if (this.get("status") == "krw") {
            btc_krw = attr.btc_krw * 1;
        } else if (this.get("status") == "btc") {
            btc_krw = attr.btc_krw_b * 1;
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
            btc_krw: btc_krw,
            at: new Date()
        };

        if (this.get("traded_count") > 0) {
            if (this.get("status") == "krw") {
                if (_.contains(propensity, "DECRAVING_KRW_BID")) {
                    if (btc_krw <= this.get("last_traded_btc_krw") - this.get("decraving_krw")) {
                        mind.type = "bid";
                    }
                }
                if (_.contains(propensity, "NEGATIVE_HOPE_BID")) {
                    if (hope <= negativeHope) {
                        mind.type = "bid";
                    }
                }
                if (_.contains(propensity, "BTC_KRW_BID")) {
                    if (btc_krw == this.get("btc_krw_bid")) { // Exactly same only!
                        mind.type = "bid";
                    }
                }
                if (_.contains(propensity, "DYNAMIC_DECRAVING_KRW_BY_TIME_BID")) {
                    // lastTradedAt - now
                    let old = new Date() - this.get("lastTradedAt");

                    if (old < 1000 * 60 * 5) {
                        if (btc_krw <= this.get("last_traded_btc_krw") - 1000)
                            mind.type = "bid";
                    } else if (old < 1000 * 60 * 20) {
                        if (btc_krw <= this.get("last_traded_btc_krw") - 2000)
                            mind.type = "bid";
                    } else if (old < 1000 * 60 * 30) {
                        if (btc_krw <= this.get("last_traded_btc_krw") - 3000)
                            mind.type = "bid";
                    } else if (old < 1000 * 60 * 60 * 2) {
                        if (btc_krw <= this.get("last_traded_btc_krw") - 10000)
                            mind.type = "bid";
                    } else if (old < 1000 * 60 * 60 * 24) {
                        if (btc_krw <= this.get("last_traded_btc_krw") - 30000)
                            mind.type = "bid";
                    } else if (old < 1000 * 60 * 60 * 24 * 14) {
                        if (btc_krw <= this.get("last_traded_btc_krw") - 40000)
                            mind.type = "bid";
                    } else {
                        if (btc_krw <= this.get("last_traded_btc_krw") - 1000)
                            mind.type = "bid";
                    }
                }
                if (_.contains(propensity, "DYNAMIC_CRAVINGRATIO_BY_HOPE_BID")) {
                    // if (hope <= negativeHope) {
                    //     mind.type = "bid";
                    // }
                }
            } else if (this.get("status") == "btc") {
                if (_.contains(propensity, "CRAVING_KRW_ASK")) {
                    if (btc_krw >= this.get("last_traded_btc_krw") + this.get("craving_krw")) {
                        mind.type = "ask";
                    }
                }
                if (_.contains(propensity, "CRAVING_KRW_AND_NEGATIVE_HOPE_ASK")) {
                    if (btc_krw >= this.get("last_traded_btc_krw") + this.get("craving_krw")) {
                        if (hope > this.get('negativeHope')) // at least..
                            mind.type = "ask";
                    }
                }
                if (_.contains(propensity, "POSITIVE_HOPE_ASK")) {
                    if (btc_krw >= this.get("last_traded_btc_krw") + this.get("craving_krw")) {
                        if (hope >= this.get('positiveHope'))
                            mind.type = "ask";
                    }
                }
                if (_.contains(propensity, "DYNAMIC_CRAVING_KRW_BY_TIME_ASK")) {
                    // lastTradedAt - now
                    let old = new Date() - this.get("lastTradedAt");

                    if (old < 1000 * 60 * 5) {
                        // 5 mins
                        if (btc_krw >= this.get("last_traded_btc_krw") + 1000)
                            mind.type = "ask";
                    } else if (old < 1000 * 60 * 60 * 2) {
                        //  2 hours
                        if (btc_krw >= this.get("last_traded_btc_krw") + 2000)
                            mind.type = "ask";
                    } else if (old < 1000 * 60 * 60 * 5) {
                        // 5 hours
                        if (btc_krw >= this.get("last_traded_btc_krw") + 3000)
                            mind.type = "ask";
                    } else if (old < 1000 * 60 * 60 * 24) {
                        if (btc_krw >= this.get("last_traded_btc_krw") + 10000)
                            mind.type = "ask";
                    } else if (old < 1000 * 60 * 60 * 24 * 30) {
                        if (btc_krw >= this.get("last_traded_btc_krw") + 30000)
                            mind.type = "ask";
                    } else if (old < 1000 * 60 * 60 * 24 * 30 * 6) {
                        if (btc_krw >= this.get("last_traded_btc_krw") + 50000)
                            mind.type = "ask";
                    } else {
                        if (btc_krw >= this.get("last_traded_btc_krw") + 20000)
                            mind.type = "ask";
                    }
                }
            }
        } else if (this.get("traded_count") == 0) {
            if (this.get("status") == "krw") {
                if (_.isNumber(this.get("neverHope"))) {
                    if (hope < this.get("neverHope"))
                        mind.type = "bid";
                }
                if (_.isNumber(this.get('maxHope')) ){
                    if(hope > this.get('maxHope'))
                        mind.type = "bid";
                }
                if (_.contains(propensity, "BTC_KRW_BID")) {
                    if (btc_krw == this.get("btc_krw_bid"))
                        mind.type = "bid";
                }
            }
        }

        this.set({
            mind: mind
        });
        // To avoid RangeError: Maximum call stack size exceeded
        process.nextTick(success);

    },
    trade: function(resolve, reject) { // machine always trade completly with its mind..
        let mind = this.get("mind");

        let changed = {
            traded_count: this.get("traded_count") + 1,
            last_traded_btc_krw: mind.btc_krw,
            lastTradedAt: new Date()
        };
        if (mind.type == "ask") {
            changed.status = "krw";
            changed.profit_krw =
                this.get("profit_krw") + (mind.btc_krw - this.get("last_traded_btc_krw")) * this.get('capacity'); // there is no float in this line
            // changed.profit_rate = changed.profit_krw / this.get('capacity');
            changed.profit_rate = this.get('profit_rate') + (mind.btc_krw - this.get("last_traded_btc_krw"));
        } else if (mind.type == "bid") {
            changed.status = "btc";
        }
        // console.log("[machines.js] changed:", changed);
        // this.set(changed);
        this.save(changed, {
            success: function() {
                resolve && resolve();
            }
        });
    }
});

exports.Machines = Backbone.Collection.extend({
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
            if (m.get("status") == "krw") {
                if (_.contains(m.get("propensity"), "BTC_KRW_BID"))
                    wanna_btc_for_netting += m.get("capacity");
                else
                    wanna_buy_btc += m.get("capacity");
            } else if (m.get("status") == "btc") {
                if (_.contains(m.get("propensity"), "BTC_KRW_BID"))
                    bought_btc_for_netting += m.get("capacity");
                else
                    bought_btc += m.get("capacity");

                if (m.get('last_traded_btc_krw') * 1 > 0)
                    estimated_damage += (m.get('last_traded_btc_krw') - btc_krw_b) * m.get('capacity');
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
                        console.log("[machines.fetchAll()]", machines.length, "machines are loaded");
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
        // console.log("[machine.js] mind.. don\'t interrupt me");
        let startTime = new Date();

        let hope = options.hope,
            btc_krw = options.btc_krw,
            btc_krw_b = options.btc_krw_b,
            success = options.success;
        let index = 0,
            totalBid = 0,
            totalAsk = 0;
        let participants = []; // array of participants
        const that = this;

        function one(index) {
            if (that.length > index) {
                let m = that.at(index);
                m.mind({
                    hope: hope,
                    btc_krw: btc_krw,
                    btc_krw_b: btc_krw_b
                }, {
                    success: () => {
                        // maybe machine's status is `pending` or something else
                        if (_.contains(['btc', 'krw'], m.get('status'))) {
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
            // if (m.get('status') != "krw") {
            // return false;
            // } else {
            // return (m.get('profit_rate') >= 1000) ? true : false;
            // }
            return (m.get('profit_rate') >= 1000) ? true : false;
        });

        // let totalCapacity = 0;
        // _.each(goodMachines, function(m){
        //     totalCapacity += m.get('capacity');
        // });
        // if( totalCapacity > 20 ){
        //
        // }

        let rank = _.sortBy(goodMachines, function(m) {
            let profit_rate = m.get('profit_rate');
            if(m.get('status') == 'btc')
                profit_rate = profit_rate - (m.get('last_traded_btc_krw') - btc_krw_b);
            return -profit_rate;
        });

        function one(index) {
            if (rank.length <= index) {
                console.log("[machine.js] Capcity chaged successfully. End index:", index);
                return;
            }

            // 37.116 btc
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
            // } else if(_.contains(rank[index].get('propensity'), "BTC_KRW_BID")) {
            //     setting = {
            //         capacity: c,
            //         propensity: ["BTC_KRW_BID", "CRAVING_KRW_ASK"],
            //         btc_krw_bid: ,
            //         craving_krw: rank[index].get('craving_krw')
            //     };
            } else {
                one(index + 1);
            }
            let newMachine = new exports.Machine();
            newMachine.save(setting, {
                success: function() {
                    that.add(newMachine);
                    one(index + 1);
                }
            });
        }
        one(0);
        // console.log(rank.length);
        // console.log(rank[0].attributes);
    }
});
