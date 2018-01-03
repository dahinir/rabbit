"use strict"

const request = require('request'),
    crypto = require("crypto"),
    _ = require("underscore")

const KEYS = require('./credentials/keys.json').BITHUMB,
    ROOT_URL = 'https://api.bithumb.com'

module.exports = new Bithumb(KEYS.API_KEY, KEYS.SECRET_KEY)

function Bithumb(){}


// {
// 	type: "BID",
// 	price: 162400,
// 	qty: 0.01,
// 	coinType: "ETH"
// }
Bithumb.prototype.willDo = function(options){
    if (!_.isObject(options))
        throw new Error("[coinone.js] options needed")

    let params = {}

    switch (options.type.toUpperCase()){
        case "ORDERBOOK":
            break;
        case "ASK":
        case "BID":
            _.extend(params, {
                type: options.type.toLowerCase(),
                endPoint: "/trade/place",
                order_currency: options.coinType.toUpperCase(),
                price: options.price,
                units: options.qty || options.quantity
            })
            break;
        case "UNCOMPLETED_ORDERS":
            break;
        defalut:
            throw new Error("[coinone.js] There is no matched type")
    }
    console.log("params:", params)

    let requestOpts
    const NONCE = Date.now()
    switch (options.type.toUpperCase()) {
        // Public APIs
        case "INFO":
        case "ORDERBOOK":
            requestOpts = {
                method: "GET",
                uri: "https://api.coinone.co.kr/orderbook/",
                qs: {
                    currency: coinType.toLowerCase()
                }
            }
            break;
        // Private APIs
        case "ASK":
        case "BID":
        case "UNCOMPLETED_ORDERS":
            requestOpts = {
                method: "POST",
                uri: ROOT_URL + params.endPoint,
                headers: {
                    'Api-Key': KEYS.API_KEY,
                    'Api-Sign': new Buffer(crypto
                        .createHmac("sha512", KEYS.SECRET_KEY)
                        .update(params.endPoint + chr(0) + http_build_query(params) + chr(0) + NONCE, KEYS.SECRET_KEY)
                        .digest('hex')).toString('base64'),
                    'Api-Nonce': NONCE
                },
                formData: params
            }
            break;
    }

    return new Promise((resolve, reject) => {
        request(requestOpts, (error, response, body) => {
            if (error){
                console.log("bithumb error:", error)
                reject(error)
                return
            }

            let result
            try {
                // console.log(body)
                result = JSON.parse(body)
            } catch (e) {
                reject(e)
                return
            }

            if (result.status == "0000"){
                resolve(afterTreatment(options, result))
            } else{
                reject(result)
            }
        })
    })
}



function afterTreatment(options, before){
    let after = {}
    switch (options.type.toUpperCase()) {
        case "ASK":
        case "BID":
            after.orderId = before.order_id
            break;
        defalut:
            throw new Error("[coinone.js] There is no matched type")
    }
    return after
}


//// HELPER FUNCTIONS /////
function http_build_query(obj) {
	var output_string = []
	Object.keys(obj).forEach(function (val) {
		var key = val;
		key = encodeURIComponent(key.replace(/[!'()*]/g, escape));

		if (typeof obj[val] === 'object') {
			var query = build_query(obj[val], null, key)
			output_string.push(query)
		}
		else {
			var value = encodeURIComponent((obj[val]+"").replace(/[!'()*]/g, escape));
			output_string.push(key + '=' + value)
		}
	})
// console.log("output_string:", output_string.join('&'));
	return output_string.join('&');
}

function chr(codePt) {
	//  discuss at: http://phpjs.org/functions/chr/
	// original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
	// improved by: Brett Zamir (http://brett-zamir.me)
	//   example 1: chr(75) === 'K';
	//   example 1: chr(65536) === '\uD800\uDC00';
	//   returns 1: true
	//   returns 1: true

	if (codePt > 0xFFFF) { // Create a four-byte string (length 2) since this code point is high
		//   enough for the UTF-16 encoding (JavaScript internal use), to
		//   require representation with two surrogates (reserved non-characters
		//   used for building other characters; the first is "high" and the next "low")
		codePt -= 0x10000;
		return String.fromCharCode(0xD800 + (codePt >> 10), 0xDC00 + (codePt & 0x3FF));
	}
	return String.fromCharCode(codePt);
}
