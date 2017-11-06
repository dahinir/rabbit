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
      // console.log("[korbit.js] Token expires in", (cookie.expires_in * 1000 - (Date.now() - cookie.saved_at))/60000, "mins")
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
    const headers = {"Authorization": "Bearer " + cookie.access_token},
      currency_pair = (options.coinType == "ETH")?"eth_krw":"eth_krw"  // Only eth..
    let opts

		if (options.type == "BID"){
      opts = {
        method: "POST",
        headers: headers,
        url: ROOT_URL + "v1/user/orders/buy",
        form: {
          price: options.price,
  				coin_amount: options.qty,
  				currency_pair: currency_pair,
          type: "limit",
          nonce: Date.now()
        }
      }
		}else if (options.type == "ASK"){
      opts = {
        method: "POST",
        headers: headers,
        url: ROOT_URL + "v1/user/orders/sell",
        form: {
          price: options.price,
  				coin_amount: options.qty,
  				currency_pair: currency_pair,
          type: "limit",
          nonce: Date.now()
        }
      }
		}else if (options.type == "UNCOMPLETED_ORDERS"){
      const  offset = 0, // default 0
        limit = 10   // default 10; korbit's max order is 10.. lol
      opts = {
        method: "GET",
        headers: headers,
        url: ROOT_URL + "v1/user/orders/open?currency_pair=" + currency_pair +
          "&offset=" + offset + "&limit=" + limit
      }
		}else if (options.type == "CANCEL_ORDER"){
      opts = {
        method: "POST",
        headers: headers,
        url: ROOT_URL + "v1/user/orders/cancel",
        form: {
          currency_pair: currency_pair,
          id: options.orderId,
          nonce: Date.now()
        }
      }
    } else if (options.type == "BALANCE") {
      opts = {
        method: "GET",
        headers: headers,
        url: ROOT_URL + "v1/user/balances"
      }
    } else if (options.type == "BALANCE_OLD"){
      opts = {
        method: "GET",
        headers: headers,
        url: ROOT_URL + "v1/user/wallet?currency_pair=" + currency_pair
      }
    } else if (options.type == "ORDER_INFO") {
      console.log("[korbit.js] ORDER_INIFO didn't implemented")
      throw new Error("KILL_ME")
      // opts = {
      //   method: "GET",
      //   headers: headers,
      //   url: ROOT_URL + "v1/user/transactions?currency_pair=" + currency_pair +
      //     "&order_id=" + options.orderId
      // }
    }else if (options.type == "GIVE_ME_AN_ERROR"){
      opts = {
        url: ROOT_URL + "g"
      }
    }
    // else if (!options.type){
		// 	url += options.url
		// 	delete options.url
		// 	_.extend(params, options)
		// }

    // console.log("korbit called!")
    request(opts, function(error, response, body) {
      // console.log("korbit got answer")
      // console.log(body)
			let result
      try {
        result = JSON.parse(body)
      } catch (e) {
        console.log("[korbit.js] korbit's answer can't parse for JSON. maybe not a problem")
        // console.log(body)
        reject(e)
        return
      }

      if (result.status == "success" || // BID, ASK
        _.isArray(result) || // UNCOMPLETED_ORDERS, CANCEL_ORDER
        _.isObject(result.krw)){ // BALANCE
        resolve(result)
      }else{
        console.log("[korbit.js] result is funny:", result)
        reject(result)
      }
    })

  })	// end of new Promise()
}
