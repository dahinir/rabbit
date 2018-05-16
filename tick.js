"use strict"

const _ = require('underscore'),
  fetcher = require('./fetcher.js'),
  coinoneAPI = require("./coinone.js"),
  korbitAPI = require("./korbit.js"),
  bithumbAPI = require("./bithumb.js")

console.log("\n\n[tick.js] Loaded!")

module.exports = async function(options){
  const TICK_STARTED = new Date(),
    COUNT = options.count,
    coinType = options.coinType,
    KORBIT = (global.rabbit.constants[coinType].MARKET.indexOf("KORBIT") >= 0) ? true : false,
    COINONE = (global.rabbit.constants[coinType].MARKET.indexOf("COINONE") >= 0) ? true : false,
    BITHUMB = (global.rabbit.constants[coinType].MARKET.indexOf("BITHUMB") >= 0) ? true : false
 
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
  let FETCH_STARTED
  let coinoneInfo, coinoneOrderbook, coinoneBalance, coinoneRecentCompleteOrders
  let korbitInfo, korbitOrderbook, korbitBalance, korbitRecentCompleteOrders
  let bithumbInfo, bithumbOrderbook, bithumbBalance, bithumbCompleteOrders
  let rsi
  try {
    // Act like Promise.all()
    // Less important in time domain
    const coinoneInfoPromise = COINONE ? fetcher.getCoinoneInfo(coinType) : "",
      korbitInfoPromise = KORBIT ? fetcher.getKorbitInfo(coinType) : "",
      bithumbInfoPromise = BITHUMB ? bithumbAPI({ type: "INFO", coinType: coinType }) : "",
      coinoneBalancePromise = COINONE ? fetcher.getCoinoneBalance() : "",
      korbitBalancePromise = KORBIT ? fetcher.getKorbitBalance() : "",
      bithumbBalancePromise = BITHUMB ? bithumbAPI({ type: "BALANCE" }) : ""

    if (COINONE) coinoneInfo = await coinoneInfoPromise
    if (KORBIT) korbitInfo = await korbitInfoPromise
    if (BITHUMB) bithumbInfo = await bithumbInfoPromise
    if (COINONE) coinoneBalance = await coinoneBalancePromise
    if (KORBIT) korbitBalance = await korbitBalancePromise
    if (BITHUMB) bithumbBalance = await bithumbBalancePromise

    rsi = await recentCompleteOrders.getRSI({
      coinType: coinType,
      marketName: COINONE ? "COINONE" : (KORBIT ? "KORBIT" : "BITHUMB"),
      periodInDay: 14,
      unitTimeInMin: 60 * 8
    })

    // console.log("Fetching some info takes", ((new Date() - TICK_STARTED) / 1000).toFixed(2), "sec")

    // More important in time domain //
    FETCH_STARTED = Date.now() / 1000 // in sec
    const coinoneOrderbookPromise = COINONE ? fetcher.getCoinoneOrderbook(coinType) : "",
      korbitOrderbookPromise = KORBIT ? fetcher.getKorbitOrderbook(coinType) : "",
      bithumbOrderbookPromise = BITHUMB ? bithumbAPI({
        type: "ORDERBOOK",
        coinType: coinType
      }) : ""
    if (COINONE) coinoneOrderbook = await coinoneOrderbookPromise
    if (KORBIT) korbitOrderbook = await korbitOrderbookPromise
    if (BITHUMB) bithumbOrderbook = await bithumbOrderbookPromise

  } catch (e) {
    // ignoreMoreRejectsFrom(coinoneInfoPromise, coinoneRecentCompleteOrdersPromise,
    //   korbitOrderbookPromise, coinoneOrderbookPromise,
    //   korbitBalancePromise, coinoneBalancePromise)
    console.log(e)
    throw new Error("[tick.js] Fail to fetch. Let me try again.")
  }
  /////// FETCHING END //////////
  
  
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
  const bithumb = {
    name: "BITHUMB",
    info: bithumbInfo,
    orderbook: bithumbOrderbook,
    balance: bithumbBalance
  }

  // Add only need market!
  const markets = []
  if (KORBIT) markets.push(korbit)
  if (COINONE) markets.push(coinone)
  if (BITHUMB) markets.push(bithumb)
      
  // Some data needs to go global
  global.rabbit.coinone = global.rabbit.coinone || {}
  if (COINONE){
    if (global.rabbit.coinone[coinType] 
      && global.rabbit.coinone[coinType].orderbook.bid[0].price == coinoneOrderbook.bid[0].price 
      && global.rabbit.coinone[coinType].orderbook.bid[0].qty == coinoneOrderbook.bid[0].qty
      && global.rabbit.coinone[coinType].orderbook.ask[0].price == coinoneOrderbook.ask[0].price
      && global.rabbit.coinone[coinType].orderbook.ask[0].qty == coinoneOrderbook.ask[0].qty){
      console.log(`COINONE is shit. it's the same orderbook with previous orderbook. Don't believe Coinone.`)
      return
    }
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
  global.rabbit.bithumb = global.rabbit.bithumb || {}
  if (BITHUMB) {
    global.rabbit.bithumb.balance = bithumbBalance
    global.rabbit.bithumb[coinType] = {
      name: "BITHUMB",
      info: bithumbInfo,
      orderbook: bithumbOrderbook
    }
  }


  // global.rabbit.markets = global.rabbit.markets || {}
  let totalCoin = COINONE ? coinoneBalance[coinType].balance : 0
  totalCoin += KORBIT ? korbitBalance[coinType].balance : 0
  totalCoin += BITHUMB ? bithumbBalance[coinType].balance : 0
  let lastPrice = COINONE ? coinoneInfo.last : (KORBIT ? korbitInfo.last : bithumbInfo)
  
  if (COINONE) console.log("-- In 24 hrs", coinoneInfo.volume, coinType, "traded at Coinone:", coinoneInfo.low, "~", coinoneInfo.high, ":", coinoneInfo.last, "(", ((coinoneInfo.last - coinoneInfo.low) / (coinoneInfo.high - coinoneInfo.low) * 100).toFixed(2), "% )----")
  console.log("coin:", (totalCoin).toFixed(2), coinType, "is now about \u20A9", new Intl.NumberFormat().format(((totalCoin) * lastPrice).toFixed(0)))
  if (COINONE) console.log("Coinone", coinType + ":", coinoneBalance[coinType].available.toFixed(3))
  if (KORBIT) console.log("Korbit ", coinType + ":", korbitBalance[coinType].available.toFixed(3))
  if (BITHUMB) console.log("Bithumb", coinType + ":", bithumbBalance[coinType].available.toFixed(3))
  if (COINONE) console.log("--(coinone", coinType + ")-----max bid:", coinoneOrderbook.bid[0], "min ask:", coinoneOrderbook.ask[0])
  if (KORBIT) console.log("--(korbit ", coinType + ")-----max bid:", korbitOrderbook.bid[0], "min ask:", korbitOrderbook.ask[0])
  if (BITHUMB) console.log("--(bithumb", coinType + ")-----max bid:", bithumbOrderbook.bid[0], "min ask:", bithumbOrderbook.ask[0])
  

  //// It's time sensitive ////
  const NOW = Date.now() / 1000 // in sec
  const FETCHING_TIME = NOW - FETCH_STARTED // sec
  console.log("Fetching All Orderbooks takes", FETCHING_TIME, "sec")
  if (FETCHING_TIME > 4.2) {
    console.log("Fetched too late. Don't buy when the market is busy. pass this tic. fetchingTime:", FETCHING_TIME)
    return
  }
  if (COINONE) {
    const ORDERBOOK_OLD = NOW - coinoneOrderbook.timestamp
    if (ORDERBOOK_OLD > 7.1) { // sec
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
  if (BITHUMB) {
    const ORDERBOOK_OLD = NOW - bithumbOrderbook.timestamp
    if (ORDERBOOK_OLD > 50) { // Unix timestamp in milliseconds of the last placed order.
      console.log("Bithumb orderbook is too old:", ORDERBOOK_OLD)
      return
    }
    if (ORDERBOOK_OLD < FETCHING_TIME) {
      console.log("Bithumb orderbook has been made after fetching.. But anyways..:", ORDERBOOK_OLD)
      // return
    }
  }

  
  //// Arbitrages ////
  let results = []
  if (global.rabbit.constants[coinType].ARBITRAGE_STARTED && global.rabbit.constants[coinType].MARKET.length >= 2){
    results = arbitrages.mind({
      coinType: coinType,
      markets: markets
    })  // results is Array
    // if (results.length == 2 ){
    //   results[0].tt = "ARBIT"
    //   results[1].tt = "ARBIT"
    // }
  }
  // results = []

  if (results.length != 2){
    console.log(`-- No arbitrages so mind machines -- `)

    const candles = recentCompleteOrders.getCandles({
      periodInDay: 0.05, // 1.2 hours
      unitTimeInMin: 3
    })
    console.log("candles length:", candles.length)
    for (let i = candles.length - 5; i < candles.length; i++)
      console.log("candle:", candles[i])

    if (candles[candles.length - 2].body == candles[candles.length - 1].body && candles[candles.length - 1] != "=") {
      console.log("Wait.. It looks like inclined. order won't be place")
      machines.presentation({
        coinType: coinType,
        orderbook: COINONE ? coinoneOrderbook : (KORBIT ? korbitOrderbook : bithumbOrderbook)
      })
      return
    }

    /////// TIME TO MIND ////////
    results = machines.mind({
      rsi: rsi,
      coinType: coinType,
      markets: markets
      // korbit: KORBIT ? korbit : coinone,
      // coinone: COINONE ? coinone : korbit
    })
  }
  // console.log("[tick.js]", machinesResult.participants.length, "machinesResult want to deal")
  console.log("[tick.js] machine's results", results)


  ///////  TIME TO ORDER //////
  for (let r of results)
    await orders.placeOrder(r)
  //
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
    orderbook: COINONE ? coinoneOrderbook : (KORBIT ? korbitOrderbook : bithumbOrderbook)
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