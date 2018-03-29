"use strict"
/* this file will be called like below
const coinone = require("./coinone")
coinone({
    type: "BID",
    price: 162400,
    qty: 0.01,
    coinType: "ETH"
}).then()
*/

const request = require('request'),
  crypto = require("crypto"),
  _ = require("underscore")

const KEYS = require('./credentials/keys.json').COINONE,
	ROOT_URL = 'https://api.coinone.co.kr/'

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
		}else if (options.type == "ORDER_INFO"){
      url += "v2/order/order_info/"
      _.extend(params, {
        order_id: options.orderId,
        currency: (options.coinType || options.currency).toLowerCase()
      })
    }else if (options.type == "CANCEL_ORDER"){
      url += "v2/order/cancel/"
      _.extend(params, {
        order_id: options.orderId,
        is_ask: options.isAsk,
        qty: options.qty,
        price: options.price,
        currency:  (options.coinType || options.currency).toLowerCase()
      })
    }else if (options.type == "BALANCE"){
      url += "v2/account/balance"
    }
    // else if (!options.type){
		// 	url += options.url
		// 	delete options.url
		// 	_.extend(params, options)
		// }

		const payload = new Buffer(JSON.stringify(params)).toString('base64')

		const opts = {
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
    // console.log("coinone called!")
    request(opts, function(error, response, body) {
      // console.log("coinone got answer")
      let result
      try {
				// console.log(body)
        result = JSON.parse(body)
      } catch (e) {
				console.log("[coinone.js] parse error.. maybe not my problem..")
        reject(e)
        return
      }

      if (result.result == "success"){
				// console.log(result)
        resolve(result)
      } else{
        console.log("[coinone.js] result is funny:", result)
        reject(result)
      }
    })
  })	// end of new Promise()
}
