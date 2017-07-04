"use strict"

const request = require('request'),
  crypto = require("crypto"),
  _ = require("underscore")

const KEYS = require('./credentials/keys.json').COINONE,
	ROOT_URL = 'https://api.coinone.co.kr/'

// {
// 	type: "bid",
// 	price: 162400,
// 	qty: 0.01,
// 	coinType: "ETH"
// }
module.exports = function (options) {
	if (!_.isObject(options))
		throw new Error("[coinone.js] options needed")

  return new Promise((resolve, reject) => {
		let params = {
		  access_token: KEYS.API_KEY,
		  nonce: Date.now()
		}
		let	url = ROOT_URL
		if (options.type == "BID"){
			url += "v2/order/limit_buy/"
			_.extend(params, {
				price: options.price,
				qty: options.qty || options.quantity,
				currency: (options.coinType || options.currency).toLowerCase()
			})
		}else if (options.type == "ASK"){
			url += "v2/order/limit_sell/"
			_.extend(params, {
				price: options.price,
				qty: options.qty || options.quantity,
				currency: (options.coinType || options.currency).toLowerCase()
			})
		}else if (options.type == "UNCOMPLETED_ORDERS"){
			url += "v2/order/limit_orders/"
			params.currency = (options.coinType || options.currency).toLowerCase()
		}else if (!options.type){
			url += options.url
			delete options.url
			_.extend(params, options)
		}

		let payload = new Buffer(JSON.stringify(params)).toString('base64')

		let opts = {
			method: "POST",
		  url: url,
		  headers: {
			  'content-type':'application/json',
			  'X-COINONE-PAYLOAD': payload,
			  'X-COINONE-SIGNATURE': crypto
			    .createHmac("sha512", KEYS.SECRET_KEY.toUpperCase())
			    .update(payload)
			    .digest('hex')
			},
		  body: payload
		}

    request(opts, function(error, response, body) {
			let result = JSON.parse(body)
			if (result.result == "success")
    		resolve(result)
			else {
				reject(result.errorCode)
			}
    })
  })	// end of new Promise()
}
