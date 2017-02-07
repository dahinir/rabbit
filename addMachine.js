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
    "propensity": "hot",
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
const MIN_HOPE = -50000,
    MAX_HOPE = 50000;

for (let cravingRatio = 0.2; cravingRatio <= 0.9; cravingRatio += 0.1) {
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
            // console.log(setting.negativeHope, setting.positiveHope, "", setting.craving_krw, setting.cravingRatio);
            if (setting.positiveHope >= MAX_HOPE)
                break;
        }
    }
}

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
