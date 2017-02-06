"use strict"

const _ = require('underscore'),
    Backbone = require('backbone'),
    pify = require('pify');

const xcoinAPI = require('./bithumb_modified.js');
const fetcher = require('./fetcher.js');

const Machine = require('./machine.js').Machine;
const Machines = require('./machine.js').Machines;
const Order = require('./order.js').Order;
const Orders = require('./order.js').Orders;

// tic()
let ticNumber = 0,
    minHope = [Infinity, 0],
    maxHope = [-Infinity, 0],
    minBtc_krw = [0, Infinity],
    maxBtc_krw = [0, -Infinity],
    fee_krw = 0,
    fee_btc = 0,
    startTime = new Date();;

let machines = new Machines();
// fetch from db
machines.fetchAll({
    success: function() {
        tic();
    }
});
let orders = new Orders();
orders.fetch({
    data: {
        isDone: false
        // $skip: 10,
        // $limit: 10
    },
    success: function() {
        console.log("[index.js] ", orders.length, "orders are loaded.");
        orders.each(function(o) {
            console.log("[index.js] ", o.id, "order will load their", o.get('machineIds'), " machines");
            o.set({
                machines: new Machine()
            });
            _.each(o.get('machineIds'), function(machineId) {
                o.get('machines').push(machines.get(machineId));
            });
        });
    }
});

function tic(error, response, rgResult) {
    if (ticNumber != 0) {
        console.log(machines.presentation());
        // console.log(machines.at(0) && machines.at(0).attributes);
    }

    let nowTime = new Date();
    console.log("\n=====", ++ticNumber, "== (", ((nowTime - startTime) / 1000 / 60 / 60).toFixed(2), "hr", startTime.toLocaleString(), ") ====", new Date(), "==");

    Promise.all([new Promise(fetcher.getBtc_usd),
        new Promise(fetcher.getUsd_krw),
        new Promise(fetcher.getBtc_krw)
    ]).then(function(values) {

        let btc_usd = values[0],
            usd_krw = values[1],
            btc_krw = values[2];
        let hope = btc_krw - btc_usd * usd_krw;
        if (minHope[0] > hope) {
            minHope = [hope.toFixed(2), btc_krw];
        }
        if (maxHope[0] < hope) {
            maxHope = [hope.toFixed(2), btc_krw];
        }
        if (minBtc_krw[1] > btc_krw)
            minBtc_krw = [hope.toFixed(2), btc_krw];
        if (maxBtc_krw[1] < btc_krw)
            maxBtc_krw = [hope.toFixed(2), btc_krw];
        console.log("hope\t\tmin:", minHope, "\tmax:", maxHope);
        console.log("btc_krw\t\tmin:", minBtc_krw, "\tmax:", maxBtc_krw);
        console.log("now\t hope:", hope.toFixed(2), "\tbtc_krw:", btc_krw, "\tbtc_usd:", btc_usd, "\tusd_krw:", usd_krw);

        machines.mind({
            hope: hope,
            btc_krw: btc_krw,
            success: result => {
                let totalBid = result.totalBid,
                    totalAsk = result.totalAsk;

                let participants = new Machines(result.participants);

                let internalTradedUnits = 0,
                    btParams = {};

                if (totalBid > totalAsk) {
                    internalTradedUnits = totalAsk;
                    btParams = {
                        type: "bid",
                        units: (totalBid - totalAsk).toString()
                    }
                } else if (totalBid < totalAsk) {
                    internalTradedUnits = totalBid;
                    btParams = {
                        type: "ask",
                        units: (totalAsk - totalBid).toString()
                    }
                } else if (totalBid == totalAsk) {
                    internalTradedUnits = totalBid;
                    btParams = {
                        type: "none"
                    };
                }
                if (participants.length > 0) {
                    // now `btParams` is completed..
                    btParams.price = btc_krw.toString();
                    console.log("[index.js] participants.length:", participants.length);
                    let newOrder = new Order({
                        machines: participants,
                        machineIds: participants.pluck('id'),
                        btParams: btParams,
                        internalTradedUnits: internalTradedUnits
                    });
                    console.log("[index.js] new order: ", newOrder.attributes);
                    newOrder.save();
                    orders.push(newOrder);
                    // console.log(btParams, totalBid, totalAsk, btc_krw);
                    if (btParams.type == "ask" || btParams.type == "bid") {
                        xcoinAPI.xcoinApiCall('/trade/place', btParams, function(result) {
                            console.log(result);
                            newOrder.set(result);
                            newOrder.adjust(function() {
                                refreshOrdersChainAt(0);
                            });
                            // machines.each(function(m) {
                            //     console.log("traded_count:", m.get("traded_count"),
                            //         " profit_krw:", m.get("profit_krw"),
                            //         " capacity:", m.get("capacity"),
                            //         " craving_krw:", m.get("craving_krw"),
                            //         " negativeHope:", m.get("negativeHope"),
                            //         " positiveHope:", m.get("positiveHope"));
                            // });
                        });
                    } else if (btParams.type == "none" && internalTradedUnits > 0) {
                        newOrder.adjust(function() {
                            refreshOrdersChainAt(0);
                        });
                    }
                } else {
                    refreshOrdersChainAt(0);
                }
            }
        }); // end of machines.mind()

    }).catch(function(err) {
        console.log("something happened in the promise", err);
        // but I'm going anyway
        callTicLater();
    });
} // end of tic()

function callTicLater() {
    const ms = (new Date() % 28000 + 2000); // maxium 30 sec
    console.log("wait for", ms / 1000, "sec..");
    // time to break
    setTimeout(tic, ms);
}

function refreshOrdersChainAt(index) {
    index = index || 0;
    if (orders.length <= index) {
        callTicLater(); // end of this tic.
        return;
    }

    let o = orders.at(index);
    if (o.get("isDone") || !o.get("order_id")) {
        refreshOrdersChainAt(index + 1);
    }
    let params = {
        order_id: o.get("order_id").toString(), //"1485052731599",	// "1485011389177",
        type: o.get("btParams").type
    };
    /*
          let params = {
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
    xcoinAPI.xcoinApiCall("/info/order_detail", params, function(result) {
        o.set(result);
        o.adjust(resolve => {
            refreshOrdersChainAt(index + 1);
        });
    });
} // refreshOrdersChainAt()

// if (require.main === module) {
//     console.log("tic.", new Date());
//     tic();
// }
