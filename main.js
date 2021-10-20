"use strict";
console.log("main.js")

const waitPort = require('wait-port');

waitPort({ host: 'mongo', port: 27017 })
    .then((open) => {
        if (open) {
            console.log("mongo db port 27017 is now open")
            require("./index.js")
        } else {
            console.log("The port did not open before the timeout...")
        }
    })
    .catch((err) => {
        console.log(`An unknown error occurred while waiting for the port: ${err}`)
    })