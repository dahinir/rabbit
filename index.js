"use strict"


// var fs = require('fs'),
// 		request = require('request');

const _ = require('underscore'),
		Backbone = require('backbone');

const Bithumb = require('./bithumb_modified.js');
const KEYS = require('./credentials/keys.json');

var ticNumber = 0;

// const API_KEY = require("./credential/keys"),
// 	SECRET_KEY = "d";
var xcoinAPI = new Bithumb(KEYS.BITHUMB.API_KEY, KEYS.BITHUMB.SECRET_KEY);

var CoinBaseClient = require('coinbase').Client;
var coinBaseClient = new CoinBaseClient({apiKey: KEYS.BITHUMB.API_KEY, apiSecret: KEYS.BITHUMB.SECRET_KEY});

function getBtc_usd(resolve, reject){
	coinBaseClient.getBuyPrice({'currencyPair': 'BTC-USD'}, function(err, price) {
		var btc_usd = price.data.amount*1;
		// console.log("bit_usd:", btc_usd);
		if( _.isNumber(btc_usd) && btc_usd<2500 && btc_usd>500)
			resolve(btc_usd);
	});
}
function getUsd_krw(resolve, reject){
	coinBaseClient.getExchangeRates({'currency': 'USD'}, function(err, rates) {
		// var usd_krw = rates.data.rates.KRW*1.014903;	// buy cash
		var usd_krw = rates.data.rates.KRW*1.0075;	// send money
		// console.log("usd_krw:", usd_krw);
		if( _.isNumber(usd_krw) && usd_krw<20000 && usd_krw>500)
			resolve(usd_krw);
	});
}
function getBtc_krw(resolve, reject){
	xcoinAPI.xcoinApiCall('/public/orderbook', {}, function(result){
		var btc_krw = result.data.asks[0].price*1;
		// console.log("btc_krw:", btc_krw);
		if( _.isNumber(btc_krw) && btc_krw<2000000 && btc_krw>800000)
			resolve(btc_krw);
	});
}

// tic()
var minHope = [Infinity, 0], maxHope = [-Infinity, 0],
		minBtc_krw = [0, Infinity],	maxBtc_krw = [0, -Infinity];
// ONLY CASE: KRW WITH SEED MONEY!
var Machine = Backbone.Model.extend({
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
var Machines = Backbone.Collection.extend({
  model: Machine
});
// var m = new Machine({capacity:0.01});
// m.trade();
// console.log(m.attributes);
// return;


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
var Order = Backbone.Model.extend({
	idAttribute: "order_id",
	defaults: {
		isDone: false,
		internalTradedUnits: 0,
		// dealedUnits: 0,	// dealed with bithumb. not store. calculate everytime
		adjustedUnits: 0	// adjusted with machines
	},
	initialize: function(attributes, options){
		this.done = false;	// if done this order
	},
	// var newOrder = new Order({machines: participants,
	// 							btParams: btParams,
	// 							internalTradedUnits: internalTradedUnits});
	adjust: function(){
		if(this.get("isDone"))
			return;
		var machines = this.get("machines"),
				adjustedUnits = this.get("adjustedUnits"),
				internalTradedUnits = this.get("internalTradedUnits"),
				data = this.get("data"),	// bithumb results
				type = this.get("btParams").type;

		var totalDuty = internalTradedUnits*2 + this.get("btParams").units;

		var dealedUnits = 0;	// dealed with bithumb
		_.each(this.get("data"), function(cont){
			dealedUnits = dealedUnits + (cont.units || cont.units_traded)*1;
		});

		var pendingMachines = new Machines();
		while(machines.length > 0){
			var m = machines.pop();
			if((internalTradedUnits*2+dealedUnits-adjustedUnits)
																							>= m.get("capacity")){
					m.trade();
					this.set({
						adjustedUnits: adjustedUnits+m.get("capacity")});
			}else{
				// penging machines..
				m.set("status", "pending");
				pendingMachines.push(m);
			}
		}
		this.set({machines: pendingMachines});
		if(pendingMachines.length==0){
			this.set({isDone: true});
			// order is done. destroy this
		}
	}	// adjust
});	// Order
var Orders = Backbone.Collection.extend({
  model: Order,
});

// propensity: "STATIC",	// means static capacity. "GREEDY"
// craving_krw: 2000,	// 2,000 won!
// cravingRatio: 0.5,	// means 50%
// capacity: 0.001,	// min btc 0.001
// negativeHope: -5000,
// positiveHope: -3000,
// neverHope: -10000,
// maxHope: 0,
// status: "krw"
var machines = new Machines([
												{	propensity: "STATIC",
													craving_krw: 2000,
													cravingRatio: 0.5,
													capacity: 0.001,	// btc
													negativeHope: -2000,
													positiveHope: 0,
													neverHope: -2000,
													maxHope: 0,
													status: "krw"},

												{	propensity: "STATIC",
													craving_krw: 2000,
													cravingRatio: 0.5,
													capacity: 0.001,	// btc
													negativeHope: -3000,
													positiveHope: -1000,
													neverHope: -3000,
													maxHope: -1000,
													status: "krw"},

												{	propensity: "STATIC",
													craving_krw: 2000,
													cravingRatio: 0.5,
													capacity: 0.001,	// btc
													negativeHope: -4000,
													positiveHope: -2000,
													neverHope: -4000,
													maxHope: -2000,
													status: "krw"},

												{	propensity: "STATIC",
													craving_krw: 2000,
													cravingRatio: 0.5,
													capacity: 0.001,	// btc
													negativeHope: -5000,
													positiveHope: -3000,
													neverHope: -5000,
													maxHope: -3000,
													status: "krw"},

												{	propensity: "STATIC",
													craving_krw: 20000,
													cravingRatio: 0.5,
													capacity: 1.0,	// btc
													negativeHope: -5000,
													positiveHope: -3000,
													neverHope: -10000,
													maxHope: 0,
													status: "krw"},
												{	propensity: "STATIC",
													craving_krw: 30000,
													cravingRatio: 0.5,
													capacity: 1.0,	// btc
													negativeHope: -5000,
													positiveHope: -3000,
													neverHope: -10000,
													maxHope: 0,
													status: "krw"}
												]);
var orders = new Orders();
var fee_krw, fee_btc = 0;
var startTime = new Date();
function tic(error, response, rgResult){
	var nowTime = new Date();
	console.log("=====", ++ticNumber, "== (", ((nowTime-startTime)/1000/60/60).toFixed(2), "hr", startTime.toLocaleString(), ") ====", new Date(), "==");

	Promise.all([new Promise(getBtc_usd),
			new Promise(getUsd_krw),
			new Promise(getBtc_krw)]).then(function (values) {
		// console.log("all clear", values);
		var btc_usd = values[0],
			usd_krw = values[1],
			btc_krw = values[2];
		var hope = btc_krw - btc_usd*usd_krw;
		if (minHope[0] > hope){
			minHope = [hope.toFixed(2), btc_krw];
		}
		if (maxHope[0] < hope){
			maxHope = [hope.toFixed(2), btc_krw];
		}
		if (minBtc_krw[1] > btc_krw)
			minBtc_krw = [hope.toFixed(2), btc_krw];
		if (maxBtc_krw[1] < btc_krw)
			maxBtc_krw = [hope.toFixed(2), btc_krw];
		// console.log("btc_usd*usd_krw:", btc_usd*usd_krw);
		console.log("hope\t\tmin:", minHope, "\tmax:", maxHope);
		console.log("btc_krw\t\tmin:", minBtc_krw, "\tmax:", maxBtc_krw);
		console.log("now\t\t", [hope, btc_krw]);

		/*
					var params = {
						order_id: "1485052731599",	// "1485011389177",
						type: "bid"
					};
					xcoinAPI.xcoinApiCall("/info/order_detail", params, function(result){
						console.log(result);
						{ status: '5600', message: '거래 체결내역이 존재하지 않습니다.' }
						or
						{ status: '0000',
						  data:
						   [ { cont_no: '1445825',
						       transaction_date: '1485011389000',
						       type: 'bid',
						       order_currency: 'BTC',
						       payment_currency: 'KRW',
						       units_traded: '0.001',
						       price: '1096000',
						       fee: '0.0000015',
						       total: '1096' } ] }
					});
					return;
		*/


		// var params = {
		// 	units: "0.001",
		// 	type: "bid",
		// 	price: btc_krw.toString()
		// };
		// var params = machine.mind({hope:hope, btc_krw:btc_krw});
		var totalBid =0, totalAsk = 0;
		var participants = new Machines();
		machines.each(function(m){
			var mind = m.mind({hope:hope, btc_krw:btc_krw});
			switch (mind.type) {
				case "bid":
					participants.push(m);
					totalBid = totalBid + mind.units*1;
					break;
				case "ask":
					participants.push(m);
					totalAsk = totalAsk + mind.units*1;
					break;
				default:
					// console.log("asdf");
			}
		});

		var internalTradedUnits=0, btParams={};
		if(totalBid > totalAsk){
			internalTradedUnits = totalAsk;
			btParams = {type: "bid",
									units: (totalBid-totalAsk).toString() }
		}else if(totalBid < totalAsk){
			internalTradedUnits = totalBid;
			btParams = {type: "ask",
									units: (totalAsk-totalBid).toString() }
		}else if(totalBid == totalAsk){
			internalTradedUnits = totalBid;
			btParams = {type: "none"};
		}
		// now `btParams` is completed..
		if(participants.length > 0){
			console.log("participants.length", participants.length);
			var newOrder = new Order({machines: participants,
										btParams: btParams,
										internalTradedUnits: internalTradedUnits});
			orders.push(newOrder);
			// console.log(btParams, totalBid, totalAsk, btc_krw);
			if( btParams.type=="ask" || btParams.type=="bid"){
				btParams.price = btc_krw.toString();
				// console.log(btParams);
				// return;
				xcoinAPI.xcoinApiCall('/trade/place', btParams, function(result){
					newOrder.set(result);
					newOrder.adjust();

					refreshOrdersChainAt(0);
					machines.each(function(m){
						console.log("traded_count:", m.get("traded_count"),
											" profit_krw:", m.get("profit_krw"),
											" capacity:", m.get("capacity"),
											" craving_krw:", m.get("craving_krw"),
											" negativeHope:", m.get("negativeHope"),
											" positiveHope:", m.get("positiveHope"));
					});
				});
			}else if( btParams.type=="none" && internalTradedUnits>0){
				newOrder.adjust();
			}
		}

		function refreshOrdersFromBithumb(){
			// for pending orders..
			orders.each(function(o){
				// console.log(o.attributes);
				if( o.get("isDone") || !o.get("order_id"))
					return;
				var params = {
					order_id: o.get("order_id").toString(), //"1485052731599",	// "1485011389177",
					type: o.get("btParams").type
				};
				xcoinAPI.xcoinApiCall("/info/order_detail", params, function(result){
					o.set(result);
					o.adjust();
				});
			});
		}

		function refreshOrdersChainAt(index){
			index = index || 0;
			if(orders.length <= index){
				return;
			}
			o = orders.at(index);
			if( o.get("isDone") || !o.get("order_id"))
				return;
			var params = {
				order_id: o.get("order_id").toString(), //"1485052731599",	// "1485011389177",
				type: o.get("btParams").type
			};
			xcoinAPI.xcoinApiCall("/info/order_detail", params, function(result){
				o.set(result);
				o.adjust();
				refreshOrdersChainAt(index+1);
			});
		}


		// time to break
		setTimeout(tic, new Date()%58000 + 2000);	// 1 min
	}).catch(function(err){
		console.log("something happened in the promise", err);
		// but I'm going anyway
		setTimeout(tic, new Date()%58000 + 2000);	// 1 min
	});
}	// end of tic()



if(require.main === module) {
	console.log("tic.", new Date());
	tic();
}
