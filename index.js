"use strict"

const _ = require('underscore'),
    pify = require('pify');

// const xcoinAPI = require('./bithumb_modified.js');
const fetcher = require('./fetcher.js');

const Machine = require('./machine.js').Machine;
const Machines = require('./machine.js').Machines;
const Arbitrage = require('./machine.js').Arbitrage,
  Arbitrages = require('./machine.js').Arbitrages
const Order = require('./order.js').Order;
const Orders = require('./order.js').Orders;


let killSign = false
process.on('SIGINT', function() {
  console.log(": Kill sign submitted.");
  killSign = true
})

global.rabbit = {
    machines: new Machines(),
    arbitrages: new Arbitrages(),
    orders: new Orders()
}

// How many places after the decimal separator
global.rabbit.constants = {
  BTC: {
    PRECISION: 3,  // Actually It's 4. but I decided to use only 3 places after the decimal
    MIN_KRW_UNIT: 500,  // Minimum unit of KRW
    ADDITIONAL_BUY_AT: 500, // using within mind()
    PREVIOUS_PROFIT_SUM: 0,
    BORN: new Date('November 17, 2017 14:45:00'), // 1 btc == 8,740,500 krw
    STARTED: new Date('November 17, 2017 14:45:00') 
  },
  BCH: {
    PRECISION: 2,
    MIN_KRW_UNIT: 500,
    ADDITIONAL_BUY_AT: 500, // using within mind(), Set as 900 for full sampling at Coinone
    PREVIOUS_PROFIT_SUM: 0,
    BORN: new Date('November 17, 2017 16:45:00'), // 1 bch == 1,291,000 krw
    STARTED: new Date('November 17, 2017 16:45:00')
  },
  ETH: {
    PRECISION: 2,
    MIN_KRW_UNIT: 50,
    ADDITIONAL_BUY_AT: 50,
    PREVIOUS_PROFIT_SUM: 49752085,
    BORN: new Date('July 4, 2017 13:20:00'),  // 1 eth == 337,500 krw
    STARTED: new Date('September 22, 2017 11:00:00'), // 1 eth == 300,000 krw
    ARBITRAGE_STARTED: new Date('July 26, 2017 13:20:00'),
    MACHINE_SETTING: {
      CAPACITY: 0.01,
      MIN_CRAVING_PERCENTAGE: 2
    }
  },
  ETC: {
    PRECISION: 1,
    MIN_KRW_UNIT: 10,
    ADDITIONAL_BUY_AT: 0, // ETC doesn't need
    PREVIOUS_PROFIT_SUM: 0,
    BORN: new Date('November 18, 2017 13:10:00'), // 1 etc == 19,190 krw
    STARTED: new Date('November 18, 2017 13:10:00')
  },
  XRP:{
    PRECISION: 0,
    MIN_KRW_UNIT: 1,
    ADDITIONAL_BUY_AT: 0,
    PREVIOUS_PROFIT_SUM: 0,
    BORN: new Date('November 18, 2017 13:35:00'), // 1 xrp == 247 krw
    STARTED: new Date('November 18, 2017 13:35:00')
  }
}
global.rabbit.INVESTED_KRW = 110000000
global.rabbit.BORN = new Date('July 4, 2017 13:20:00')


// Fetch all machines and orders from db
global.rabbit.machines.fetchAll({
  success: function() {
    global.rabbit.arbitrages.fetch({
      data: {
        status: "PENDING",
        pend_count: 2
      },
      success: function(){
        global.rabbit.orders.fetch({
          data: {
            status: "OPEN"
            // $skip: 10,
            // $limit: 10
          },
          success: function() {
            console.log("===DB LOADED======================")
              console.log("[index.js] ", global.rabbit.machines.length, "machines are loaded.");
              console.log("[index.js] ", global.rabbit.arbitrages.length, "arbitrages are loaded.")
              console.log("[index.js] ", global.rabbit.orders.length, "OPEN orders are loaded.");

              // if (global.rabbit.machines.length != 70000)
              //   throw new Error("How many machines do you have?")

              // Attach machines as participants
              global.rabbit.orders.each(order => {
                let participants = []

                for (let mId of order.get("machineIds")){
                  let m = global.rabbit.machines.get(mId)
                  if(_.isUndefined(m)){
                    m = global.rabbit.arbitrages.get(mId)
                    if(_.isUndefined(m)){
                      console.log("undefined machine! order.attributes:", order.attributes)
                      throw new Error("wtf")
                    }
                  }
                  // console.log(mId)
                  // console.log(m.attributes)
                  participants.push(m)
                }

                if (order.get("machineIds").length == participants.length){
                  console.log("orderId:" ,order.get("orderId"), "got participants properly!")
                  order.participants = participants
                }else{
                  console.log("---order got problem-----")
                  console.log(participants)
                  console.log(order.attributes)
                  throw new Error("Order's participants got problem")
                }

                console.log("added to order participants:", participants.length)
              })

              // Attach orders to arbitrages
              global.rabbit.arbitrages.each(a => {
                const orders = [] // will be attaced

                a.get("orderIds").map(orderId => {
                  // console.log("orderId:", orderId)
                  const order = global.rabbit.orders.findWhere({orderId: orderId})
                  if (order)
                    orders.push(order)
                  // console.log(order.attributes)
                })
                // console.log(orders.length)
                if (orders.length + a.get("traded_count") == 2){
                  console.log("arbitrage id", a.id, "have the", orders.length, "orders", a.get("traded_count") ,"traded_count properly")
                  a.orders = orders
                } else{
                  console.log("Why the orders ain't two? arbitrage.attributes:", a.attributes)
                  throw new Error("arbitrage id", a.id, "does not have 2 orders")
                }
              })

              // Rollback machine that is PENDING but does not belongs to any order
              async function rollbackMachines() {
                const realPendingMachineIds = global.rabbit.orders.models.reduce((acc, o) => {
                  // console.log(acc, o)
                  return acc.concat(o.get("machineIds"))
                }, [])
                console.log("pended machine ids:", realPendingMachineIds)
                let rollbackedMachineIds = [], realPendingMachineCount = 0

                for (let m of global.rabbit.machines.models){
                  if (m.get("status") == "PENDING"){
                    if (realPendingMachineIds.includes(m.id)){
                      realPendingMachineCount++
                    }else{
                      await m.rollback()
                      rollbackedMachineIds.push(m.id)
                    }
                  }
                }
                return rollbackedMachineIds
              }
              rollbackMachines().then(mIds => {
                if (mIds.length > 0){
                  console.log("There're machines that was pended but doesn't have an order. Check it out", mIds.length, mIds)
                  return
                }else{
                  // Run rabbit. Don't look back.
                  run()
                }
              })
          }
        })  // End of orders.fetch()
      }
    })  // End of arbitrages.fetch()
  }
})


// const runningCoinType = ["BTC", "BCH", "ETH", "ETC", "XRP"],  // It's gonna be tick order.
const runningCoinType = ["ETH"],
  MIN_TERM = 10000,  // ms ..minimum I think 2700~2900 ms
  ERROR_BUFFER = 60000  // A minute
let count = -1

async function run() {
  count++
  const startTime = new Date()
  const coinType = runningCoinType[count % runningCoinType.length]
  
  try {
    // Korbit is an idiot //
    await require("./korbit.js")({type: "REFRESH_TOKEN"})

    // HERE BABE HERE IT IS //
    await require("./tick.js")({
      coinType: coinType,
      count: count
    })
    
  } catch (e) {
    console.log("[index.js] Tick've got error!")
    // e.message ? console.log(e.message): console.log(e)
    console.log(e)

    if (e && e.message == "KILL_ME")
      killSign = true
  } finally {

    // killSign = true
    if (killSign){
      console.log("Rabbit is stopped by killSign. Gracefully maybe.")
      process.exit(0);
      return
    }else{
      const BREAK_TIME = MIN_TERM - (new Date() - startTime)
      // console.log("-- takes", (new Date() -startTime)/1000,"sec, so", BREAK_TIME,"ms later --------------------\n\n")
      console.log(`-- takes ${(new Date() - startTime) / 1000} sec, so ${BREAK_TIME} ms later --------------------\n\n`)


      // PRESENTATION //
      // if (false){
      if (coinType == runningCoinType[runningCoinType.length - 1]) {
        console.log("--PRESENTATION of \u20A9", new Intl.NumberFormat().format(global.rabbit.INVESTED_KRW), "--")

        const days = ((new Date() - global.rabbit.BORN) / 86400000),
          korbitBalance = global.rabbit.korbit.balance,
          coinoneBalance = global.rabbit.coinone.balance,
          korbit = global.rabbit.korbit,
          coinone = global.rabbit.coinone
        let profitSum = 0,
          balanceSum = korbitBalance.KRW.balance + coinoneBalance.KRW.balance

        for (const ct of runningCoinType) {
          balanceSum += korbitBalance[ct].balance * korbit[ct].orderbook.bid[0].price
            + coinoneBalance[ct].balance * coinone[ct].orderbook.bid[0].price
          const profit = global.rabbit.constants[ct].profit_krw_sum || 0
          const damage = global.rabbit.constants[ct].krw_damage || 0
          console.log(ct, "machines maid: \u20A9", new Intl.NumberFormat().format(profit), "\t\u20A9", new Intl.NumberFormat().format(-damage))
          profitSum += profit
        }

        console.log("IN CASH: \u20A9", new Intl.NumberFormat().format(korbitBalance.KRW.balance + coinoneBalance.KRW.balance),
          "\t( Coinone:", new Intl.NumberFormat().format(coinoneBalance.KRW.balance),
          "  Korbit:", new Intl.NumberFormat().format(korbitBalance.KRW.balance), ")")
        console.log("SUMMARY: \u20A9", new Intl.NumberFormat().format(balanceSum.toFixed(0)), 
          "\tRabbit maid \u20A9", new Intl.NumberFormat().format((profitSum).toFixed(0)), "..so \u20A9", new Intl.NumberFormat().format((profitSum / days).toFixed(0)), "per day")
        console.log("\n")
      }

      // One more time //
      setTimeout(run, BREAK_TIME)
    }
  }
}
