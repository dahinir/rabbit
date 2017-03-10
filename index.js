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

let ticNumber = 0,
    minHope = [Infinity, 0],
    maxHope = [-Infinity, 0],
    minBtc_krw = [0, Infinity],
    maxBtc_krw = [0, -Infinity],
    fee_krw = 0,
    fee_btc = 0,
    startTime = new Date(),
    isIdling = true,
    btc_usd = 0,
    usd_krw = 0,
    btc_krw = 0,
    btc_krw_b = 0,
    hope = 0,
    btc_krw_rate_of_24h = 0;
let machines = new Machines();
let orders = new Orders();
// fetch from db
machines.fetchAll({
    success: function() {
        orders.fetch({
            data: {
                isDone: false
                // $skip: 10,
                // $limit: 10
            },
            success: function() {
                console.log("[index.js] ", orders.length, "orders are loaded.");
                orders.each(function(o) {
                    console.log("[index.js] ", o.id, "order will load their", o.get('machineIds').length, " machines");
                    // deserialize participant machines
                    o.machines = new Machines();
                    _.each(o.get('machineIds'), function(machineId) {
                        o.machines.push(machines.get(machineId));
                    });
                });
                tic();
            }
        });
    }
});


function tic(error, response, rgResult) {
    if (ticNumber != 0) {}

    let nowTime = new Date();
    console.log("\n=====", ++ticNumber, "== (", ((nowTime - startTime) / 1000 / 60 / 60).toFixed(2), "hr", startTime.toLocaleString(), ") ====", new Date(), "==");

    Promise.all([new Promise(fetcher.getBtc_usd),
        new Promise(fetcher.getUsd_krw),
        new Promise(fetcher.getBtc_krw),
        new Promise(fetcher.getRecentTransactions),
        new Promise(fetcher.getTicker)
    ]).then(function(values) {

        btc_usd = values[0];
        usd_krw = values[1];
        btc_krw = values[2].btc_krw;
        btc_krw_b = values[2].btc_krw_b;
        hope = Math.round(btc_krw - btc_usd * usd_krw);
        if (minHope[0] > hope) {
            minHope = [hope, btc_krw];
        }
        if (maxHope[0] < hope) {
            maxHope = [hope, btc_krw];
        }
        if (minBtc_krw[1] > btc_krw)
            minBtc_krw = [hope, btc_krw];
        if (maxBtc_krw[1] < btc_krw)
            maxBtc_krw = [hope, btc_krw];

        // btc_krw_rate_of_24h
        let bithumbInfo = values[4];
        if (btc_krw <= bithumbInfo.average_price){
            btc_krw_rate_of_24h = (btc_krw - bithumbInfo.min_price) / (bithumbInfo.average_price - bithumbInfo.min_price) / 2;
        }else{
            btc_krw_rate_of_24h = (btc_krw - bithumbInfo.average_price) / (bithumbInfo.max_price - bithumbInfo.average_price) / 2 + 0.5;
        }

        if(btc_krw_rate_of_24h > 0.7 && hope > 30000)
            console.log("I THINK IT'S TIME TO SELL!");
        if(btc_krw_rate_of_24h < 0.3 && hope < -30000)
            console.log("I THINK IT'S TIME TO BUY!");
        console.log("btc_krw_rate_of_24h: ", btc_krw_rate_of_24h, "-------");      console.log("hope\t\tmin:", minHope, "\tmax:", maxHope);
        console.log("btc_krw\t\tmin:", minBtc_krw, "\tmax:", maxBtc_krw);
        console.log("now\t hope:", hope, "\tbtc_krw:", btc_krw, btc_krw_b, "\tbtc_usd:", btc_usd, "\tusd_krw:", usd_krw.toFixed(2) * 1);
        console.log("-------------------------------");

        // if (isIdling) {
        if(false){
            if ( btc_krw > 1238000 && hope > -15000) {
                console.log("It's too expensive!");
                callTicLater();
                return;
            } else {
                isIdling = false;
            }
        }
        machines.mind({
            hope: hope,
            btc_krw: btc_krw,
            btc_krw_b: btc_krw_b,
            success: result => {
                let totalBid = result.totalBid,
                    totalAsk = result.totalAsk,
                    internalTradedUnits = 0;

                let btParams = {};

                let participants = new Machines(result.participants);

                // internal trade! machine calculates with their own mind. It's kind of modest.
                if (totalBid > totalAsk) {
                    internalTradedUnits = totalAsk;
                    btParams = {
                        type: "bid",
                        // price: btc_krw.toFixed(0),
                        price: Math.round(btc_krw) + "",
                        units: (totalBid - totalAsk).toFixed(3)
                        // units: parseFloat(totalBid - totalAsk).toPrecision(8)
                    }
                } else if (totalBid < totalAsk) {
                    internalTradedUnits = totalBid;
                    btParams = {
                        type: "ask",
                        // price: btc_krw_b.toFixed(0),
                        price: Math.round(btc_krw_b) + "",
                        units: (totalAsk - totalBid).toFixed(3)
                        // units: parseFloat(totalAsk - totalBid).toPrecision(8)
                    }
                } else if (totalBid == totalAsk) {
                    internalTradedUnits = totalBid;
                    btParams = {
                        type: "none"
                    };
                }
                if (participants.length > 0) {
                    let newOrder = new Order({
                        machineIds: participants.pluck('id'),
                        btParams: btParams,
                        internalTradedUnits: internalTradedUnits
                    });

                    newOrder.machines = participants; // not attributes!

                    console.log("[index.js] New order got", newOrder.get('machineIds').length, "machines");
                    console.log("[index.js] Traded internal:", internalTradedUnits, "btc");
                    console.log("[index.js] Traded with Bithumb:", btParams);
                    // console.log(btParams, totalBid, totalAsk, btc_krw);

                    if (btParams.type == "ask" || btParams.type == "bid") {
                        // console.log("[index.js] trade with Bithumb ", btParams);
                        xcoinAPI.xcoinApiCall('/trade/place', btParams, function(result) {
                            if(participants.length < 50)
                                console.log("[index.js] propensities: ", participants.pluck("propensity"));
                            console.log("[index.js] Bithumb trade result:", result);
                            if (result.status == '0000' && result.order_id) {
                                orders.push(newOrder);
                                newOrder.set(result);
                                newOrder.adjust(function() {
                                    if (result.data[0] && result.data[0].fee * 1 > 0) {
                                        console.log("[index.js] Fee! Rabbit ears down.");
                                        return; // end the Rabbit
                                    } else {
                                        refreshOrdersChainAt(0);
                                    }
                                });
                            } else {
                                console.log("[index.js] Bithumb trade failed. This order will be ignored. ");
                                refreshOrdersChainAt(0);
                            }
                        });
                    } else {
                        // There is internal PERPECT trade..maybe
                        newOrder.adjust(function() {
                            refreshOrdersChainAt(0);
                        });
                    }
                } else {
                    // If there is no participants
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

let realPlayerCreatedAt,
    makeRealPlayerCount = 0;
function callTicLater() {

    if (hope <= -80000 && machines.length < 8000) {
        console.log("[index.js] hope is", hope, "!! CHANGE CAPACITY!!");
        machines.makeRealPlayer({
          hope: hope,
          btc_krw_b: btc_krw_b
        });
        realPlayerCreatedAt = new Date();
        makeRealPlayerCount++;
        setTimeout(tic, 60 * 1000);
        return;
    }
    if (makeRealPlayerCount > 0) {
        console.log("[index.js] real players created ", realPlayerCreatedAt.toLocaleString());
    } else {
        console.log("[index.js] real players have not appeared.");
    }

    console.log(machines.presentation({
        btc_krw: btc_krw,
        btc_krw_b: btc_krw_b
    }));
    const ms = (new Date() % 3000 + 5000); // about 10 secs
    console.log("wait for", ms / 1000, "sec..\n");
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
        return;
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
        console.log("[index.js] Bithumb order_detail result:", result);
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
