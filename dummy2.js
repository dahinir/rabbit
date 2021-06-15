"use strict"
const Arbitrages = require('./machine.js').Arbitrages,
    _ = require('underscore'),
    fs = require('fs'),
    moment = require('moment'),
    brain = require('brain.js'),
    ARBITRAGE_STARTED = new Date('July 26, 2017 13:20:00')

const N = new Date()
console.log(N.toLocaleString())
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
        console.log(new Intl.NumberFormat().format(sum.toFixed(0)))

        console.log(new Intl.NumberFormat().format((sum / ((new Date() - ARBITRAGE_STARTED) / 86400000)).toFixed(0)), "per day")
    },
    error: function (e) {
        console.log("error", e)
    }
})