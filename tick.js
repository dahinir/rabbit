"use strict"

const marketAPIs = require('./marketAPIs.js');

console.log("\n\n[tick.js] Loaded!")

module.exports = async function (options) {
  const TICK_STARTED = new Date(),
    COUNT = options.count,
    coinType = options.coinType,
    MARKETS = global.rabbit.constants[coinType].MARKET,  // such as ["COINONE", "KORBIT"]


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
  const ticker = {}, balance = {}, orderbook = {}
  let rsi
  try {
    // Less important in time domain

    // Fetch ticker for all markets
    const tickerPromises = MARKETS.map(marketName => marketAPIs[marketName].fetchTicker(coinType + "/KRW"));
    const tickerResult = await Promise.all(tickerPromises)
    // the output is strictly ordered. `tickerResult`, `tickerPromises` and `MARKET`.
    for (let i = 0; i < MARKETS.length; i++) {
      ticker[MARKETS[i]] = tickerResult[i]
    }

    // Fetch balances for all markets
    const balancePromises = MARKETS.map(marketName => marketAPIs[marketName].fetchBalance());
    const balanceResult = await Promise.all(balancePromises);
    for (let i = 0; i < MARKETS.length; i++) {
      balance[MARKETS[i]] = balanceResult[i]
    }

    // RSI
    // rsi = await recentCompleteOrders.getRSI({
    //   coinType: coinType,
    //   marketName: COINONE ? "COINONE" : (KORBIT ? "KORBIT" : "BITHUMB"),
    //   periodInDay: 14,
    //   unitTimeInMin: 60 * 8
    // })
    rsi = 0

    // More important in time domain //
    FETCH_STARTED = Date.now() // in ms
    const orderbookPromises = MARKETS.map(marketName => marketAPIs[marketName].fetchOrderBook(coinType + "/KRW"))
    const orderbookResult = await Promise.all(orderbookPromises)
    for (let i = 0; i < MARKETS.length; i++) {
      orderbook[MARKETS[i]] = orderbookResult[i]
    }

  } catch (e) {
    // ignoreMoreRejectsFrom(coinoneInfoPromise, coinoneRecentCompleteOrdersPromise,
    //   korbitOrderbookPromise, coinoneOrderbookPromise,
    //   korbitBalancePromise, coinoneBalancePromise)
    console.log(e)
    throw new Error("[tick.js] Fail to fetch. Let me try again.")
  }
  /////// FETCHING END //////////


  const markets = []
  for (let i = 0; i < MARKETS.length; i++) {
    markets.push({
      name: MARKETS[i],
      orderbook: orderbook[MARKETS[i]],
      balance: balance[MARKETS[i]]
    })
  }

  // Just for shitty Coinone
  if (global.rabbit.constants[coinType].MARKET.indexOf("COINONE") >= 0 &&
    global.rabbit.coinone[coinType] &&
    global.rabbit.coinone[coinType].orderbook.bids[0][0] == orderbook["COINONE"].bids[0][0] &&
    global.rabbit.coinone[coinType].orderbook.bids[0][1] == orderbook["COINONE"].bids[0][1] &&
    global.rabbit.coinone[coinType].orderbook.asks[0][0] == orderbook["COINONE"].asks[0][0] &&
    global.rabbit.coinone[coinType].orderbook.asks[0][1] == orderbook["COINONE"].asks[0][1]) {
    console.log(global.rabbit.coinone[coinType].orderbook.bids[0][0])
    console.log(`** COINONE is shit. it's the same orderbook with previous orderbook. Don't believe Coinone.`)
    return
  }

  // Some data needs to go global
  for (let i = 0; i < MARKETS.length; i++) {
    // something like this `global.rabbit.coinone.balance`
    global.rabbit[MARKETS[i].toLowerCase()].balance = balance[MARKETS[i]]
    global.rabbit[MARKETS[i].toLowerCase()][coinType] = {
      name: MARKETS[i],
      orderbook: orderbook[MARKETS[i]]
    }
  }

  let totalCoin = 0
  for (let marketName in balance) {
    totalCoin += balance[marketName][coinType].total
  }
  const lastPrice = ticker[MARKETS[0]].last

  // print some info
  console.log("-- In 24 hrs", ticker[MARKETS[0]].baseVolume, coinType, "traded at Coinone:", ticker[MARKETS[0]].low, "~", ticker[MARKETS[0]].high, ":", ticker[MARKETS[0]].last, "(", ((ticker[MARKETS[0]].last - ticker[MARKETS[0]].low) / (ticker[MARKETS[0]].high - ticker[MARKETS[0]].low) * 100).toFixed(2), "% )----")
  console.log("coin:", (totalCoin).toFixed(2), coinType, "is now about \u20A9", new Intl.NumberFormat().format(((totalCoin) * lastPrice).toFixed(0)))
  for (let i = 0; i < MARKETS.length; i++)
    console.log(MARKETS[i], coinType, ":", balance[MARKETS[i]][coinType] ? balance[MARKETS[i]][coinType].total : 0)
  for (let i = 0; i < MARKETS.length; i++)
    console.log("--(", MARKETS[i], "\t", coinType + ")-----highest bid:", orderbook[MARKETS[i]].bids[0][0], "lowest ask:", orderbook[MARKETS[i]].asks[0][0])



  //// It's time sensitive ////
  const NOW = Date.now() // in ms
  const FETCHING_TIME = NOW - FETCH_STARTED // ms
  console.log("Fetching All Orderbooks takes", FETCHING_TIME / 1000, "sec")
  if (FETCHING_TIME > 4.2 * 1000) {
    console.log("Fetched too late. Don't buy when the market is busy. pass this tic. fetchingTime:", FETCHING_TIME)
    return
  }

  for (let i = 0; i < MARKETS.length; i++) {
    const orderbook_age = NOW - orderbook[MARKETS[i]].timestamp
    console.log(MARKETS[i], "orderbook age is", orderbook_age / 1000, "sec")
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


  ////// Time to Cancel a useless order ////
  await orders.cancel({
    coinType: coinType,
    lastPrice: lastPrice
  })


  ////// Presentation /////// 
  machines.presentation({
    coinType: coinType,
    orderbook: orderbook[MARKETS[0]]
  })
} // End of module.exports
