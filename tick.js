"use strict"

const _ = require('underscore'),
 fetcher = require('./fetcher.js'),
 Machines = require("./machine").Machines,
 Arbitrages = require('./machine.js').Arbitrages,
 Orders = require('./order.js').Orders

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
const arbitrages = new Arbitrages()

module.exports = async function(){
  let startTime = new Date()
  console.log("Tick no.", ++count, "with", machines.length, "machines. ",
    startTime, "Now fetching..")

  // Act like Promise.all()
  const coinoneInfoPromise = fetcher.getCoinoneInfo(),
    coinoneEthOrderbookPromise = fetcher.getCoinoneEthOrderbook(),
    korbitEthOrderbookPromise = fetcher.getKorbitEthOrderbook()
  const coinoneInfo = await coinoneInfoPromise,
    coinoneEthOrderbook = await coinoneEthOrderbookPromise,
    korbitEthOrderbook = await korbitEthOrderbookPromise
  const fetchingTime = ((new Date() - startTime) / 1000).toFixed(2) // sec

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
      orderbook: coinoneEthOrderbook
  })
  // console.log(result)
  console.log("[tick.js]", machinesResult.participants.length, "machinesResult want to deal")

  // console.log("before mind: arbitrages.length", arbitrages.length)
  // const result = arbitrages.mind({
  //   coinoneEthOrderbook: coinoneEthOrderbook,
  //   korbitEthOrderbook: korbitEthOrderbook
  // })
  // console.log("after mind: arbitrages.length", arbitrages.length)
  // console.log(result)


  // Submit order
  await orders.placeOrder(machinesResult)
  // Check previous orders out
  await orders.refresh()
}
