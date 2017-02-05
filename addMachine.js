"use strict";
const Machine = require('./machine.js').Machine,
    _ = require('underscore');
// const Machines = require('./machine.js').Machines;

// add new machines by newMachines.json
// var newMachines = new Machines(require('./addMachine.json'));
// newMachines.each(function(m){
// 	m.save();
// });

var setting = {
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
var settings = [];
// setting.propensity = "cold";
var machine_count = 0;

// positiveHope - negativeHope is gap
for (let gap = 2000; gap <= 40000; gap += 100) {
    // console.log("===");
    setting.craving_krw = gap; // it's easy way..

    for (let step = 0; step <= 20000; step += 500) {
        setting.negativeHope = setting.neverHope = -20000 + step;
        setting.positiveHope = setting.maxHope = setting.negativeHope + gap;
        settings.push(_.extend({}, setting));
        machine_count++;
        // console.log(setting.negativeHope, setting.positiveHope, gap, setting.craving_krw);
        if (setting.positiveHope >= 20000)
            break;
    }
}

function save(i) {
    if (settings[i])
        new Machine().save(settings[i], {
            success: function() {
                (i%1000==0)?console.log(i):0;
                save(i + 1);
            }
        });
}
// save(0);

console.log("\nadded machines:", machine_count, settings.length);
