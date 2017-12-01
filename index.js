"use strict"

const _ = require('underscore'),
    pify = require('pify');

// const xcoinAPI = require('./bithumb_modified.js');
const fetcher = require('./fetcher.js');

const Machine = require('./machine.js').Machine,
  Machines = require('./machine.js').Machines,
  Arbitrage = require('./machine.js').Arbitrage,
  Arbitrages = require('./machine.js').Arbitrages,
  Order = require('./order.js').Order,
  Orders = require('./order.js').Orders


let killSign = false
process.on('SIGINT', function() {
  console.log(": Kill sign submitted.");
  killSign = true
})

global.rabbit = {}

///// MOVE TO .JSON /////
// db.machines.updateMany({coinType:"ETH", craving_percentage: 4, status:"KRW"}, {$set:{capacity: 0.18}})
// db.machines.findOne({craving_krw: 6000, status:"KRW", capacity: {$ne: 0.01}})
global.rabbit.constants = {
  BTC: {
    MARKET: ["COINONE", "KORBIT"],
    PRECISION: 3,  // How many places after the decimal separator
    MIN_KRW_UNIT: 500,  // Minimum unit of KRW
    BUY_AT_UNIT: 10000, // Snap to 10000
    PREVIOUS_HIGH_PRICE: 13500000, // Infinity 
    PREVIOUS_PROFIT_SUM: 0,
    PREVIOUS_PROFIT_RATE_EACH_CRAVING: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    PREVIOUS_TRADED_COUNT_EACH_CRAVING: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    BORN: new Date('November 26, 2017 22:25:00'), // 10,132,000 krw
    STARTED: new Date('November 26, 2017 22:25:00'),
    ARBITRAGE_STARTED: new Date('November 27, 2017 15:50:00'),
    MACHINE_SETTING: {
      CAPACITY_EACH_CRAVING: [0.001, 0.001, 0.003, 0.003, 0.002, 0.001, 0.001, 0.001, 0.001, 0.001],
      MIN_CRAVING_PERCENTAGE: 3
    } 
  },
  BCH: {
    MARKET: ["COINONE", "KORBIT"],
    PRECISION: 2,
    MIN_KRW_UNIT: 500,
    BUY_AT_UNIT: 10000,
    PREVIOUS_HIGH_PRICE: 1958500,
    PREVIOUS_PROFIT_SUM: 0,
    PREVIOUS_PROFIT_RATE_EACH_CRAVING: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    PREVIOUS_TRADED_COUNT_EACH_CRAVING: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    BORN: new Date('November 26, 2017 22:25:00'), // 1,769,100 krw
    STARTED: new Date('November 26, 2017 22:25:00'),
    ARBITRAGE_STARTED: new Date('November 27, 2017 15:50:00'),
    MACHINE_SETTING: {
      CAPACITY_EACH_CRAVING: [0.01, 0.02, 0.02, 0.02, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01],
      MIN_CRAVING_PERCENTAGE: 3
    }
  },
  BTG: {
  },
  ETH: {
    MARKET: ["COINONE", "KORBIT"],
    PRECISION: 2,
    MIN_KRW_UNIT: 50,
    BUY_AT_UNIT: 1000,
    PREVIOUS_HIGH_PRICE: 611500,
    PREVIOUS_PROFIT_SUM: 0, // 68,000,000? 49752085,
    PREVIOUS_PROFIT_RATE_EACH_CRAVING: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    PREVIOUS_TRADED_COUNT_EACH_CRAVING: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    BORN: new Date('July 4, 2017 13:20:00'),  // 519,000 krw
    STARTED: new Date('November 26, 2017 22:25:00'),
    ARBITRAGE_STARTED: new Date('July 26, 2017 13:20:00'),
    MACHINE_SETTING: {
      CAPACITY_EACH_CRAVING: [0.01, 0.03, 0.08, 0.09, 0.07, 0.05, 0.03, 0.02, 0.02, 0.02],
      MIN_CRAVING_PERCENTAGE: 2
    }
  },
  ETC: {
    MARKET: ["COINONE", "KORBIT"],
    PRECISION: 1,
    MIN_KRW_UNIT: 10,
    BUY_AT_UNIT: 100,
    PREVIOUS_HIGH_PRICE: 39490,
    PREVIOUS_PROFIT_SUM: 0,
    PREVIOUS_PROFIT_RATE_EACH_CRAVING: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    PREVIOUS_TRADED_COUNT_EACH_CRAVING: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    BORN: new Date('November 26, 2017 22:25:00'), // 24,440 krw
    STARTED: new Date('November 26, 2017 22:25:00'),
    ARBITRAGE_STARTED: new Date('November 27, 2017 15:50:00'),
    MACHINE_SETTING: {
      CAPACITY_EACH_CRAVING: [0.1, 0.2, 0.3, 0.3, 0.5, 0.7, 0.6, 0.3, 0.2, 0.1],
      MIN_CRAVING_PERCENTAGE: 2
    }
  },
  XRP:{
    MARKET: ["COINONE", "KORBIT"],
    PRECISION: 0,
    MIN_KRW_UNIT: 1,
    BUY_AT_UNIT: 1,
    PREVIOUS_HIGH_PRICE: 339,
    PREVIOUS_PROFIT_SUM: 0,
    PREVIOUS_PROFIT_RATE_EACH_CRAVING: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    PREVIOUS_TRADED_COUNT_EACH_CRAVING: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    BORN: new Date('November 26, 2017 22:25:00'), // 278 krw
    STARTED: new Date('November 26, 2017 22:25:00'),
    ARBITRAGE_STARTED: new Date('November 27, 2017 15:50:00'),
    MACHINE_SETTING: {
      CAPACITY_EACH_CRAVING: [10, 20, 20, 20, 20, 20, 10, 10, 10, 10],
      MIN_CRAVING_PERCENTAGE: 2
    }
  },
  QTUM: {
    MARKET: ["COINONE"],
    PRECISION: 1,
    MIN_KRW_UNIT: 10,
    BUY_AT_UNIT: 100,
    PREVIOUS_HIGH_PRICE: 22000,
    PREVIOUS_PROFIT_SUM: 0,
    PREVIOUS_PROFIT_RATE_EACH_CRAVING: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    PREVIOUS_TRADED_COUNT_EACH_CRAVING: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    BORN: new Date('November 26, 2017 22:25:00'),  // 16,110 krw
    STARTED: new Date('November 26, 2017 22:25:00'),
    MACHINE_SETTING: {
      CAPACITY_EACH_CRAVING: [0.2, 0.2, 0.3, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2],
      MIN_CRAVING_PERCENTAGE: 2
    }
  },
  LTC: {
    MARKET: ["COINONE"],
    PRECISION: 1,
    MIN_KRW_UNIT: 50,
    BUY_AT_UNIT: 1000,
    PREVIOUS_HIGH_PRICE: 135550,
    PREVIOUS_PROFIT_SUM: 0,
    PREVIOUS_PROFIT_RATE_EACH_CRAVING: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    PREVIOUS_TRADED_COUNT_EACH_CRAVING: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    BORN: new Date('November 26, 2017 22:25:00'),  // 96,400 krw
    STARTED: new Date('November 26, 2017 22:25:00'),
    MACHINE_SETTING: {
      CAPACITY_EACH_CRAVING: [0.1, 0.2, 0.2, 0.3, 0.3, 0.3, 0.2, 0.1, 0.1, 0.1],
      MIN_CRAVING_PERCENTAGE: 3
    }
  },
  IOTA: {
    MARKET: ["COINONE"],
    PRECISION: 0,
    MIN_KRW_UNIT: 1,
    BUY_AT_UNIT: 10,
    PREVIOUS_HIGH_PRICE: 1935,
    PREVIOUS_PROFIT_SUM: 0,
    PREVIOUS_PROFIT_RATE_EACH_CRAVING: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    PREVIOUS_TRADED_COUNT_EACH_CRAVING: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    BORN: new Date('November 30, 2017 00:53:00'),  // 1,785 krw
    STARTED: new Date('November 30, 2017 00:53:00'),
    MACHINE_SETTING: {
      CAPACITY_EACH_CRAVING: [2, 3, 3, 5, 5, 3, 3, 3, 2, 2],
      MIN_CRAVING_PERCENTAGE: 5
    }
  }
}
global.rabbit.INVESTED_KRW = 130000000
global.rabbit.BORN = new Date('July 4, 2017 13:20:00')




// For loading from DB
const arbitrages = new Arbitrages(),
  machines = new Machines(),
  orders = new Orders()

// Fetch all machines and orders from DB
machines.fetchAll({
  success: function() {
    arbitrages.fetch({
      data: {
        status: "PENDING",
        pend_count: 2
      },
      success: function(){
        orders.fetch({
          data: {
            status: "OPEN"
            // $skip: 10,
            // $limit: 10
          },
          success: function() {
            console.log("===DB LOADED======================")
              console.log("[index.js] ", machines.length, "machines are loaded.");
              console.log("[index.js] ", arbitrages.length, "arbitrages are loaded.")
              console.log("[index.js] ", orders.length, "OPEN orders are loaded.");

              // if (machines.length != 70000)
              //   throw new Error("How many machines do you have?")

              // Attach machines as participants
              orders.each(order => {
                let participants = []

                for (let mId of order.get("machineIds")){
                  let m = machines.get(mId)
                  if(_.isUndefined(m)){
                    m = arbitrages.get(mId)
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
              arbitrages.each(a => {
                a.orders = [] // will be attaced

                a.get("orderIds").map(orderId => {
                  const o = orders.findWhere({orderId: orderId})
                  if (o) a.orders.push(o)
                })

                if (a.orders.length + a.get("traded_count") == 2){
                  console.log("arbitrage id", a.id, "have the", a.orders.length, "orders", a.get("traded_count") ,"traded_count properly")
                } else{
                  console.log("Why the orders ain't two? arbitrage.attributes:", a.attributes)
                  throw new Error("arbitrage id", a.id, "does not have 2 orders")
                }
              })

              // Rollback machine that is PENDING but does not belongs to any order
              async function rollbackMachines() {
                const realPendingMachineIds = orders.models.reduce((acc, o) => {
                  // console.log(acc, o)
                  return acc.concat(o.get("machineIds"))
                }, [])
                console.log("pended machine ids:", realPendingMachineIds)
                let rollbackedMachineIds = [], realPendingMachineCount = 0

                for (let m of machines.models){
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


const runningCoinType = ["BTC", "BCH", "ETH", "ETC", "XRP", "QTUM", "LTC", "IOTA"],  // It's gonna be tick order.
  MIN_TERM = 6000,  // ms ..minimum I think 2700~2900 ms
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
      arbitrages: getArbitrages(coinType),
      machines: getMachines(coinType),
      orders: getOrders(coinType),
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
          const KORBIT = (global.rabbit.constants[ct].MARKET.indexOf("KORBIT") >= 0) ? true : false,
            COINONE = (global.rabbit.constants[ct].MARKET.indexOf("COINONE") >= 0) ? true : false

          balanceSum += KORBIT ? korbitBalance[ct].balance * korbit[ct].orderbook.bid[0].price : 0
          balanceSum += COINONE ? coinoneBalance[ct].balance * coinone[ct].orderbook.bid[0].price : 0
          const profit = global.rabbit.constants[ct].profit_krw_sum || 0
          const damage = global.rabbit.constants[ct].krw_damage || 0
          console.log(ct, "machines maid: \u20A9", new Intl.NumberFormat().format(profit), "\t\u20A9", new Intl.NumberFormat().format(-damage))
          profitSum += profit
        }

        profitSum += 68000000 // Previous profitSum
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



///// HELPER FUNCTIONS ////
const machinesChamber = {}
function getMachines(coinType) {
  if (!machinesChamber[coinType]) {
    console.log("MachinesChamber created. This is first tic of", coinType, "IF IT'S NOT, IT'S A PROBLEM. STOP THIS SHIT!")
    machinesChamber[coinType] = new Machines(machines.where({ coinType: coinType }))
  }
  return machinesChamber[coinType]
}

const arbitragesChamber = {}
function getArbitrages(coinType) {
  if (!arbitragesChamber[coinType]) {
    console.log("ArbitragesChamber created. This is first tic of", coinType, "IF IT'S NOT, IT'S A PROBLEM. STOP THIS SHIT!")
    arbitragesChamber[coinType] = new Arbitrages(arbitrages.where({ coinType: coinType }))
  }
  return arbitragesChamber[coinType]
}

const ordersChamber = {}
function getOrders(coinType) {
  if (!ordersChamber[coinType])
    ordersChamber[coinType] = new Orders(orders.filter(o => o.get("coinType") == coinType))
  return ordersChamber[coinType]
}