"use strict";
const Machine = require('./machine.js').Machine,
    Machines = require('./machine.js').Machines,
    _ = require('underscore');

// add new machines by newMachines.json
let newMachines = new Machines(require('./addMachine.json'));
newMachines.each(function(m) {
    // m.save();
});
// return;

let setting = {
    // "craving_krw": 2000,
    // "cravingRatio": 0.5,
    // "capacity": 0.001,
    // "negativeHope": -10000,
    // "positiveHope": 10000,
    // "neverHope": -10000,
    // "maxHope": 10000,
    // "status": "krw",
    "propensity": []
};
const settings = [];
let machine_count = 0;



/*
// First penguins
setting = {
    propensity: ["DECRAVING_KRW_BID", "CRAVING_KRW_ASK"],
    neverHope: -40000 // NEED TO SET YOU WANT
};
for (let craving_krw = 1000; craving_krw <= 50000; craving_krw += 1000) {
    setting.craving_krw = craving_krw;
    // console.log("\n", craving_krw);

    let a = Math.round((craving_krw * 0.3)/1000)*1000 + 1000;
    for (let decraving_krw = a; decraving_krw <= craving_krw*1.2+1000; decraving_krw += 1000) {
        setting.decraving_krw = decraving_krw;

        settings.push(_.extend({}, setting));
        machine_count++;
        // console.log(setting.neverHope, setting.craving_krw, -setting.decraving_krw);
    }
}
console.log(settings.length);

// Same shit but for desecent
setting = {
    propensity: ["DECRAVING_KRW_BID", "CRAVING_KRW_ASK"],
    maxHope: 30000 // These machines are for desecent of btc_krw situation
};
for (let craving_krw = 1000; craving_krw <= 10000; craving_krw += 1000) {
    setting.craving_krw = craving_krw;
    // console.log("\n", craving_krw);

    for (let decraving_krw = 1000; decraving_krw <= 50000; decraving_krw += 1000) {
        setting.decraving_krw = decraving_krw;

        settings.push(_.extend({}, setting));
        machine_count++;
        console.log(setting.maxHope, setting.craving_krw, -setting.decraving_krw);
    }
}
console.log(settings.length); //500


// only buy btc when hope is less than the negativeHope
// sell immediately when craving_krw is touching
setting = {
    propensity: ["NEGATIVE_HOPE_BID", "CRAVING_KRW_ASK"]
};
for (let hope = -50000; hope <= 50000; hope += 10000) {
    setting.negativeHope = setting.neverHope = hope;
    // console.log("negativeHope:", hope);

    for (let craving_krw = 1000; craving_krw <= 40000; craving_krw += 1000) {
        setting.craving_krw = craving_krw;
        settings.push(_.extend({}, setting));
        machine_count++;
        // console.log(setting.negativeHope, setting.craving_krw);
    }
}
console.log(settings.length);

// only for hope
setting = {
    propensity: ["NEGATIVE_HOPE_BID", "POSITIVE_HOPE_ASK"]
};
for (let hope = -50000; hope <= 50000; hope += 10000) {
    setting.negativeHope = setting.neverHope = hope;
    // console.log('\n');

    for (let craving_krw = 1000; craving_krw <= 40000; craving_krw += 1000) {
        setting.craving_krw = craving_krw;
        setting.positiveHope = setting.negativeHope + craving_krw*2;
        settings.push(_.extend({}, setting));
        machine_count++;
        // console.log(setting.negativeHope, setting.positiveHope, setting.craving_krw);
        if(setting.positiveHope > 50000)
            break;
    }
}
console.log(settings.length);

setting = {
    propensity: ["NEGATIVE_HOPE_BID", "CRAVING_KRW_AND_NEGATIVE_HOPE_ASK"]
};
for (let hope = -50000; hope <= 50000; hope += 10000) {
    setting.negativeHope = setting.neverHope = hope;
    // console.log("negativeHope:", hope);

    for (let craving_krw = 1000; craving_krw <= 40000; craving_krw += 1000) {
        setting.craving_krw = craving_krw;
        settings.push(_.extend({}, setting));
        machine_count++;
        // console.log(setting.negativeHope, setting.craving_krw);
    }
}
console.log(settings.length);

// craving_krw by time!
setting = {
    propensity: ["DYNAMIC_DECRAVING_KRW_BY_TIME_BID", "DYNAMIC_CRAVING_KRW_BY_TIME_ASK"],
    capacity: 0.1
};
for (let hope = -50000; hope <= 50000; hope += 10000) {
    setting.neverHope = hope;
    settings.push(_.extend({}, setting));
    // console.log("neverHope:", hope);
    machine_count++;
}
console.log(settings.length);
*/

/*
// 1,100,000 ~ 1,500,000
setting = {
    propensity: ["BTC_KRW_BID", "CRAVING_KRW_ASK"]
};
for (let btc_krw_bid = 1400000; btc_krw_bid < 1500000; btc_krw_bid += 1000) {
    setting.btc_krw_bid = btc_krw_bid;
    // console.log("negativeHope:", hope);

    for (let craving_krw = 1000; craving_krw <= 10000; craving_krw += 1000) {
        setting.craving_krw = craving_krw;
        settings.push(_.extend({}, setting));
        machine_count++;
        // console.log(setting.negativeHope, setting.craving_krw);
    }
}
console.log(settings.length); // 4000:
*/

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
