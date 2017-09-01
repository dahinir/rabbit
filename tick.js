"use strict"

const _ = require('underscore'),
 fetcher = require('./fetcher.js'),
 Machines = require("./machine").Machines,
 Arbitrages = require('./machine.js').Arbitrages,
 Orders = require('./order.js').Orders

console.log("[tick.js] Loaded!")

let count = 0
const machines = new Machines(global.rabbit.machines.filter(m => {
  if (m.get("buy_at") >= 350000 && m.get("buy_at") < 450000)
    return true
  else
    return false
}))
const orders = global.rabbit.orders
const arbitrages = global.rabbit.arbitrages

module.exports = async function(){
  const startTime = new Date()
  console.log("\n--Tick no.", ++count, "with", machines.length, "machines. ",
    startTime.toLocaleString(), "It's been", Math.floor((new Date() - global.rabbit.STARTED)/ 86400000),
      "days.  Now refresh orders..")

  // Check previous orders out
  // console.log("--refresh orders------")
  await orders.refresh()


  /////// FETCHING //////////
  let coinoneInfo, coinoneEthOrderbook, coinoneBalance
  let korbitInfo, korbitEthOrderbook, korbitBalance
  try {
    // Act like Promise.all() 
    const coinoneInfoPromise = fetcher.getCoinoneInfo(),
      coinoneEthOrderbookPromise = fetcher.getCoinoneEthOrderbook(),
      coinoneBalancePromise = fetcher.getCoinoneBalance()
    const  korbitEthOrderbookPromise = fetcher.getKorbitEthOrderbook(),
      korbitBalancePromise = fetcher.getKorbitBalance(),
      korbitInfoPromise = fetcher.getKorbitInfo()

    coinoneInfo = await coinoneInfoPromise
    coinoneEthOrderbook = await coinoneEthOrderbookPromise
    coinoneBalance = await coinoneBalancePromise
    korbitInfo = await korbitInfoPromise
    korbitEthOrderbook = await korbitEthOrderbookPromise
    korbitBalance = await korbitBalancePromise
  } catch (e) {
    ignoreMoreRejectsFrom(coinoneInfoPromise,
      korbitEthOrderbookPromise, coinoneEthOrderbookPromise,
      korbitBalancePromise, coinoneBalancePromise)
    throw new Error("[tick.js] Fail to fetch. Let me try again.")
  }

  const fetchingTime = ((new Date() - startTime) / 1000).toFixed(2) // sec
  const korbit = {
        name: "KORBIT",
        info: korbitInfo,
        orderbook: korbitEthOrderbook,
        balance: korbitBalance
      }
  const coinone = {
        name: "COINONE",
        info: coinoneInfo,
        orderbook: coinoneEthOrderbook,
        balance: coinoneBalance
      }
  global.rabbit.coinone = coinone
  global.rabbit.korbit = korbit
  
  console.log("--In 24hrs at Coinone:", coinone.info.low, "~", coinone.info.high, ":",coinone.info.last,"(",
      ((coinone.info.last- coinone.info.low)/(coinone.info.high- coinone.info.low)*100).toFixed(2),"% )----" )
  console.log("All fetchers've take", fetchingTime, "sec")
  console.log("Invested krw:", new Intl.NumberFormat().format(120000000))
  console.log("KRW:", new Intl.NumberFormat().format(korbit.balance.krw.balance + coinone.balance.krw.balance), "\tCoin:", (korbit.balance.eth.balance + coinone.balance.eth.balance).toFixed(2) )
  console.log("Balance:", new Intl.NumberFormat().format(korbit.balance.krw.balance + korbit.balance.eth.balance * korbit.orderbook.bid[0].price
    + coinone.balance.krw.balance + coinone.balance.eth.balance * coinone.orderbook.bid[0].price), "krw")
  console.log("Coinone eth:", coinone.balance.eth.available.toFixed(2), "\tkrw:", new Intl.NumberFormat().format(coinone.balance.krw.available))
  console.log("Korbit  eth:", korbit.balance.eth.available.toFixed(2), "\tkrw:", new Intl.NumberFormat().format(korbit.balance.krw.available))
  console.log("--(coinone eth)-----max bid:", coinone.orderbook.bid[0], "min ask:", coinone.orderbook.ask[0])
  console.log("--(korbit eth)------max bid:", korbit.orderbook.bid[0], "min ask:", korbit.orderbook.ask[0])
  console.log("coinone eth volume:", coinone.info.volume, "korbit eth volume:", korbit.info.volume)



  /////// TIME TO MIND ////////
  let results = []
  if (fetchingTime > 2.8) {
    console.log("Fetched too late. Don't buy when the market is busy. pass this tic. fetchingTime:", fetchingTime)
    return
  }
  results = arbitrages.mind({
    korbit: korbit,
    coinone: coinone
  })  // It's Array

  if (results.length != 2){
    console.log("-- No arbitrages so mind machines --")
    if (fetchingTime > 1.2 ){
      console.log("Fetched too late. Don't buy when the market is busy. pass this tic. fetchingTime:", fetchingTime)
      return
    }

    let altKorbit = korbit,
      altCoinone = coinone
    if (coinone.balance.krw.available < 600000){
      console.log("[tick.js] not enough krw at coinone.")
      altCoinone = (korbit.orderbook.bid[0].price < coinone.orderbook.bid[0].price) ? coinone : korbit
    }
    if (coinone.balance.eth.available < 2.0){
      console.log("[tick.js] not enough eth at coinone.")
      altCoinone = (korbit.orderbook.ask[0].price > coinone.orderbook.ask[0].price) ? coinone : korbit
    }
    if (korbit.balance.krw.available < 600000){
      console.log("[tick.js] not enough krw at korbit.")
      altKorbit = (coinone.orderbook.bid[0].price < korbit.orderbook.bid[0].price) ? korbit : coinone
    }
    if (korbit.balance.eth.available < 2.0){
      console.log("[tick.js] not enough eth at korbit.")
      altKorbit = (coinone.orderbook.ask[0].price > korbit.orderbook.ask[0].price) ? korbit : coinone
    }
    console.log("altCoinone:", altCoinone.name, "\taltKorbit:", altKorbit.name)
    if (altKorbit.name == "COINONE" && altCoinone.name == "KORBIT"){
      console.log("altCoinone is korbit, altKorbit is coinone. so pass this tick")
      // throw new Error("KILL_ME")
      return
    }

    results = machines.mind({
      korbit: altKorbit,
      coinone: altCoinone
      // korbit: coinone,
      // coinone: coinone
    })
  }
  // console.log("[tick.js]", machinesResult.participants.length, "machinesResult want to deal")
  console.log("[tick.js] machine's results", results)


  ///////  TIME TO ORDER //////
  for (let r of results)
    await orders.placeOrder(r)
  // idk why.. but Below code cause error..  set order on machine 
  // const placeOrderPromises = results.map(result => orders.placeOrder(result))
  // for (let o of placeOrderPromises)
  //   await o



  // Summary
  global.rabbit.machines.presentation(coinoneEthOrderbook)
  // await global.rabbit.arbitrages.presentation()
}

// For error handling in a Promise.all like flow in async/await syntax
function ignoreMoreRejectsFrom(...promises) {
    promises.forEach(p => p && p.catch(function () {
      // Nothing to do
    }));
}
