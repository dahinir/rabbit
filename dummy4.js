"use strict"

const coinoneAPI = require("./coinone.js"),
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

async function g2o(ed) {
    try {
        // const bb = await fetcher.getCoinoneRecentCompleteOrders("IOTA")
        // const bb = await fetcher.getKorbitRecentCompleteOrders("BTG")
        // const bb = await fetcher.getKorbitBalance()
        // const bb = await fetcher.getKorbitOrderbook("BTG")
        // bb = await korbitAPI({
        //     type: "BID",
        //     price: 240500,
        //     qty: 1,
        //     coinType: "BTG"
        // })
        const FETCH_STARTED = Date.now() / 1000
        const bb = await fetcher.getCoinoneOrderbook("XRP")
        // const bb = await fetcher.getKorbitOrderbook("BTC")
        
        const now = Date.now() / 1000
        console.log("now:", now)
        console.log("orderbook.timestamp:", bb.timestamp)
        console.log("orderbook old:", now - bb.timestamp)
        console.log("fetching time:", now - FETCH_STARTED)
        console.log(bb.bid[0])
        if (now - bb.timestamp > now - FETCH_STARTED)
            console.log("orderbook has been made before fetch")
        else
            console.log("orderbook has been made after fetch")
    } catch (e) {
        // console.log("catch")
        console.log(e)
        // if (e.errorCode == "104")
        //   console.log("haah")
        // if only coinone!
        // if ( e.errorCode == "1015") // Cancel more than available. maybe..
    }
    // console.log("--")
}
g2o()
// go().then(r => console.log("result:", r)).catch(e => console.log("catch",e))
return


// if (true) console.log(Math.pow(0.1, 3).toFixed(3)*1)
let sum = 0
let arrr = [0.02, 0.03, 0.12, 0.09, 0.07, 0.05, 0.03, 0.02, 0.02, 0.02]
arrr.forEach(o => sum += o)
console.log(arrr.length, sum * 57.2)
console.log({
    asdf: (() => {
        return "haha"
    })()
})
return




// for (let )   
//     const AA = function(){
//         return "d"
//     }()
//     console.log(`A:${AA} haha`)
//     const o = new Order({orderId:"HAHAHAHAHAHAH"})
//     if(false) console.log(`"CANCELED" event called. The order ${o.get("orderId")}will be removed from the orders. remain in db`)
// return

const startTime = ["A", "BB"]
const bb = Array.from(startTime)
bb[0] = "aaaaa"
console.log(startTime)
console.log(bb)
return

const a = startTime.indexOf("BdB") || false
console.log(a)
let coinoneInfo, korbitInfo = 1251, fetchingTime = Infinity
korbitInfo = (function(){
    return a+14
})()
const BU = 50
// let snapedPrice = (minAskPrice / BU).toFixed(0) * BU 
// let snapedPrice = ()()
console.log(Math.ceil(korbitInfo / BU) * BU, korbitInfo)
return
async function go(ed) {
    try {

        marketResult = await korbitAPI({
          type: "BID",
          qty: 0.001,
          coinType: "BTC",
          price: 6000
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