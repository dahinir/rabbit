"use strict"
const xcoinAPI = require('./bithumb_modified.js'),
    coinoneAPI = require("./coinone.js"),
    korbitAPI = require("./korbit.js"),
    fetcher = require('./fetcher.js'),
    Order = require('./order.js').Order,
    Orders = require('./order.js').Orders,
    Machine = require('./machine.js').Machine,
    Machines = require('./machine.js').Machines,
    Arbitrage = require('./machine.js').Arbitrage,
    Arbitrages = require('./machine.js').Arbitrages,
    _ = require('underscore'),
    fs = require('fs'),
    moment = require('moment'),
    brain = require('brain.js')

// console.log((new Date()).toLocaleString())
// let aa = [0,0,0,0,0]
// aa.forEach(m => {
//     const pIndex = 1
//     aa[pIndex] += 1
// })
// console.log(aa)
if (true && (false | false)) 
    console.log(Date.now())
else
    console.log("aa")
// const machines = new Machines()
// machines.fetchAll({
//     data: {
//     },
//     success: function () {
//         console.log("success")
//         let count = 0
//         machines.each(m => {
//             count += m.get("traded_count")
//             // if (m.get("traded_count") > 0)
//             //     console.log(m.get("traded_count"), m.get("buy_at"))
//         })
//         console.log(count)
//     }
// })