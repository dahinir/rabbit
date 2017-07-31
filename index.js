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

global.rabbit.STARTED = new Date('July 4, 2017 13:20:00')
global.rabbit.ARBITRAGE_STARTED = new Date('July 26, 2017 13:20:00')


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
              console.log("[index.js] ", global.rabbit.machines.length, "machines are loaded.");
              console.log("[index.js] ", global.rabbit.arbitrages.length, "arbitrages are loaded.")
              console.log("[index.js] ", global.rabbit.orders.length, "OPEN orders are loaded.");
              console.log("===start======================")

              if (global.rabbit.machines.length != 60000)
                throw new Error("How many machines do you have?")

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

              // Run rabbit, Don't look back.
              run();
          }
        })  // End of orders.fetch()
      }
    })  // End of arbitrages.fetch()
  }
})

const MIN_TERM = 2700,  // ms
  ERROR_BUFFER = 60000  // A minute
async function run() {
  const startTime = new Date()

  try {
    // Korbit is an idiot
    await require("./korbit.js")({type: "REFRESH_TOKEN"})

    // HERE BABE HERE IT IS
    await require("./tick.js")()

  } catch (e) {
    console.log("[index.js] Tick've got error!")
    // e.message ? console.log(e.message): console.log(e)
    console.log(e)

    if (e && e.message == "KILL_ME")
      killSign = true
    // killSign = true
  } finally {

    if (killSign){
      console.log("Rabbit is stopped by killSign. Gracefully maybe.")
      return
    }else{
      const BREAK_TIME = MIN_TERM - (new Date() - startTime)
      console.log("-- takes", (new Date() -startTime)/1000,"sec, so", BREAK_TIME,"ms later --------------------\n")
      // One more time
      setTimeout(run, BREAK_TIME)
    }
  }
}
