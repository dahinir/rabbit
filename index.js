"use strict"

// var fs = require('fs'),
// 		request = require('request');

const _ = require('underscore'),
		Backbone = require('backbone');

const xcoinAPI = require('./bithumb_modified.js');
const fetcher = require('./fetcher.js');

const Machine = require('./machine.js').Machine;
const Machines = require('./machine.js').Machines;
const Order = require('./order.js').Order;
const Orders = require('./order.js').Orders;


// tic()
var ticNumber = 0;
var minHope = [Infinity, 0], maxHope = [-Infinity, 0],
		minBtc_krw = [0, Infinity],	maxBtc_krw = [0, -Infinity];

var machines = new Machines();
// fetch from db
machines.fetch({data: {
												//  $skip: 10,
												//  $limit: 10
											},
							success: function(){
								console.log(machines.at(0));
							},
						  error: function(){
								console.log("fetch from db error");
							}});
var newMachines = new Machines(require('./newMachines.json'));
// add new machines by newMachines.json
newMachines.each(function(m){
	// m.save();
});
var orders = new Orders();
var fee_krw, fee_btc = 0;
var startTime = new Date();
function tic(error, response, rgResult){
	var nowTime = new Date();
	console.log("\n=====", ++ticNumber, "== (", ((nowTime-startTime)/1000/60/60).toFixed(2), "hr", startTime.toLocaleString(), ") ====", new Date(), "==");

	Promise.all([new Promise(fetcher.getBtc_usd),
			new Promise(fetcher.getUsd_krw),
			new Promise(fetcher.getBtc_krw)]).then(function (values) {

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
		console.log("hope\t\tmin:", minHope, "\tmax:", maxHope);
		console.log("btc_krw\t\tmin:", minBtc_krw, "\tmax:", maxBtc_krw);
		console.log("now\t\t", [hope, btc_krw]);

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
			console.log("participants.length:", participants.length);
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

		function refreshOrdersChainAt(index){
			index = index || 0;
			if(orders.length <= index){
				return;
			}
			var o = orders.at(index);
			if( o.get("isDone") || !o.get("order_id"))
				return;
			var params = {
				order_id: o.get("order_id").toString(), //"1485052731599",	// "1485011389177",
				type: o.get("btParams").type
			};
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
			xcoinAPI.xcoinApiCall("/info/order_detail", params, function(result){
				o.set(result);
				o.adjust();
				refreshOrdersChainAt(index+1);
			});
		}	// refreshOrdersChainAt()


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
