"use strict"

const Backbone = require('backbone'),
    _ = require('underscore'),
    backsync = require('backsync');
const Machines = require('./machine.js').Machines;

/*
{ status: '0000', order_id: '1485052731599', data: [] }
or
{ status: '0000',
	order_id: '1485011389177',
	data:
	 [ { cont_id: '1445825',
			 units: '0.001',
			 price: '1096000',
			 total: 1096,
			 fee: '0.00000150' } ] }
*/
exports.Order = Backbone.Model.extend({
    urlRoot: "mongodb://localhost:27017/rabbit/orders",
    sync: backsync.mongodb(),
    idAttribute: "id",
    defaults: {
        isDone: false,
        machineIds: [],
        internalTradedUnits: 0,
        // dealedUnits: 0,	// dealed with bithumb. not store. calculate everytime
        adjustedUnits: 0 // adjusted with machines
    },
    initialize: function(attributes, options) {
        this.done = false; // if done this order
    },
    // let newOrder = new Order({machines: participants,
    // 							btParams: btParams,
    // 							internalTradedUnits: internalTradedUnits});
    adjust: function(resolve, reject) {
        if (this.get("isDone")) {
            resolve();
            return;
        }

        const machines = this.get("machines"),
            internalTradedUnits = this.get("internalTradedUnits"),
            data = this.get("data"); // bithumb results
        // type = this.get("btParams").type;
        const that = this;
        // let totalDuty = internalTradedUnits * 2 + this.get("btParams").units;

        let dealedUnits = 0; // dealed with bithumb
        if (this.get('status') == '0000') {
            _.each(this.get("data"), function(cont) {
                dealedUnits += (cont.units || cont.units_traded) * 1;
            });
        }

        let pendingMachines = new Machines(); // will be new machines of this order
        function one(index) {
            if (machines.length > index) {
                let m = machines.at(index);
                if ((internalTradedUnits * 2 + dealedUnits - that.get('adjustedUnits')) >=
                    m.get("capacity")) {

                    m.trade(function() {
                        that.set({
                            adjustedUnits: that.get('adjustedUnits') + m.get("capacity")
                        });
                        one(index + 1);
                    });
                } else {
                    // penging machines..
                    pendingMachines.push(m);
                    m.save({
                        status: "pending"
                    }, {
                        success: function() {
                            one(index + 1);
                        }
                    });
                }
            } else {
                that.save({
                    machineIds: pendingMachines.pluck('id'),  // Array of machine's IDs
                    machines: pendingMachines,  // Backbone collections for runtime
                    isDone: (pendingMachines.length == 0) ? true : false
                }, {
                    success: function() {
                        if (that.get('isDone'))
                            that.destroy();
                        resolve && resolve();
                        return;
                    }
                });
            }
        }
        one(0);

    } // adjust
}); // Order

exports.Orders = Backbone.Collection.extend({
    url: "mongodb://localhost:27017/rabbit/orders",
    sync: backsync.mongodb(),
    model: exports.Order,
});
