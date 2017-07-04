"use strict"

const _ = require('underscore');
const Machines = require("./machine").Machines;
const fetcher = require('./fetcher.js');
const Order = require('./order.js').Order;
const Orders = require('./order.js').Orders;

console.log("[tick.js] Loaded!")

let count = 0

module.exports = async function(machines, orders){
  let tickStartTime = new Date();
  console.log("[tick.js] Tick no.", ++count, "with", machines.length, "machines");

  // Promise.all
  let [orderBook] = [await fetcher.getCoinoneEthOrderbook()]
  console.log("[tick.js] All fetchers've take", ((new Date() - tickStartTime) / 1000).toFixed(2), "sec")
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
