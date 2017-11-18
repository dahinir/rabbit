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
    Backbone = require('backbone'),
    _ = require('underscore'),
    fs = require('fs'),
    moment = require('moment'),
    brain = require('brain.js')

for (const c of [2,3,4])
    console.log(c, -c.toFixed)
    return

async function go(ed) {
    try {

        marketResult = await korbitAPI({
          type: "BID",
          qty: 0.001,
          coinType: "BTC",
          price: 55050
        })

    } catch (e) {
        // console.log("catch")
        // console.log(e)
        // if (e.errorCode == "104")
        //   console.log("haah")
        // if only coinone!
        // if ( e.errorCode == "1015") // Cancel more than available. maybe..
    }

    // console.log("--")
}
go()
// go().then(r => console.log("result:", r)).catch(e => console.log("catch",e))
return

for( let m of [1,2,4])
    console.log(m)
console.log(m)
return


const hey = {
    ab: "ab"
}

console.log(hey)
{
var aa = "added"
}
// hey[aa]="dd"
// hey.aa = "asdf"
hey.aa = hey.aa || {}
hey.aa[aa] = "what"
console.log(hey)


// fetcher.getKorbitBalance("ETH").then(r => {
//     console.log(r)
// })


// const coinRevolver = function () {
//     const chamber = ["ETH", "BTC"]
//     console.log(0%chamber.length)
//     console.log(1 % chamber.length)
//     console.log(2 % chamber.length)
//     console.log(3 % chamber.length)
//     return chamber[0]
// }
// console.log(coinRevolver().toLowerCase()+"_krw")

// console.log((new Date()).toLocaleString())
// let aa = [0,0,0,0,0]
// aa.forEach(m => {
//     const pIndex = 1
//     aa[pIndex] += 1
// })
// console.log(aa)

// if (true && (false | false)) 
//     console.log(Date.now())
// else
//     console.log("aa")

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