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
    orders = options.orders
  // const machines = getMachines(coinType)
  // const orders = getOrders(coinType)

  console.log("-- ", coinType, "Tick no.", COUNT, "with", machines.length, "machines. ",
    TICK_STARTED.toLocaleString(), "It's been", ((new Date() - global.rabbit.constants[coinType].STARTED)/ 86400000).toFixed(1),
    "days. ", ((new Date() - global.rabbit.BORN) / 86400000).toFixed(1), "days old")

  // Check previous orders out
  // console.log("--refresh orders------")
  await orders.refresh()


  /////// FETCHING //////////
  let coinoneInfo, korbitInfo, fetchingTime = Infinity
  let coinoneOrderbook, coinoneBalance, coinoneRecentCompleteOrders
  let korbitOrderbook, korbitBalance
  try {
    // Act like Promise.all()
    // Less important in time domain
    const coinoneInfoPromise = COINONE ? fetcher.getCoinoneInfo(coinType) : "",
      korbitInfoPromise = KORBIT ? fetcher.getKorbitInfo(coinType) : "",
      coinoneBalancePromise = COINONE ? fetcher.getCoinoneBalance() : "",
      korbitBalancePromise = KORBIT ? fetcher.getKorbitBalance() : "",
      coinoneRecentCompleteOrdersPromise = COINONE ? fetcher.getCoinoneRecentCompleteOrders(coinType) : ""
    if (COINONE) coinoneInfo = await coinoneInfoPromise
    if (KORBIT) korbitInfo = await korbitInfoPromise
    if (COINONE) coinoneBalance = await coinoneBalancePromise
    if (KORBIT) korbitBalance = await korbitBalancePromise
    if (COINONE) coinoneRecentCompleteOrders = await coinoneRecentCompleteOrdersPromise
    // console.log("Fetching some info takes", ((new Date() - TICK_STARTED) / 1000).toFixed(2), "sec")

    // More important in time domain
    const FETCH_STARTED = new Date()
    const coinoneOrderbookPromise = COINONE ? fetcher.getCoinoneOrderbook(coinType) : "",
      korbitOrderbookPromise = KORBIT ? fetcher.getKorbitOrderbook(coinType) : ""
    if (COINONE) coinoneOrderbook = await coinoneOrderbookPromise
    if (KORBIT) korbitOrderbook = await korbitOrderbookPromise
    fetchingTime = ((new Date() - FETCH_STARTED) / 1000).toFixed(2) // sec
    console.log("Fetching Orderbooks takes", fetchingTime, "sec")
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
  global.rabbit.coinone.balance = coinoneBalance
  global.rabbit.coinone[coinType] = {
    name: "COINONE",
    info: coinoneInfo,
    orderbook: coinoneOrderbook
  }
  global.rabbit.korbit = global.rabbit.korbit || {}
  global.rabbit.korbit.balance = korbitBalance
  global.rabbit.korbit[coinType] = {
    name: "KORBIT",
    info: korbitInfo,
    orderbook: korbitOrderbook
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


  /////// TIME TO MIND ////////
  let results = []
  if (fetchingTime > 5.2) {
    console.log("Fetched too late. Don't buy when the market is busy. pass this tic. fetchingTime:", fetchingTime)
    return
  }

  // Arbitrages
  if (global.rabbit.constants[coinType].ARBITRAGE_STARTED && machines.length > 5000 && global.rabbit.constants[coinType].MARKET.length >= 1){
    results = arbitrages.mind({
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
  // isInclined(coinoneRecentCompleteOrders)
  // if (false) {
    console.log("-- No arbitrages so mind machines --")
    if (isInclined(coinoneRecentCompleteOrders)){
      console.log("Wait.. It looks like inclined")
      return
    }

    // let altKorbit = korbit,
    //   altCoinone = coinone
    // if (machines.length > 1000){
    //   const MINS = {
    //     "BTC": 0.1,
    //     "BCH": 0.5,
    //     "ETH": 2.0,
    //     "ETC": 50,
    //     "XRP": 1000
    //   }
    //   if (coinone.balance.KRW.available < 600000){
    //     console.log("[tick.js] not enough krw at coinone.")
    //     altCoinone = (korbit.orderbook.bid[0].price <= coinone.orderbook.bid[0].price) ? coinone : korbit
    //   }
    //   if (korbit.balance.KRW.available < 600000){
    //     console.log("[tick.js] not enough krw at korbit.")
    //     altKorbit = (coinone.orderbook.bid[0].price <= korbit.orderbook.bid[0].price) ? korbit : coinone
    //   }
    //   if (coinone.balance[coinType].available < MINS[coinType]){
    //     console.log("[tick.js] not enough",coinType ,"at coinone.")
    //     altCoinone = (korbit.orderbook.ask[0].price >= coinone.orderbook.ask[0].price) ? coinone : korbit
    //   }
    //   if (korbit.balance[coinType].available < MINS[coinType]){
    //     console.log("[tick.js] not enough",coinType ,"at korbit.")
    //     altKorbit = (coinone.orderbook.ask[0].price >= korbit.orderbook.ask[0].price) ? korbit : coinone
    //   }
    //   console.log("altCoinone:", altCoinone.name, "\taltKorbit:", altKorbit.name)
    //   if (altKorbit.name == "COINONE" && altCoinone.name == "KORBIT"){
    //     console.log("altCoinone is korbit, altKorbit is coinone. so pass this tick")
    //     // throw new Error("KILL_ME")
    //     return
    //   }
    // }

    results = machines.mind({
      coinType: coinType,
      // korbit: altKorbit,
      // coinone: altCoinone
      korbit: KORBIT ? korbit: coinone,
      coinone: coinone
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
    // coinType: coinType,
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

function isInclined(coinoneRecentCompleteOrders) {
  coinoneRecentCompleteOrders = coinoneRecentCompleteOrders.reverse()

  const lastTimestamp = coinoneRecentCompleteOrders[0].timestamp * 1
  const TERM = 60 * 3  // 3 mins
  // console.log(coinoneRecentCompleteOrders[0], coinoneRecentCompleteOrders[1])
  let candles = coinoneRecentCompleteOrders.reduce((candles, o) => {
    const index = Math.floor((lastTimestamp - (o.timestamp * 1)) / TERM)

    if (_.isArray(candles[index]))
      candles[index].push(o)
    else
      candles[index] = [o]
    return candles
  }, [])
  candles = candles.map(c => {
    const lastIndex = c.length - 1
    const open = c[lastIndex].price * 1,
      close = c[0].price * 1,
      volume = c.reduce((sum, el) => {
        return sum + el.qty * 1
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
  if (candles[0].open == candles[0].close)
    return false
  return (candles[0].body == candles[1].body) ? true : false
}