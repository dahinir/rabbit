"use strict"

const _ = require('underscore');
const Machines = require("./machine").Machines;
const fetcher = require('./fetcher.js');
const Order = require('./order.js').Order;
const Orders = require('./order.js').Orders;

console.log("[tick.js] Loaded!")

let count = 0
const machines = new Machines(global.rabbit.machines.where({
    coinType: "ETH",
    marketName: "COINONE"
  }))
const orders = new Orders(global.rabbit.orders.where({
    coinType: "ETH",
    marketName: "COINONE"
  }))

module.exports = async function(){
  let startTime = new Date();
  console.log("Tick no.", ++count, "with", machines.length, "machines. Now fetching..");

  // Promise.all
  let [orderBook, coinoneInfo, korbitInfo]
    = [await fetcher.getCoinoneEthOrderbook(), await fetcher.getCoinoneInfo(), await fetcher.getKorbitInfo()]
  let fetchingTime = ((new Date() - startTime) / 1000).toFixed(2) // sec

  console.log("== in 24hrs at Coinone:", coinoneInfo.low, "~", coinoneInfo.high, ":",coinoneInfo.last,"(",
      ((coinoneInfo.last- coinoneInfo.low)/(coinoneInfo.high- coinoneInfo.low)*100).toFixed(2),"% )" )
  // console.log("")
  console.log("All fetchers've take", fetchingTime, "sec")
  if (fetchingTime > 70.0 ){
    console.log("Fetched too late, pass this tic")
    return
  }

  // Machines.mind returns participant machines
  let machinesResult = machines.mind({
      orderBook: orderBook
  })
  // console.log(result)
  console.log("[tick.js]", machinesResult.participants.length, "machinesResult want to deal")

  // Submit order
  await orders.placeOrder(machinesResult)
  // Check previous orders out
  await orders.refresh()
}
