"use strict"

const KEYS = require('./credentials/keys.json');
const request = require('request');
const crypto = require("crypto");
const _ = require("underscore");

module.exports = new XCoinAPI(KEYS.COINONE.API_KEY, KEYS.COINONE.SECRET_KEY);

function XCoinAPI(api_key, api_secret){
 	this.apiUrl = 'https://api.coinone.co.kr';
	this.api_key = api_key;
	this.api_secret = api_secret;
}

XCoinAPI.prototype.xcoinApiCall = function(endPoint, params, callback, method) {
    let payload = Buffer.from(JSON.stringify(_.extend({
        "access_token": this.api_key,
        "nonce": Date.now()
    }, params))).toString('base64');

    let headers = {
        // 'content-type':'application/json',
        // "accept": "application/json",
        'X-COINONE-PAYLOAD': payload,
        'X-COINONE-SIGNATURE': crypto.createHmac("sha512", this.api_secret.toUpperCase()).update(payload).digest('hex')
    }

    request({
            method: method || "POST",
            uri: this.apiUrl + endPoint,
            headers: headers,
            // formData: rgParams
            // json: true,
            body: payload
        },
        function(error, response, body) {
            if (error) {
                console.log(error);
                return;
            }

            callback && callback(JSON.parse(body));
        });
}
