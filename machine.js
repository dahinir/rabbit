"use strict"

const	Backbone = require('backbone');

// ONLY CASE: KRW WITH SEED MONEY!
exports.Machine = Backbone.Model.extend({
	defaults: {
		propensity: "STATIC",	// means static capacity. "GREEDY"
		craving_krw: 2000,	// 2,000 won!
		cravingRatio: 0.5,	// means 50%
		capacity: 0.001,	// min btc 0.001
		negativeHope: -5000,
		positiveHope: -3000,
		neverHope: -10000,
		maxHope: 0,
		status: "krw",	// "krw" or "btc"

		// balance_btc: 0,
		// balance_krw: 0,

		// profit_btc: 0,
		profit_krw: 0,
		traded_count: 0,
		traded_btc_krw: 0
	},
	initialize: function(){
		// this.set({status: this.get("balance_krw")>0?"krw":"btc"});
		// this.set({
		// 	balance_btc: this.get("seed_btc"),
		// 	balance_krw: this.get("seed_krw"),
		// 	status: this.get("seed_krw")
		// });
		// if(this.get("seed_btc") == 0)
		// 	this.set({seed_btc: this.get("seed_krw")/1000000});
	},
	mind: function(attr){
		var hope = attr.hope*1,
				btc_krw = attr.btc_krw*1;
		var negativeHope = this.get('negativeHope'),
				positiveHope = this.get('positiveHope');

		var mind = { type: "none",
								btc_krw: btc_krw,
								units: this.get("capacity").toString()};

		if( this.get("traded_count") > 0 ){
			if( this.get("status")=="krw" ){
				if( hope < negativeHope){
					if( btc_krw < this.get("traded_btc_krw")-this.get("craving_krw")*this.get("cravingRatio")){
						mind.type =  "bid";
					}
				}
			}else if( this.get("status")=="btc"){
				if( hope > positiveHope){
					if( btc_krw > this.get("traded_btc_krw")+this.get("craving_krw") ){
						mind.type = "ask";
					}
				}
			}
		}else	if( this.get("traded_count") == 0 ){
			if( hope < this.get("neverHope") && this.get("status")=="krw")
				mind.type =  "bid";
			if( hope > this.get("maxHope") && this.get("status")=="btc")
				mind.type = "ask";
		}

		this.set({mind: mind});
		return mind;
	},
	trade: function(){	// machine always trade with its mind..
		var mind = this.get("mind");

		var changed = {
			//  balance_btc: this.get("balance_btc")+units,
			//  balance_krw: this.get("balance_krw")-units*btc_krw,
			 traded_count: this.get("traded_count")+1,
			 traded_btc_krw: mind.btc_krw,
			 status: "btc"
		}
		if(mind.type == "ask"){
			changed.status = "krw";
			changed.profit_krw =
				this.get("profit_krw") + (mind.btc_krw - this.get("traded_btc_krw"))* mind.units;
		}
		this.set(changed);
	}
});

exports.Machines = Backbone.Collection.extend({
  model: exports.Machine
});
