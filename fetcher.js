"use strict"

const _ = require('underscore');
const request = require('request');
const KEYS = require('./credentials/keys.json');
const xcoinAPI = require('./bithumb_modified.js');
const CoinBaseClient = require('coinbase').Client;
const coinBaseClient = new CoinBaseClient({
    apiKey: KEYS.COINBASE.API_KEY,
    apiSecret: KEYS.COINBASE.SECRET_KEY
});
const coinoneAPI = require("./coinone.js");

exports.getBtc_usd = function() {
  return new Promise((resolve, reject) => {
    coinBaseClient.getBuyPrice({
        'currencyPair': 'BTC-USD'
    }, function(err, result) {
        if (!result || !result.data || !result.data.amount) {
            throw new Error( "[fetch.js] .getBtc_usd() failed");
        }

        let btc_usd = result.data.amount * 1;
        // console.log("bit_usd:", btc_usd);
        if (_.isNumber(btc_usd) && btc_usd < 3500 && btc_usd > 500) {
            resolve( btc_usd);
        } else {
            throw new Error( "[fetch.js] btc_usd value is weird");
        }
    });
  });
};

exports.getUsd_krw = function(resolve, reject) {
    coinBaseClient.getExchangeRates({
        'currency': 'USD'
    }, function(err, result) {
        if (!result || !result.data || !result.data.rates) {
            reject("[fetch.js] .getUsd_krw() failed");
            return;
        }

        // let usd_krw = rates.data.rates.KRW*1.014903;	// buy cash
        let usd_krw = result.data.rates.KRW * 1.0075; // send money
        if (_.isNumber(usd_krw) && usd_krw < 3500 && usd_krw > 500) {
            resolve(usd_krw);
        } else {
            reject("[fetch.js] usd_krw value is weird");
        }
    });
};

exports.getBtc_krw = function() {
  return new Promise((resolve, reject) => {
    xcoinAPI.xcoinApiCall('/public/orderbook', {}, function(result) {
      // console.log(result.data);
        if (!result || !result.data || !result.data.asks[0].price) {
            throw new Error( "[fetch.js] .getBtc_krw() failed");
        }
        let btc_krw_a = result.data.asks[0].price * 1,
            btc_krw_b = result.data.bids[0].price * 1;
        if (_.isNumber(btc_krw_a) && btc_krw_a < 4800000 && btc_krw_a > 1230000) {
            resolve( {
                btc_krw_a: btc_krw_a,
                btc_krw_b: btc_krw_b
            });
        } else {
            throw new Error( "[fetch.js] btc_krw value is weird");
        }
    });
  });
};

exports.getRecentTransactions = function(){
  return new Promise((resolve, reject) => {
    xcoinAPI.xcoinApiCall('/public/recent_transactions', {}, function(result) {
        if (!result || !(result.status=="0000")) {
            throw new Error( "[fetch.js] .getRecentTransactions() failed");
        }else{
            // console.log("last transaction:", result.data[0]);
            resolve(result.data);
        }
    });
  });
};

exports.getKorbitInfo = function(){
  return new Promise((resolve, reject) => {
    request({
        method: "GET",
        uri: "https://api.korbit.co.kr/v1/ticker/detailed",
        qs: {
          currency_pair: "eth_krw"
        }
      },
      function(error, response, body) {
        let result = JSON.parse(body);
        if (result.result == 'success')
          resolve(result);
      })
  })
}

exports.getCoinoneInfo = function(){
  return new Promise((resolve, reject) => {
    request({
        method: "GET",
        uri: "https://api.coinone.co.kr/ticker/",
        qs: {
          currency: 'eth'
        }
      },
      function(error, response, body) {
        let result = JSON.parse(body)
        if (result.result == 'success')
          resolve(result)
        else
          reject(result)
      })
  })
}
exports.getCoinoneEthOrderbook = function() {
  return new Promise((resolve, reject) => {
    // this is public api
    request({
            method: "GET",
            uri: "https://api.coinone.co.kr/orderbook/",
            qs: {
                currency: 'eth'
            }
        },
        function(error, response, body) {
            let result = JSON.parse(body)
            // console.log(result)
            if( result.result == 'success')
              resolve(result)
            else
              reject(result)
        });
  })
}
