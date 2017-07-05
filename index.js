"use strict"

const _ = require('underscore'),
    pify = require('pify');

// const xcoinAPI = require('./bithumb_modified.js');
const fetcher = require('./fetcher.js');

const Machine = require('./machine.js').Machine;
const Machines = require('./machine.js').Machines;
const Order = require('./order.js').Order;
const Orders = require('./order.js').Orders;

// const tic = require("./tick.js")

global.rabbit = {
    machines: new Machines(),
    orders: new Orders()
}

// Fetch all machines and orders from db
global.rabbit.machines.fetchAll({
  success: function() {
    global.rabbit.orders.fetch({
      data: {
          isDone: false
          // $skip: 10,
          // $limit: 10
      },
      success: function() {
          console.log("[index.js] ", global.rabbit.machines.length, "machines are loaded.");
          console.log("[index.js] ", global.rabbit.orders.length, "undone orders are loaded.");
          console.log("===start======================")

          // console.log(global.rabbit.machines.get("595b958342753ba3e4550580").attributes)
          // return
          //
          // for(let order of global.rabbit.orders.models){
          //   let participants = []
          //
          // }
          global.rabbit.orders.each(order => {
            let participants = []

            for (let mId of order.get("machineIds")){
              let m = global.rabbit.machines.get(mId)
              if(_.isUndefined(m)){
                console.log("undefined machine!")
                console.log(order.attributes)
                throw new Error("wtf")
              }
              // console.log(mId)
              // console.log(m.attributes)
              participants.push(m)
            }

            if (order.get("machineIds").length == participants.length){
              console.log("order id:" ,order.id, "got participants properly!")
              order.participants = participants
            }else{
              console.log("---order got problem-----")
              console.log(participants)
              console.log(order.attributes)
              throw new Error("Order's participants got problem")
            }

            console.log("added to order participants:", participants.length)
          })
// return
// db.machines.find({created_at:{$gt:ISODate("2017-07-04T13:40:37.513Z")}}).pretty()

          // Run rabbit, Don't look back.
          run();
      }
    })
  }
})

let startTime = new Date();
let coinoneEthMachines, orders
async function run() {
  if (_.isUndefined(coinoneEthMachines))
    coinoneEthMachines = new Machines(global.rabbit.machines.where({
      coinType: "ETH",
      marketName: "COINONE"
    }))

  if (_.isUndefined(orders))
    orders = new Orders(global.rabbit.orders.where({
      coinType: "ETH",
      marketName: "COINONE"
    }))

  try {
    await require("./tick.js")(coinoneEthMachines, orders)
  } catch (e) {
    console.log(e)
  } finally {
    console.log("[index.js] It's been ", ((new Date() - startTime) / 1000).toFixed(2), "sec")
    global.rabbit.machines.presentation()
    console.log("--end------------------------\n")
    setTimeout(run, 7000)
  }
}
/*
let count = 0, appStartTime = new Date()


async function tick(coinoneEthMachines, orders){
  try {
    let tickStartTime = new Date();
    console.log("[coinoneEth.js] Tick no.", count++, "with", coinoneEthMachines.length, "machines");

    // Promise.all
    let [orderBook] = [await fetcher.getCoinoneEthOrderbook()]
    console.log("[coinoneEth.js] All fetchers've take", ((new Date() - tickStartTime) / 1000).toFixed(2), "sec")
console.log(coinoneEthMachines.length)
    // Machines.mind returns participant machines
    let coinoneEthMachinesResult = coinoneEthMachines.mind({
        orderBook: orderBook
    })
    // console.log(result)
    console.log("[coinoneEth.js]", coinoneEthMachinesResult.participants.length, "coinoneEthMachines want to deal")

    // Submit order
    await orders.placeOrder(coinoneEthMachinesResult)
    // Check previous orders out
    await orders.refresh()
  } catch (e) {
    console.log(e)
  } finally {
    // One more tick please
    setTimeout(tick, 1000)
    console.log("[index.js] It's been ", ((new Date() - appStartTime) / 60000).toFixed(2), "min")
  }
}

/*
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
    btc_krw_a = 0,
    btc_krw_b = 0,
    hope = 0,
    btc_krw_rate_of_24h = 0;

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
        btc_krw_a = values[2].btc_krw_a;
        btc_krw_b = values[2].btc_krw_b;
        hope = Math.round(btc_krw_a - btc_usd * usd_krw);
        if (minHope[0] > hope) {
            minHope = [hope, btc_krw_a];
        }
        if (maxHope[0] < hope) {
            maxHope = [hope, btc_krw_a];
        }
        if (minBtc_krw[1] > btc_krw_a)
            minBtc_krw = [hope, btc_krw_a];
        if (maxBtc_krw[1] < btc_krw_a)
            maxBtc_krw = [hope, btc_krw_a];

        // btc_krw_rate_of_24h
        let bithumbInfo = values[4];
        if (btc_krw_a <= bithumbInfo.average_price){
            btc_krw_rate_of_24h = (btc_krw_a - bithumbInfo.min_price) / (bithumbInfo.average_price - bithumbInfo.min_price) / 2;
        }else{
            btc_krw_rate_of_24h = (btc_krw_a - bithumbInfo.average_price) / (bithumbInfo.max_price - bithumbInfo.average_price) / 2 + 0.5;
        }

        if(btc_krw_rate_of_24h > 0.7 && hope > 30000)
            console.log("I THINK IT'S TIME TO SELL!");
        if(btc_krw_rate_of_24h < 0.3 && hope < -30000)
            console.log("I THINK IT'S TIME TO BUY!");
        console.log("btc_krw_rate_of_24h: ", btc_krw_rate_of_24h, "-------");      console.log("hope\t\tmin:", minHope, "\tmax:", maxHope);
        console.log("btc_krw_a\tmin:", minBtc_krw, "\tmax:", maxBtc_krw);
        console.log("now\t hope:", hope, "\tbtc_krw_a:", btc_krw_a, btc_krw_b, "\tbtc_usd:", btc_usd, "\tusd_krw:", usd_krw.toFixed(2) * 1);
        console.log("-------------------------------");

        // callTicLater();
        // return;

        // if (isIdling) {
        if(false){
            if ( btc_krw_a > 1238000 && hope > -15000) {
                console.log("It's too expensive!");
                callTicLater();
                return;
            } else {
                isIdling = false;
            }
        }
        machines.mind({
            hope: hope,
            minAskPrice: btc_krw_a,
            maxBidPrice: btc_krw_b,
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
                        // price: btc_krw_a.toFixed(0),
                        price: Math.round(btc_krw_a) + "",
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
                    // console.log(btParams, totalBid, totalAsk, btc_krw_a);

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

    if (false && hope <= -61000 && btc_krw_rate_of_24h < 0.2 && machines.length < 12000) {
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
        console.log("[index.js] Real players created!! ", realPlayerCreatedAt.toLocaleString());
    } else {
        console.log("[index.js] Real players have not appeared..");
    }

    console.log(machines.presentation({
        btc_krw_a: btc_krw_a,
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
*/
