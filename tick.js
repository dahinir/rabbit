"use strict"

const _ = require('underscore'),
  fetcher = require('./fetcher.js'),
  bithumbAPI = require("./bithumb.js")
const marketAPIs = require('./marketAPIs.js');

console.log("\n\n[tick.js] Loaded!")

module.exports = async function (options) {
  const TICK_STARTED = new Date(),
    COUNT = options.count,
    coinType = options.coinType,
    MARKETS = global.rabbit.constants[coinType].MARKET,  // such as ["COINONE", "KORBIT"]
    KORBIT = (global.rabbit.constants[coinType].MARKET.indexOf("KORBIT") >= 0) ? true : false,
    COINONE = (global.rabbit.constants[coinType].MARKET.indexOf("COINONE") >= 0) ? true : false,
    BITHUMB = (global.rabbit.constants[coinType].MARKET.indexOf("BITHUMB") >= 0) ? true : false


  const arbitrages = options.arbitrages,
    machines = options.machines,
    orders = options.orders,
    recentCompleteOrders = options.recentCompleteOrders

  console.log("-- ", coinType, "Tick no.", COUNT, "with", machines.length, "machines. ",
    TICK_STARTED.toLocaleString(), "It's been", ((new Date() - global.rabbit.constants[coinType].STARTED) / 86400000).toFixed(1),
    "days. ", ((new Date() - global.rabbit.BORN) / 86400000).toFixed(1), "days old")


  //// Check previous orders out ////
  await orders.refresh({
    coinType: coinType
  })


  /////// FETCHING //////////
  let FETCH_STARTED = Infinity;
  let coinoneInfo, coinoneOrderbook, coinoneBalance, coinoneRecentCompleteOrders
  let korbitInfo, korbitOrderbook, korbitBalance, korbitRecentCompleteOrders
  let bithumbInfo, bithumbOrderbook, bithumbBalance, bithumbCompleteOrders
  let rsi
  try {
    // Act like Promise.all()
    // Less important in time domain

    // const coinoneInfoPromise = COINONE ? fetcher.getCoinoneInfo(coinType) : "",
    //   korbitInfoPromise = KORBIT ? fetcher.getKorbitInfo(coinType) : "",
    //   bithumbInfoPromise = BITHUMB ? bithumbAPI({
    //     type: "INFO",
    //     coinType: coinType
    //   }) : "",
    // const coinoneBalancePromise = COINONE ? fetcher.getCoinoneBalance() : "",
    //   korbitBalancePromise = KORBIT ? fetcher.getKorbitBalance() : "",
    //   bithumbBalancePromise = BITHUMB ? bithumbAPI({
    //     type: "BALANCE"
    //   }) : ""

    // if (COINONE) coinoneInfo = await coinoneInfoPromise
    // if (KORBIT) korbitInfo = await korbitInfoPromise
    // if (BITHUMB) bithumbInfo = await bithumbInfoPromise
    // if (COINONE) coinoneBalance = await coinoneBalancePromise
    // if (KORBIT) korbitBalance = await korbitBalancePromise
    // if (BITHUMB) bithumbBalance = await bithumbBalancePromise
    // let value = await Promise.all([coinoneInfoPromise, korbitInfoPromise, bithumbInfoPromise])

    // Fetch ticker for all markets
    const tickerPromises = MARKETS.map(marketName => marketAPIs[marketName].fetchTicker(coinType + "/KRW"));
    const tickerResult = await Promise.all(tickerPromises)
    // the output is strictly ordered. `tickerResult`, `tickerPromises` and `MARKET`.
    for (let i = 0; i < MARKETS.length; i++) {
      if (MARKETS[i] == "COINONE") coinoneInfo = tickerResult[i]
      else if (MARKETS[i] == "KORBIT") korbitInfo = tickerResult[i]
      else if (MARKETS[i] == "BITHUMB") bithumbInfo = tickerResult[i]
    }
    // console.log(korbitInfo)
    // console.log(bithumbInfo)

    // Fetch balances for all markets
    // console.log(coinoneBalance)
    const balancePromises = MARKETS.map(marketName => marketAPIs[marketName].fetchBalance());
    const balanceResult = await Promise.all(balancePromises);
    for (let i = 0; i < MARKETS.length; i++) {
      if (MARKETS[i] == "COINONE") coinoneBalance = balanceResult[i]
      else if (MARKETS[i] == "KORBIT") korbitBalance = balanceResult[i]
      else if (MARKETS[i] == "BITHUMB") bithumbBalance = balanceResult[i]
    }

    // RSI
    // rsi = await recentCompleteOrders.getRSI({
    //   coinType: coinType,
    //   marketName: COINONE ? "COINONE" : (KORBIT ? "KORBIT" : "BITHUMB"),
    //   periodInDay: 14,
    //   unitTimeInMin: 60 * 8
    // })
    rsi = 0

    // console.log("Fetching some info takes", ((new Date() - TICK_STARTED) / 1000).toFixed(2), "sec")

    // More important in time domain //
    FETCH_STARTED = Date.now() // in ms
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
    // info: korbitInfo,
    orderbook: korbitOrderbook,
    balance: korbitBalance
  }
  const coinone = {
    name: "COINONE",
    // info: coinoneInfo,
    orderbook: coinoneOrderbook,
    balance: coinoneBalance
  }
  const bithumb = {
    name: "BITHUMB",
    // info: bithumbInfo,
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
  if (COINONE) {
    if (global.rabbit.coinone[coinType] &&
      global.rabbit.coinone[coinType].orderbook.bid[0].price == coinoneOrderbook.bid[0].price &&
      global.rabbit.coinone[coinType].orderbook.bid[0].qty == coinoneOrderbook.bid[0].qty &&
      global.rabbit.coinone[coinType].orderbook.ask[0].price == coinoneOrderbook.ask[0].price &&
      global.rabbit.coinone[coinType].orderbook.ask[0].qty == coinoneOrderbook.ask[0].qty) {
      console.log(`COINONE is shit. it's the same orderbook with previous orderbook. Don't believe Coinone.`)
      return
    }
    global.rabbit.coinone.balance = coinoneBalance
    global.rabbit.coinone[coinType] = {
      name: "COINONE",
      // info: coinoneInfo,
      orderbook: coinoneOrderbook
    }
  }
  global.rabbit.korbit = global.rabbit.korbit || {}
  if (KORBIT) {
    global.rabbit.korbit.balance = korbitBalance
    global.rabbit.korbit[coinType] = {
      name: "KORBIT",
      // info: korbitInfo,
      orderbook: korbitOrderbook
    }
  }
  global.rabbit.bithumb = global.rabbit.bithumb || {}
  if (BITHUMB) {
    global.rabbit.bithumb.balance = bithumbBalance
    global.rabbit.bithumb[coinType] = {
      name: "BITHUMB",
      // info: bithumbInfo,
      orderbook: bithumbOrderbook
    }
  }

  // global.rabbit.markets = global.rabbit.markets || {}
  let totalCoin = COINONE ? coinoneBalance[coinType].total : 0
  totalCoin += KORBIT ? korbitBalance[coinType].total : 0
  totalCoin += BITHUMB ? bithumbBalance[coinType].total : 0
  let lastPrice = COINONE ? coinoneInfo.last : (KORBIT ? korbitInfo.last : bithumbInfo)

  if (COINONE) console.log("-- In 24 hrs", coinoneInfo.volume, coinType, "traded at Coinone:", coinoneInfo.low, "~", coinoneInfo.high, ":", coinoneInfo.last, "(", ((coinoneInfo.last - coinoneInfo.low) / (coinoneInfo.high - coinoneInfo.low) * 100).toFixed(2), "% )----")
  console.log("coin:", (totalCoin).toFixed(2), coinType, "is now about \u20A9", new Intl.NumberFormat().format(((totalCoin) * lastPrice).toFixed(0)))
  if (COINONE) console.log("Coinone", coinType + ":", coinoneBalance[coinType].total.toFixed(3))
  if (KORBIT) console.log("Korbit ", coinType + ":", korbitBalance[coinType].total.toFixed(3))
  if (BITHUMB) console.log("Bithumb", coinType + ":", bithumbBalance[coinType].total.toFixed(3))
  if (COINONE) console.log("--(coinone", coinType + ")-----max bid:", coinoneOrderbook.bid[0], "min ask:", coinoneOrderbook.ask[0])
  if (KORBIT) console.log("--(korbit ", coinType + ")-----max bid:", korbitOrderbook.bid[0], "min ask:", korbitOrderbook.ask[0])
  if (BITHUMB) console.log("--(bithumb", coinType + ")-----max bid:", bithumbOrderbook.bid[0], "min ask:", bithumbOrderbook.ask[0])


  //// It's time sensitive ////
  const NOW = Date.now() // in ms
  const FETCHING_TIME = NOW - FETCH_STARTED // ms
  console.log("Fetching All Orderbooks takes", FETCHING_TIME / 1000, "sec")
  if (FETCHING_TIME > 4.2 * 1000) {
    console.log("Fetched too late. Don't buy when the market is busy. pass this tic. fetchingTime:", FETCHING_TIME)
    return
  }
  if (COINONE) {
    const ORDERBOOK_OLD = NOW - coinoneOrderbook.timestamp
    if (ORDERBOOK_OLD > 7.1 * 1000) { // sec
      console.log("Coinone orderbook is too old:", ORDERBOOK_OLD)
      return
    }
    if (ORDERBOOK_OLD < FETCHING_TIME / 2) {
      console.log("Coinone orderbook has been made after fetching.. I can not belive it:", ORDERBOOK_OLD, FETCHING_TIME)
      console.log("Now coinone is insane, they're making future orderbook. so.. just ignore it..")
      // return
    }
  }
  if (KORBIT) {
    const ORDERBOOK_OLD = NOW - korbitOrderbook.timestamp
    if (ORDERBOOK_OLD > 60 * 1000) { // Unix timestamp in milliseconds of the last placed order.
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
    if (ORDERBOOK_OLD > 50 * 1000) { // Unix timestamp in milliseconds of the last placed order.
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
  if (global.rabbit.constants[coinType].ARBITRAGE_STARTED && global.rabbit.constants[coinType].MARKET.length >= 2) {
    results = arbitrages.mind({
      coinType: coinType,
      markets: markets
    }) // results is Array
    // if (results.length == 2 ){
    //   results[0].tt = "ARBIT"
    //   results[1].tt = "ARBIT"
    // }
  }
  // results = []

  if (results.length != 2) {
    console.log(`-- No arbitrages so mind machines -- `)

    /////// TIME TO MIND!! ////////
    // results = machines.mind({
    //   rsi: rsi,
    //   coinType: coinType,
    //   markets: markets
    // })
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

  ////// Presentation /////// 
  machines.presentation({
    coinType: coinType,
    orderbook: COINONE ? coinoneOrderbook : (KORBIT ? korbitOrderbook : bithumbOrderbook)
  })
} // End of module.exports



