"use strict"

const Backbone = require('backbone'),
    _ = require('underscore'),
    backsync = require('backsync');

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
    idAttribute: "_id",
    defaults: {
        isDone: false,
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
    adjust: function() {
        if (this.get("isDone"))
            return;

        let machines = this.get("machines"),
            adjustedUnits = this.get("adjustedUnits"),
            internalTradedUnits = this.get("internalTradedUnits"),
            data = this.get("data"), // bithumb results
            type = this.get("btParams").type;

        let totalDuty = internalTradedUnits * 2 + this.get("btParams").units;

        let dealedUnits = 0; // dealed with bithumb
        _.each(this.get("data"), function(cont) {
            dealedUnits = dealedUnits + (cont.units || cont.units_traded) * 1;
        });

        let pendingMachines = new Machines();
        while (machines.length > 0) {
            let m = machines.pop();
            if ((internalTradedUnits * 2 + dealedUnits - adjustedUnits) >=
                m.get("capacity")) {
                m.trade();
                this.set({
                    adjustedUnits: adjustedUnits + m.get("capacity")
                });
            } else {
                // penging machines..
                m.set("status", "pending");
                pendingMachines.push(m);
            }
        }
        this.set({
            machines: pendingMachines
        });
        if (pendingMachines.length == 0) {
            this.set({
                isDone: true
            });
            // order is done. destroy this
            this.destroy();
        }
    } // adjust
}); // Order

exports.Orders = Backbone.Collection.extend({
    url: "mongodb://localhost:27017/rabbit/orders",
    sync: backsync.mongodb(),
    model: exports.Order,
});
