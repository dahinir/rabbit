"use strict";
const Machine = require('./machine.js').Machine,
    Machines = require('./machine.js').Machines,
    _ = require('underscore');

// add new machines by newMachines.json
// let newMachines = new Machines(require('./addMachine.json'));
// newMachines.each(function(m) {
    // m.save();
// });
// return;


let setting = {};
const settings = [];
let machine_count = 0;

setting = {
    coinType: "XRP",
    // capacity: 0.001,  // BTC
    // capacity: 0.01,  // BCH
    // capacity: 0.01,  // ETH
    // capacity: 0.1,  // ETC
    capacity: 10,  // XRP
    name: "SCATTERER",
    buy_at: 0,
    craving_krw: 0,
    craving_percentage: 0
}

// for (let buy_at = 8000000; buy_at < 9000000; buy_at += 1000) {  // BTC
// for (let buy_at = 1000000; buy_at < 2000000; buy_at += 1000) {  // BCH
// for (let buy_at = 200000; buy_at < 500000; buy_at += 100) {  // ETH
// for (let buy_at = 10000; buy_at < 20000; buy_at += 10) {  // ETC
for (let buy_at = 0; buy_at < 1000; buy_at += 1) {  // XRP
    setting.buy_at = buy_at;

    // for (let craving_percentage = 3; craving_percentage <= 30; craving_percentage += 3) {    // BTC
    // for (let craving_percentage = 5; craving_percentage <= 50; craving_percentage += 5) {    // BCH
    // for (let craving_percentage = 2; craving_percentage <= 20; craving_percentage += 2) {    // ETH
    // for (let craving_percentage = 5; craving_percentage <= 50; craving_percentage += 5) {    // ETC
    for (let craving_percentage = 3; craving_percentage <= 30; craving_percentage += 3) {    // XRP
        setting.craving_percentage = craving_percentage;
        setting.craving_krw = Math.round(setting.buy_at * setting.craving_percentage / 100)
        settings.push(_.extend({}, setting));
        machine_count++;
        console.log(setting.buy_at, craving_percentage, setting.craving_krw);
    }
}
console.log(settings.length);


// SAVE TO THE DB
function save(i) {
  try {
    if (settings[i])
        new Machine().save(settings[i], {
            success: function() {
                (i % 1000 == 0) ? console.log(i): 0;
                // save(i + 1);
                process.nextTick(() => {
                  save(i+1)
                })
            }
        });
  } catch (e) {
    console.log(e)
  } finally {
  }
}
// save(0);


console.log("\nadded machines:", machine_count, settings.length);
// console.log("Rabbit needs", machine_count * 3000, "won");
