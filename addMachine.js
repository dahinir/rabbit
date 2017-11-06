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


let setting = {
    // "craving_krw": 2000,
    // "cravingRatio": 0.5,
    // "capacity": 0.001,
    // "negativeHope": -10000,
    // "positiveHope": 10000,
    // "neverHope": -10000,
    // "maxHope": 10000,
    // "status": "KRW",
    // "propensity": []
};
const settings = [];
let machine_count = 0;

setting = {
  coinType: "ETH",
  name: "SCATTERER",
  capacity: 0.01,
  buy_at: 0,
  craving_krw: 0,
  craving_percentage: 0
}

for (let buy_at = 200000; buy_at < 500000; buy_at += 100) {
    setting.buy_at = buy_at;

    for (let craving_percentage = 5; craving_percentage <= 50; craving_percentage += 5) {
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
console.log("Rabbit needs", machine_count * 3000, "won");
