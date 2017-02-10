"use strict";
const Machine = require('./machine.js').Machine,
    Machines = require('./machine.js').Machines,
    _ = require('underscore');

// add new machines by newMachines.json
let newMachines = new Machines(require('./addMachine.json'));
newMachines.each(function(m) {
    // m.save();
});

let setting = {
    "propensity": [],
    "craving_krw": 2000,
    "cravingRatio": 0.5,
    "capacity": 0.001,
    "negativeHope": -10000,
    "positiveHope": 10000,
    "neverHope": -10000,
    "maxHope": 10000,
    "status": "krw"
};
let settings = [];
// setting.propensity = "cold";
let machine_count = 0;
let MIN_HOPE = -50000,
    MAX_HOPE = 50000;

/*
MIN_HOPE = -50000;
MAX_HOPE = 50000;
settings.propensity = ["BYPASS_NEGATIVEHOPE_BID", "BYPASS_POSITIVEHOPE_ASK"];
for (let cravingRatio = 0.2; cravingRatio <= 1.2; cravingRatio += 0.1) {
    setting.cravingRatio = cravingRatio.toFixed(1) * 1;

    // positiveHope - negativeHope is gap
    for (let gap = 1000; gap <= 40000; gap += 1000) {
        // console.log("\n");
        setting.craving_krw = gap; // it's just easy way..

        for (let step = 0;; step += 1000) {
            setting.negativeHope = setting.neverHope = MIN_HOPE + step;
            setting.positiveHope = setting.maxHope = setting.negativeHope + gap;
            settings.push(_.extend({}, setting));
            machine_count++;
            // console.log(setting.negativeHope, setting.positiveHope, setting.craving_krw, setting.cravingRatio);
            if (setting.positiveHope >= MAX_HOPE)
                break;
        }
    }
}
*/

// only buy btc when hope is less than the negativeHope
// sell immediately when craving_krw is touching
MIN_HOPE = -50000;
MAX_HOPE = 50000;
setting.propensity = ["BYPASS_CRAVINGRATIO_BID", "BYPASS_POSITIVEHOPE_ASK"];
setting.cravingRatio = 1; // These machines won't use this property
setting.positiveHope = 10000; // These machines won't use this property
for (let craving_krw = 1000; craving_krw <= 40000; craving_krw += 1000) {
    // console.log("\n");
    setting.craving_krw = craving_krw;

    for (let step = 0; step <= MAX_HOPE*2; step += 1000) {
        setting.negativeHope = setting.neverHope = MIN_HOPE + step;
        settings.push(_.extend({}, setting));
        machine_count++;
        console.log(setting.negativeHope, setting.craving_krw, setting.propensity);
    }
}


// SAVE TO THE DB
function save(i) {
    if (settings[i])
        new Machine().save(settings[i], {
            success: function() {
                (i % 1000 == 0) ? console.log(i): 0;
                save(i + 1);
            }
        });
}
// save(0);

console.log("\nadded machines:", machine_count, settings.length);
console.log("Rabbit needs", machine_count * 1000, "won");
