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
const orders = global.rabbit.orders
const arbitrages = global.rabbit.arbitrages

module.exports = async function(){
  let startTime = new Date()
  console.log("--Tick no.", ++count, "with", machines.length, "machines. ",
    startTime.toLocaleString(), "It's been", Math.floor((new Date() - global.rabbit.STARTED)/ 86400000),
      "days.  Now refresh orders..")

  // Check previous orders out
  // console.log("--refresh orders------")
  await orders.refresh()


  /////// FETCHING //////////
  let coinoneInfo, korbitEthOrderbook, coinoneEthOrderbook, korbitBalance, coinoneBalance
  // Act like Promise.all()
  const coinoneInfoPromise = fetcher.getCoinoneInfo(),
    korbitEthOrderbookPromise = fetcher.getKorbitEthOrderbook(),
    coinoneEthOrderbookPromise = fetcher.getCoinoneEthOrderbook(),
    korbitBalancePromise = fetcher.getKorbitBalance(),
    coinoneBalancePromise = fetcher.getCoinoneBalance()

  try {
    coinoneInfo = await coinoneInfoPromise
    korbitEthOrderbook = await korbitEthOrderbookPromise
    coinoneEthOrderbook = await coinoneEthOrderbookPromise
    korbitBalance = await korbitBalancePromise
    coinoneBalance = await coinoneBalancePromise
    global.rabbit.coinoneInfo = coinoneInfo
  } catch (e) {
    ignoreMoreRejectsFrom(coinoneInfoPromise,
      korbitEthOrderbookPromise, coinoneEthOrderbookPromise,
      korbitBalancePromise, coinoneBalancePromise)
    throw new Error("[tick.js] Fail to fetch. Let me try again.")
  }

  const fetchingTime = ((new Date() - startTime) / 1000).toFixed(2) // sec
  const korbit = {
        name: "KORBIT",
        orderbook: korbitEthOrderbook,
        balance: korbitBalance
      }
  const coinone = {
        name: "COINONE",
        orderbook: coinoneEthOrderbook,
        balance: coinoneBalance
      }

  console.log("--In 24hrs at Coinone:", coinoneInfo.low, "~", coinoneInfo.high, ":",coinoneInfo.last,"(",
      ((coinoneInfo.last- coinoneInfo.low)/(coinoneInfo.high- coinoneInfo.low)*100).toFixed(2),"% )----" )
  console.log("All fetchers've take", fetchingTime, "sec")
  console.log("Balance:", new Intl.NumberFormat().format(korbitBalance.krw.balance + korbitBalance.eth.balance * korbitEthOrderbook.bid[0].price
    + coinoneBalance.krw.balance + coinoneBalance.eth.balance * coinoneEthOrderbook.bid[0].price), "krw")
  console.log("--(coinone eth)-----max bid:", coinone.orderbook.bid[0], "min ask:", coinone.orderbook.ask[0])
  console.log("--(korbit eth)------max bid:", korbit.orderbook.bid[0], "min ask:", korbit.orderbook.ask[0])

  if (fetchingTime > 70.0 ){
    console.log("Fetched too late, pass this tic")
    return
  }


  /////// TIME TO MIND ////////
  let results = arbitrages.mind({
    korbit: korbit,
    coinone: coinone
  })  // It's Array

  if (results.length != 2){
    results = machines.mind({
      korbit: korbit,
      coinone: coinone
    })
  }
  // console.log("[tick.js]", machinesResult.participants.length, "machinesResult want to deal")
  console.log("[tick.js] machine's results", results)


  ///////  TIME TO ORDER //////
  const placeOrderPromises = results.map(result => orders.placeOrder(result))
  for(let o of placeOrderPromises)
    await o



  // Summary
  machines.presentation(coinoneEthOrderbook)
  // await global.rabbit.arbitrages.presentation()
}

// For error handling in a Promise.all like flow in async/await syntax
function ignoreMoreRejectsFrom(...promises) {
    promises.forEach(p => p && p.catch(function () {
      // Nothing to do
    }));
}
