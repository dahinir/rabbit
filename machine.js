"use strict"

const Backbone = require('backbone'),
    backsync = require('backsync'),
    _ = require('underscore');

// ONLY CASE: KRW WITH SEED MONEY!
exports.Machine = Backbone.Model.extend({
    urlRoot: "mongodb://localhost:27017/rabbit/machines",
    sync: backsync.mongodb(),
    idAttribute: "id",  // cuz of Backsync
    defaults: {
        propensity: "hot", // sell immediately when craving_krw
        craving_krw: 2000, // 2,000 won!
        cravingRatio: 0.5, // means 50%
        capacity: 0.001, // min btc 0.001
        negativeHope: -5000,
        positiveHope: -3000,
        neverHope: -10000,
        maxHope: 0,
        status: "krw", // "krw" or "btc"

        // balance_btc: 0,
        // balance_krw: 0,

        // profit_btc: 0,
        profit_krw: 0,
        profit_rate: 0, //	profit_krw/capacity
        traded_count: 0,
        last_traded_btc_krw: 0
    },
    initialize: function() {
        if(!this.id){
          this.set({
            id: require('mongodb').ObjectID()
          });
        }
        // this.set({status: this.get("balance_krw")>0?"krw":"btc"});
        // this.set({
        // 	balance_btc: this.get("seed_btc"),
        // 	balance_krw: this.get("seed_krw"),
        // 	status: this.get("seed_krw")
        // });
        // if(this.get("seed_btc") == 0)
        // 	this.set({seed_btc: this.get("seed_krw")/1000000});
    },
    mind: function(attr, options) {
        const success = options.success;
        if (this.get("status") == "pending") {
            success();
            return;
        }

        let hope = attr.hope * 1,
            btc_krw = attr.btc_krw * 1,
            btc_krw_b = attr.btc_krw_b * 1;

        let negativeHope = this.get('negativeHope'),
            positiveHope = this.get('positiveHope');

        let mind = {
            type: "none",
            btc_krw: btc_krw,
            units: this.get("capacity").toFixed(3)
        };

        if (this.get("traded_count") > 0) {
            if (this.get("status") == "krw") {
                if (hope < negativeHope || this.get("propensity") == "hot") {
                    if (btc_krw < this.get("last_traded_btc_krw") - this.get("craving_krw") * this.get("cravingRatio")) {
                        mind.type = "bid";
                    }
                }
            } else if (this.get("status") == "btc") {
                if (hope > positiveHope || this.get("propensity") == "hot") {
                    if (btc_krw_b >= this.get("last_traded_btc_krw") + this.get("craving_krw")) {
                        mind.type = "ask";
                        mind.btc_krw = btc_krw_b;
                    }
                }
            }
        } else if (this.get("traded_count") == 0) {
            if (hope < this.get("neverHope") && this.get("status") == "krw"){
                mind.type = "bid";
            }else if (hope > this.get("maxHope") && this.get("status") == "btc"){
                mind.type = "ask";
                mind.btc_krw = btc_krw_b;
            }
        }

        this.save({
            mind: mind
        }, {
            success: function() {
                success();
            }
        });
        // return mind;
    },
    trade: function(resolve, reject) { // machine always trade completly with its mind..
        let mind = this.get("mind");

        let changed = {
            //  balance_btc: this.get("balance_btc")+units,
            //  balance_krw: this.get("balance_krw")-units*btc_krw,
            traded_count: this.get("traded_count") + 1,
            last_traded_btc_krw: mind.btc_krw,
            status: "btc"
        }
        if (mind.type == "ask") {
            changed.status = "krw";
            changed.profit_krw =
                this.get("profit_krw") + (mind.btc_krw - this.get("last_traded_btc_krw")) * mind.units;
            changed.profit_rate = changed.profit_krw / this.get('capacity');
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
    presentation: function() {
        let profit_krw_sum = 0,
            profit_rate_sum = 0,
            wanna_buy_btc = 0,
            wanna_sell_btc = 0,
            pending_btc = 0,
            total_traded = 0;
        this.each(function(m) {
            profit_krw_sum += m.get("profit_krw");
            profit_rate_sum += m.get("profit_rate");
            total_traded += m.get('traded_count');
            if (m.get("status") == "krw") {
                wanna_buy_btc += m.get("capacity");
            } else if (m.get("status") == "btc") {
                wanna_sell_btc += m.get("capacity");
            } else {
                pending_btc += m.get("capacity");
            }
        });
        return {
            machines: this.length,
            total_traded: total_traded,
            profit_krw_sum: profit_krw_sum,
            average_profit_krw: profit_krw_sum / this.length,
            average_profit_rate: profit_rate_sum / this.length,
            wanna_buy_btc: parseFloat(wanna_buy_btc).toPrecision(8),
            wanna_sell_btc: parseFloat(wanna_sell_btc).toPrecision(8),
            pending_btc: pending_btc,
            so: "how about dat?"
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
        console.log("[machine.js] mind.. don\'t interrupt me");
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
                console.log("[machine.js] mind takes", ((new Date() - startTime) / 1000).toFixed(2), "sec" );
                success({
                    total: that.length || 0,
                    totalBid: totalBid.toFixed(3)*1,
                    totalAsk: totalAsk.toFixed(3)*1,
                    participants: participants  // just Array, not Machines
                });
                return;
            }
        }
        one(0);
    }
});
