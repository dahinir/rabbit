"use strict"

const _ = require('underscore'),
 fetcher = require('./fetcher.js'),
 Machines = require("./machine").Machines,
  Orders = require('./order.js').Orders,
 Arbitrages = require('./machine.js').Arbitrages

console.log("\n\n[tick.js] Loaded!")

// const machines = new Machines(global.rabbit.machines.filter(m => {
//   if (m.get("buy_at") >= 300000 && m.get("buy_at") < 500000)
//     return true
//   else
//     return false
// }))
// const orders = global.rabbit.orders
const arbitrages = global.rabbit.arbitrages

const machinesChamber = {}
function getMachines(coinType){
  if (!machinesChamber[coinType]){
    console.log("This is first tic of", coinType, "IF IT'S NOT, IT'S A PROBLEM. STOP THIS SHIT!")
    machinesChamber[coinType] = new Machines(global.rabbit.machines.filter(m => {
      if (coinType == "ETH"){
        if (m.get("coinType") == coinType && m.get("buy_at") >= 300000 && m.get("buy_at") < 500000)
          return true
        else
          return false
      }else{
        if (m.get("coinType") == coinType)
          return true
        else
          return false
      }
    }))
  }
    // console.log("1",machinesChamber[coinType].models.length)
    // console.log("2",machinesChamber[coinType].length)
  // console.log("3", machinesChamber[coinType].at(0).attributes)
    // console.log("4", [1,2,3,4,5].at(0))
  // if (!machinesChamber[coinType])
  //   machinesChamber[coinType] = new Machines(global.rabbit.machines.filter(m => (m.get("coinType") == coinType && m.get("buy_at") >= 300000 && m.get("buy_at") < 500000)))

  return machinesChamber[coinType]
}

const ordersChamber = {}
function getOrders(coinType){
  if (!ordersChamber[coinType])
    ordersChamber[coinType] = new Orders(global.rabbit.orders.filter(o => o.get("coinType") == coinType))
  return ordersChamber[coinType]
}


module.exports = async function(options){
  const startTime = new Date()
  const count = options.count
  const coinType = options.coinType
 
  const machines = getMachines(coinType)
  const orders = getOrders(coinType)

  console.log("-- ", coinType, "Tick no.", count, "with", machines.length, "machines. ",
    startTime.toLocaleString(), "It's been", ((new Date() - global.rabbit.constants[coinType].STARTED)/ 86400000).toFixed(1),
    "days. ", ((new Date() - global.rabbit.BORN) / 86400000).toFixed(1), "days old")

  // Check previous orders out
  // console.log("--refresh orders------")
  await orders.refresh()


  /////// FETCHING //////////
  let coinoneInfo, coinoneOrderbook, coinoneBalance, coinoneRecentCompleteOrders
  let korbitInfo, korbitOrderbook, korbitBalance
  try {
    // Act like Promise.all() 
    const coinoneBalancePromise = fetcher.getCoinoneBalance(),
      coinoneInfoPromise = fetcher.getCoinoneInfo(coinType),
      coinoneOrderbookPromise = fetcher.getCoinoneOrderbook(coinType),
      coinoneRecentCompleteOrdersPromise = fetcher.getCoinoneRecentCompleteOrders(coinType)
    const korbitBalancePromise = fetcher.getKorbitBalance(),
      korbitOrderbookPromise = fetcher.getKorbitOrderbook(coinType),
      korbitInfoPromise = fetcher.getKorbitInfo(coinType)

    coinoneInfo = await coinoneInfoPromise
    coinoneOrderbook = await coinoneOrderbookPromise
    coinoneBalance = await coinoneBalancePromise
    coinoneRecentCompleteOrders = await coinoneRecentCompleteOrdersPromise
    korbitInfo = await korbitInfoPromise
    korbitOrderbook = await korbitOrderbookPromise
    korbitBalance = await korbitBalancePromise
  } catch (e) {
    // ignoreMoreRejectsFrom(coinoneInfoPromise, coinoneRecentCompleteOrdersPromise,
    //   korbitOrderbookPromise, coinoneOrderbookPromise,
    //   korbitBalancePromise, coinoneBalancePromise)
    console.log(e)
    throw new Error("[tick.js] Fail to fetch. Let me try again.")
  }

  const fetchingTime = ((new Date() - startTime) / 1000).toFixed(2) // sec
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
  // global.rabbit.coinone = coinone
  // global.rabbit.korbit = korbit
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

  
  console.log("--In 24hrs at Coinone", coinType, ":", coinoneInfo.low, "~", coinoneInfo.high, ":", coinoneInfo.last,"(",
    ((coinoneInfo.last - coinoneInfo.low) / (coinoneInfo.high - coinoneInfo.low)*100).toFixed(2),"% )----" )
  console.log("All fetchers've take", fetchingTime, "sec")
  console.log("coin:", (korbitBalance[coinType].balance + coinoneBalance[coinType].balance).toFixed(2), coinType,
    "== \u20A9", new Intl.NumberFormat().format(((korbitBalance[coinType].balance + coinoneBalance[coinType].balance) * coinoneOrderbook.bid[0].price).toFixed(0)))
  console.log("Coinone", coinType + ":", coinoneBalance[coinType].available.toFixed(2), "\tkrw:", new Intl.NumberFormat().format(coinoneBalance.KRW.available))
  console.log("Korbit", coinType + ":", korbitBalance[coinType].available.toFixed(2), "\tkrw:", new Intl.NumberFormat().format(korbitBalance.KRW.available))
  console.log("--(coinone", coinType + ")-----max bid:", coinoneOrderbook.bid[0], "min ask:", coinoneOrderbook.ask[0])
  console.log("--(korbit", coinType + ")------max bid:", korbitOrderbook.bid[0], "min ask:", korbitOrderbook.ask[0])
  console.log("Coinone", coinType, "volume:", coinoneInfo.volume, " Korbit", coinType, "volume:", korbitInfo.volume)


  /////// TIME TO MIND ////////
  let results = []
  if (fetchingTime > 5.2) {
    console.log("Fetched too late. Don't buy when the market is busy. pass this tic. fetchingTime:", fetchingTime)
    return
  }

  // Arbitrages
  if (coinType == "ETH"){
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

    let altKorbit = korbit,
      altCoinone = coinone
    const MINS = {
      "BTC": 0.1,
      "BCH": 0.5,
      "ETH": 2.0,
      "ETC": 50,
      "XRP": 1000
    }
    if (coinone.balance.KRW.available < 600000){
      console.log("[tick.js] not enough krw at coinone.")
      altCoinone = (korbit.orderbook.bid[0].price < coinone.orderbook.bid[0].price) ? coinone : korbit
    }
    if (korbit.balance.KRW.available < 600000){
      console.log("[tick.js] not enough krw at korbit.")
      altKorbit = (coinone.orderbook.bid[0].price < korbit.orderbook.bid[0].price) ? korbit : coinone
    }
    if (coinone.balance[coinType].available < MINS[coinType]){
      console.log("[tick.js] not enough",coinType ,"at coinone.")
      altCoinone = (korbit.orderbook.ask[0].price > coinone.orderbook.ask[0].price) ? coinone : korbit
    }
    if (korbit.balance[coinType].available < MINS[coinType]){
      console.log("[tick.js] not enough",coinType ,"at korbit.")
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



  ////// Presentation ///////
  global.rabbit.machines.presentation({
    orderbook: coinoneOrderbook,
    coinType: coinType
  })
  // await global.rabbit.arbitrages.presentation()
} // End of module.exports




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
  // console.log("All fetchers've take", fetchingTime, "sec", candles.length)
  return (candles[0].body == candles[1].body) ? true : false
}