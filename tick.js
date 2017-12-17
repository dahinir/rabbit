"use strict"

const _ = require('underscore'),
  fetcher = require('./fetcher.js')

console.log("\n\n[tick.js] Loaded!")

module.exports = async function(options){
  const TICK_STARTED = new Date(),
    COUNT = options.count,
    coinType = options.coinType,
    KORBIT = (global.rabbit.constants[coinType].MARKET.indexOf("KORBIT") >= 0) ? true : false,
    COINONE = (global.rabbit.constants[coinType].MARKET.indexOf("COINONE") >= 0) ? true : false
 
  const arbitrages = options.arbitrages,
    machines = options.machines,
    orders = options.orders,
    recentCompleteOrders = options.recentCompleteOrders

  console.log("-- ", coinType, "Tick no.", COUNT, "with", machines.length, "machines. ",
    TICK_STARTED.toLocaleString(), "It's been", ((new Date() - global.rabbit.constants[coinType].STARTED)/ 86400000).toFixed(1),
    "days. ", ((new Date() - global.rabbit.BORN) / 86400000).toFixed(1), "days old")


  //// Check previous orders out ////
  await orders.refresh({
    coinType: coinType
  })


  /////// FETCHING //////////
  let coinoneInfo, korbitInfo, FETCH_STARTED
  let coinoneOrderbook, coinoneBalance, coinoneRecentCompleteOrders
  let korbitOrderbook, korbitBalance, korbitRecentCompleteOrders
  try {
    // Act like Promise.all()
    // Less important in time domain
    const coinoneInfoPromise = COINONE ? fetcher.getCoinoneInfo(coinType) : "",
      korbitInfoPromise = KORBIT ? fetcher.getKorbitInfo(coinType) : "",
      coinoneBalancePromise = COINONE ? fetcher.getCoinoneBalance() : "",
      korbitBalancePromise = KORBIT ? fetcher.getKorbitBalance() : "",
      coinoneRecentCompleteOrdersPromise = COINONE ? fetcher.getCoinoneRecentCompleteOrders(coinType) : "",
      korbitRecentCompleteOrdersPromise = KORBIT ? fetcher.getKorbitRecentCompleteOrders(coinType) : ""
    if (COINONE) coinoneInfo = await coinoneInfoPromise
    if (KORBIT) korbitInfo = await korbitInfoPromise
    if (COINONE) coinoneBalance = await coinoneBalancePromise
    if (KORBIT) korbitBalance = await korbitBalancePromise
    if (COINONE) coinoneRecentCompleteOrders = await coinoneRecentCompleteOrdersPromise
    if (KORBIT) korbitRecentCompleteOrders = await korbitRecentCompleteOrdersPromise
    // console.log("Fetching some info takes", ((new Date() - TICK_STARTED) / 1000).toFixed(2), "sec")

    // More important in time domain //
    FETCH_STARTED = Date.now() / 1000 // in sec
    const coinoneOrderbookPromise = COINONE ? fetcher.getCoinoneOrderbook(coinType) : "",
      korbitOrderbookPromise = KORBIT ? fetcher.getKorbitOrderbook(coinType) : ""
    if (COINONE) coinoneOrderbook = await coinoneOrderbookPromise
    if (KORBIT) korbitOrderbook = await korbitOrderbookPromise

  } catch (e) {
    // ignoreMoreRejectsFrom(coinoneInfoPromise, coinoneRecentCompleteOrdersPromise,
    //   korbitOrderbookPromise, coinoneOrderbookPromise,
    //   korbitBalancePromise, coinoneBalancePromise)
    console.log(e)
    throw new Error("[tick.js] Fail to fetch. Let me try again.")
  }
  
  
  const korbit = {
        name: "KORBIT",
        info: korbitInfo,
        orderbook: korbitOrderbook,
        balance: korbitBalance
      }
  const coinone = {
        name: "COINONE",
        info: coinoneInfo,
        orderbook: coinoneOrderbook,
        balance: coinoneBalance
      }
      
  // Some data needs to go global
  global.rabbit.coinone = global.rabbit.coinone || {}
  if (COINONE){
    global.rabbit.coinone.balance = coinoneBalance
    global.rabbit.coinone[coinType] = {
      name: "COINONE",
      info: coinoneInfo,
      orderbook: coinoneOrderbook
    }
  }
  global.rabbit.korbit = global.rabbit.korbit || {}
  if (KORBIT){
    global.rabbit.korbit.balance = korbitBalance
    global.rabbit.korbit[coinType] = {
      name: "KORBIT",
      info: korbitInfo,
      orderbook: korbitOrderbook
    }
  }

  global.rabbit.markets = global.rabbit.markets || {}
  let totalCoin = COINONE ? coinoneBalance[coinType].balance : 0
  totalCoin += KORBIT ? korbitBalance[coinType].balance : 0
  let lastPrice = COINONE ? coinoneInfo.last : (KORBIT ? korbitInfo.last : -1)
  
  if (COINONE) console.log("-- In 24 hrs", coinoneInfo.volume, coinType, "traded at Coinone:", coinoneInfo.low, "~", coinoneInfo.high, ":", coinoneInfo.last, "(", ((coinoneInfo.last - coinoneInfo.low) / (coinoneInfo.high - coinoneInfo.low) * 100).toFixed(2), "% )----")
  console.log("coin:", (totalCoin).toFixed(2), coinType, "is now about \u20A9", new Intl.NumberFormat().format(((totalCoin) * lastPrice).toFixed(0)))
  if (COINONE) console.log("Coinone", coinType + ":", coinoneBalance[coinType].available.toFixed(2))
  if (KORBIT) console.log("Korbit", coinType + ":", korbitBalance[coinType].available.toFixed(2))
  if (COINONE) console.log("--(coinone", coinType + ")-----max bid:", coinoneOrderbook.bid[0], "min ask:", coinoneOrderbook.ask[0])
  if (KORBIT) console.log("--(korbit", coinType + ")------max bid:", korbitOrderbook.bid[0], "min ask:", korbitOrderbook.ask[0])
  

  //// It's time sensitive ////
  const NOW = Date.now() / 1000 // in sec
  const FETCHING_TIME = NOW - FETCH_STARTED // sec
  console.log("Fetching All Orderbooks takes", FETCHING_TIME, "sec")
  if (FETCHING_TIME > 3.2) {
    console.log("Fetched too late. Don't buy when the market is busy. pass this tic. fetchingTime:", FETCHING_TIME)
    return
  }
  if (COINONE) {
    const ORDERBOOK_OLD = NOW - coinoneOrderbook.timestamp
    if (ORDERBOOK_OLD > 5.1) { // sec
      console.log("Coinone orderbook is too old:", ORDERBOOK_OLD)
      return
    }
    if (ORDERBOOK_OLD < FETCHING_TIME) {
      console.log("Coinone orderbook has been made after fetching.. I can not belive it:", ORDERBOOK_OLD)
      return
    }
  }
  if (KORBIT) {
    const ORDERBOOK_OLD = NOW - korbitOrderbook.timestamp
    if (ORDERBOOK_OLD > 60) { // Unix timestamp in milliseconds of the last placed order.
      console.log("Korbit orderbook is too old:", ORDERBOOK_OLD)
      return
    }
    if (ORDERBOOK_OLD < FETCHING_TIME) {
      console.log("Korbit orderbook has been made after fetching.. I can not belive it:", ORDERBOOK_OLD)
      return
    }
  }

  
  //// Arbitrages ////
  let results = []
  if (global.rabbit.constants[coinType].ARBITRAGE_STARTED && global.rabbit.constants[coinType].MARKET.length >= 2){
    results = arbitrages.mind({
      coinType: coinType,
      korbit: korbit,
      coinone: coinone
    })  // It's Array
    if (results.length == 2 ){
      results[0].tt = "ARBIT"
      results[1].tt = "ARBIT"
    }
  }
  // results = []

  if (results.length != 2){
    console.log("-- No arbitrages so mind machines --")
    if (isInclined(coinoneRecentCompleteOrders || korbitRecentCompleteOrders)) {
      console.log("Wait.. It looks like inclined. order won't be place")
      machines.presentation({
        coinType: coinType,
        orderbook: coinoneOrderbook
      })
      return
    }

    /////// TIME TO MIND ////////
    results = machines.mind({
      coinType: coinType,
      // korbit: altKorbit,
      // coinone: altCoinone
      korbit: KORBIT ? korbit : coinone,
      coinone: COINONE ? coinone : korbit
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


  ////// Time to Cancel a useless order ////
  await orders.cancel({
    coinType: coinType,
    lastPrice: lastPrice
  })

  ////// Presentation /////// :will move to index.js
  machines.presentation({
    coinType: coinType,
    orderbook: coinoneOrderbook
  })
} // End of module.exports



/////// HELPER FUNCTIONS //////
// For error handling in a Promise.all like flow in async/await syntax
function ignoreMoreRejectsFrom(...promises) {
    promises.forEach(p => p && p.catch(function () {
      // Nothing to do
    }));
}

function isInclined(recentCompleteOrders) {
  recentCompleteOrders = recentCompleteOrders.reverse()

  const lastTimestamp = recentCompleteOrders[0].timestamp * 1
  const TERM = 60 * 3  // 3 mins
  // console.log(recentCompleteOrders[0], recentCompleteOrders[1])
  let candles = recentCompleteOrders.reduce((candles, o) => {
    const index = Math.floor((lastTimestamp - (o.timestamp * 1)) / TERM)

    if (Array.isArray(candles[index]))
      candles[index].push(o)
    else
      candles[index] = [o]  // It's new Array
    return candles
  }, [])
  candles = candles.map(c => {
    const lastIndex = c.length - 1
    const open = c[lastIndex].price * 1,
      close = c[0].price * 1,
      volume = c.reduce((sum, el) => {
        return sum + (el.qty || 0) * 1
      }, 0)

    return {
      v: Math.round(volume),
      count: c.length,
      open: open,
      close: close,
      // low: 0,
      // hight: 0,
      body: (close > open) ? "+" : "-"
    }
  })

  
  // console.log((candles[0].body == candles[1].body) ? "wait" : "action")
  for (let i = 0; i < 5; i++)
    console.log(candles[i])
  // console.log(candles.length, candles[0].length, candles[1].length, candles[2].length, candles[3].length, candles[4].length)
  // console.log( candles[candles.length - 1])
  if (candles[0].open == candles[0].close || _.isUndefined(candles[0]) || _.isUndefined(candles[1]))
    return false
  return (candles[0].body == candles[1].body) ? true : false
}