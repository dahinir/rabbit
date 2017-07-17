"use strict"

const request = require('request'),
  crypto = require("crypto"),
  fs = require('fs'),
  _ = require("underscore")

const KEYS = require('./credentials/keys.json').KORBIT,
	ROOT_URL = 'https://api.korbit.co.kr/'

let cookie = require('./credentials/korbit_cookie.json')

function refreshToken(){
  return new Promise((resolve, reject) => {
    // const opts = {
    //   method: "POST",
    //   url: ROOT_URL + "v1/oauth2/access_token",
    //   form: {
    //     client_id: KEYS.API_KEY,
    //     client_secret: KEYS.SECRET_KEY,
    //     username: KEYS.ID,
    //     password: KEYS.PW,
    //     grant_type: "password"
    //   }
    // }
    // const opts2 = {
    //   method: "POST",
    //   url: ROOT_URL + "v1/oauth2/access_token",
    //   form: {
    //     client_id: KEYS.API_KEY,
    //     client_secret: KEYS.SECRET_KEY,
    //     refresh_token: "LwjOPxUtuuZU3C2L9UaK1hJoOSR83BcL11I0k49YE2bmpzD2WdURv4wxYAQZ6",
    //     grant_type: "refresh_token"
    //   }
    // }
    let form = {
      client_id: KEYS.API_KEY,
      client_secret: KEYS.SECRET_KEY
    }

    // More than 10 mins left to expire. so don't need to refresh
    if (cookie.expires_in * 1000 - (Date.now() - cookie.saved_at) > 10*60*1000){
      console.log("[korbit.js] Token expires in", (cookie.expires_in * 1000 - (Date.now() - cookie.saved_at))/60000, "mins")
      resolve(cookie)
      return
    }

    // Expired: get new one
    if (cookie.expires_in * 1000 - (Date.now() - cookie.saved_at) < 0){
      console.log("[korbit.js] Access token expired. so get new one")
      _.extend(form, {
        username: KEYS.ID,
        password: KEYS.PW,
        grant_type: "password"
      })
    // Not expired yet: refresh token
    }else {
      console.log("[korbit.js] Time to refresh access token")
      _.extend(form, {
        refresh_token: cookie.refresh_token,
        grant_type: "refresh_token"
      })
    }

    request({
      method: "POST",
      url: ROOT_URL + "v1/oauth2/access_token",
      form: form
    }, function(error, response, body) {
      let result = JSON.parse(body)
      if (result.expires_in > 0){
        result.saved_at = Date.now()
        cookie = result
        fs.writeFileSync("./credentials/korbit_cookie.json", JSON.stringify(cookie))
        resolve(cookie)
      }else {
        reject(result)
      }
    })
  })
}

module.exports = function (options) {
	if (options.type == "REFRESH_TOKEN")
		return refreshToken()

  return new Promise((resolve, reject) => {
		let	url = ROOT_URL,
      params = {
        nonce: Date.now()
      }

		if (options.type == "BID"){
			url += "v1/user/orders/buy"
			_.extend(params, {
				price: options.price,
				coin_amount: options.qty,
				currency_pair: (options.coinType == "ETH")?"eth_krw":"eth_krw",  // Only eth..
        type: "limit"
			})
		}else if (options.type == "ASK"){
			url += "v1/user/orders/sell"
			_.extend(params, {
        price: options.price,
				coin_amount: options.qty,
				currency_pair: (options.coinType == "ETH")?"eth_krw":"eth_krw",  // Only eth..
        type: "limit"
			})
		}
    // else if (options.type == "UNCOMPLETED_ORDERS"){
		// 	url += "v2/order/limit_orders/"
		// 	params.currency = (options.coinType || options.currency).toLowerCase()
		// }else if (!options.type){
		// 	url += options.url
		// 	delete options.url
		// 	_.extend(params, options)
		// }

    request({
      method: "POST",
      url: url,
      headers: {"Authorization": "Bearer " + cookie.access_token},
      form: params
    }, function(error, response, body) {
			let result
      try {
        result = JSON.parse(body)
      } catch (e) {
        reject(e)
        return
      }

      if (result.status == "success"){
        resolve(result)
      }else{
        console.log("[korbit.js] status:", result.status)
        reject(result)
      }
    })

  })	// end of new Promise()
}
