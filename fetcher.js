"use strict"

const _ = require('underscore');

const KEYS = require('./credentials/keys.json');

const xcoinAPI = require('./bithumb_modified.js');
const CoinBaseClient = require('coinbase').Client;
const coinBaseClient = new CoinBaseClient({
    apiKey: KEYS.COINBASE.API_KEY,
    apiSecret: KEYS.COINBASE.SECRET_KEY
});

exports.getBtc_usd = function(resolve, reject) {
    coinBaseClient.getBuyPrice({
        'currencyPair': 'BTC-USD'
    }, function(err, result) {
        if (!result || !result.data || !result.data.amount) {
            reject("[fetch.js] .getBtc_usd() failed");
            return;
        }

        let btc_usd = result.data.amount * 1;
        // console.log("bit_usd:", btc_usd);
        if (_.isNumber(btc_usd) && btc_usd < 2500 && btc_usd > 500) {
            resolve(btc_usd);
        } else {
            reject("[fetch.js] btc_usd value is weird");
        }
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

exports.getBtc_krw = function(resolve, reject) {
    xcoinAPI.xcoinApiCall('/public/orderbook', {}, function(result) {
        if (!result || !result.data || !result.data.asks[0].price) {
            reject("[fetch.js] .getBtc_krw() failed");
            return;
        }
        let btc_krw = result.data.asks[0].price * 1,
            btc_krw_b = result.data.bids[0].price * 1;
        if (_.isNumber(btc_krw) && btc_krw < 2800000 && btc_krw > 710000) {
            resolve({
                btc_krw: btc_krw,
                btc_krw_b: btc_krw_b
            });
        } else {
            reject("[fetch.js] btc_krw value is weird");
        }
    });
};

exports.getRecentTransactions = function(resolve, reject){
  xcoinAPI.xcoinApiCall('/public/recent_transactions', {}, function(result) {
      if (!result || !(result.status=="0000")) {
          reject("[fetch.js] .getRecentTransactions() failed");
          return;
      }else{
          // console.log("last transaction:", result.data[0]);
          resolve(result.data);
      }
  });
};

exports.getTicker = function(resolve, reject){
  xcoinAPI.xcoinApiCall('/public/ticker', {}, function(result) {
      if (!result || !(result.status=="0000")) {
          reject("[fetch.js] .getTicker() failed");
          return;
      }else{
          console.log("Bithumb:", result.data);
          resolve(result.data);
      }
  });
};
