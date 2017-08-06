"use strict"
const xcoinAPI = require('./bithumb_modified.js'),
    coinoneAPI = require("./coinone.js"),
    korbitAPI = require("./korbit.js"),
    fetcher = require('./fetcher.js'),
    Order = require('./order.js').Order,
    Orders = require('./order.js').Orders,
    Machine = require('./machine.js').Machine,
    Machines = require('./machine.js').Machines,
    Arbitrage = require('./machine.js').Arbitrage,
    Arbitrages = require('./machine.js').Arbitrages,
    _ = require('underscore'),
    fs = require('fs'),
    moment = require('moment'),
    brain = require('brain.js')

const arbitrages = new Arbitrages()
arbitrages.fetchAll({
    success: () => {
        console.log("all length", arbitrages.length)
        const sum = arbitrages.models.reduce((sum, a) => {
            if (a.get("status") == "COMPLETED")
                return sum + a.get("profit_krw")
            // else
            //     console.log(a.get("status"))
            return sum
        }, 0)
        console.log(sum)
    },
    error: function(e){
        console.log("error", e)
    }
})