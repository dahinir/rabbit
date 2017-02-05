"use strict"

const _ = require('underscore');

const KEYS = require('./credentials/keys.json');

const xcoinAPI = require('./bithumb_modified.js');
const CoinBaseClient = require('coinbase').Client;
const coinBaseClient = new CoinBaseClient({apiKey: KEYS.COINBASE.API_KEY, apiSecret: KEYS.COINBASE.SECRET_KEY});

exports.getBtc_usd = function(resolve, reject){
	coinBaseClient.getBuyPrice({'currencyPair': 'BTC-USD'}, function(err, result) {
    if( !result || !result.data || !result.data.amount){
			reject(".getBtc_usd() failed");
			return;
		}

		var btc_usd = result.data.amount*1;
		// console.log("bit_usd:", btc_usd);
		if( _.isNumber(btc_usd) && btc_usd<2500 && btc_usd>500)
			resolve(btc_usd);
	});
};
exports.getUsd_krw = function(resolve, reject){
	coinBaseClient.getExchangeRates({'currency': 'USD'}, function(err, result) {
    if( !result || !result.data || !result.data.rates){
      reject(".getUsd_krw() failed");
			return;
		}

		// var usd_krw = rates.data.rates.KRW*1.014903;	// buy cash
		var usd_krw = result.data.rates.KRW*1.0075;	// send money
		if( _.isNumber(usd_krw) && usd_krw<20000 && usd_krw>500)
			resolve(usd_krw);
	});
};
exports.getBtc_krw = function(resolve, reject){
	xcoinAPI.xcoinApiCall('/public/orderbook', {}, function(result){
    if( !result || !result.data || !result.data.asks[0].price){
      reject(".getBtc_krw() failed");
			return;
		}

		var btc_krw = result.data.asks[0].price*1;
		if( _.isNumber(btc_krw) && btc_krw<2000000 && btc_krw>800000)
			resolve(btc_krw);
	});
};
