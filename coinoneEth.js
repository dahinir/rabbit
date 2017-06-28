"use strict"

const _ = require('underscore');
const Machines = require("./machine").Machines;
const fetcher = require('./fetcher.js');
const Order = require('./order.js').CoinoneOrder;
const Orders = require('./order.js').CoinoneOrders;


let count = 0;
let machines = new Machines(global.rabbit.machines.find({
    coinType: "ETH",
    marketName: "COINONE"
}));
let ethOrders = new Orders();

exports.tick = function(callback){
    let startTime = new Date();
    console.log("[coinoneEth.js]", count++, machines.length);
    Promise.all([fetcher.getCoinoneEthOrderbook(),
        // fetcher.getBtc_krw(),
        // fetcher.getRecentTransactions(),
        // fetcher.getTicker(),
        // fetcher.getBtc_usd()
    ]).then(values => {
        console.log("[coinoneEth.js] All fetchers've take", ((new Date() - startTime) / 1000).toFixed(2), "sec")
        // console.log(values[0].timestamp);

        // Machines.mind returns participant machines as array
        let result = machines.mind({
            orderBook: values[0]
        })
        console.log(result)
        console.log("[coinoneEth.js]", result.participants.length, " machines want to deal")
        console.log("[coinoneEth.js] end of machines.mind()")


    }).catch(reason => {
        console.log("[coinoneEth.js] maybe next tic.. cuz: " + reason );
        callback();
    }); // Promise end
};


// const Co = require('./order.js').CoinoneOrder;
// const Cos = require('./order.js').CoinoneOrders;
// let co = new Co();
// let cos = new Cos();
// cos.coinType = "eth";
// console.log(cos.length);
// cos.makeOrder(function(){
//     console.log("success");
//     console.log(cos.length);
// }, function(){
//     console.log("fail");
// }, {
//     price: 44210,
//     qty: 1,
//     type: "bid",
//     internalTradedUnits: 0,
//     machineIds: []
// });

// cos.set(co);
// cos.refresh();
// console.log(co.attributes);
