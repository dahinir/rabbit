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

let machines = new Machines()
machines.fetchAll({
    success: function () {
        console.log(machines.length)

        // if(machines.at(0)){
        //     let m = machines.at(0)
        //     console.log(m.attributes)
        //     let newPercentage = Math.round(m.get('craving_percentage') * 2 / 5) 
        //     let newCraving = Math.round(m.get('buy_at') * newPercentage / 100)
        //     m.save({
        //         // mind: {},
        //         // craving_percentage: newPercentage,
        //         // craving_krw: newCraving,
        //         profit_krw: 2,
        //         traded_count: (m.get("status") == "COIN")? 11: 22
        //     }, {
        //         success: () => {
        //             console.log("success")
        //             console.log(m.attributes)
        //         }
        //     })
        // }
        
        // SAVE TO THE DB
        function save(i) {
            try {
                if (machines.at(i)){
                    let m = machines.at(i)
                    let newPercentage = Math.round(m.get('craving_percentage') * 2 / 5)
                    let newCraving = Math.round(m.get('buy_at') * newPercentage / 100)
                    m.save({
                        // mind: {},
                        craving_percentage: newPercentage,
                        craving_krw: newCraving,
                        profit_krw: 0,
                        profit_rate: 0,
                        traded_count: (m.get("status") == "COIN") ? 1 : 0,
                        last_traded_price: (m.get("status") == "COIN") ? m.get("last_traded_price") : 0
                    }, {
                        success: () => {
                            // console.log("success")
                            // console.log(m.attributes)
                            process.nextTick(() => {
                                save(i + 1)
                            })
                        }
                    })
                }else{
                    console.log("end with", i)
                }
            } catch (e) {
                console.log(e)
            } finally {
            }
        }
        // save(0)
    }
})
return