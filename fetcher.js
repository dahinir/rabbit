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

const coinoneAPI = require("./coinone.js"),
  korbitAPI = require("./korbit.js")

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



exports.getKorbitInfo = function (coinType){
  return new Promise((resolve, reject) => {
    request({
        method: "GET",
        uri: "https://api.korbit.co.kr/v1/ticker/detailed",
        qs: {
          currency_pair: coinType.toLowerCase() + "_krw"
        }
      },
      function(error, response, body) {
        let result
        try {
          result = JSON.parse(body)
        } catch (e) {
          // throw new Error("[fetcher.js] Maybe not a problem")
          reject()
          return
        }

        if (result.timestamp > 0)
          resolve(result)
        else
          reject(result)
      })
  })
}
exports.getKorbitOrderbook = function(coinType) {
  // console.log("korbit with", (coinType=="ETH")?"eth_krw":"btc_krw")
  return new Promise((resolve, reject) => {
    // this is public api
    request({
            method: "GET",
            uri: "https://api.korbit.co.kr/v1/orderbook",
            qs: {
              currency_pair: coinType.toLowerCase() + "_krw"
            }
        },
        function(error, response, body) {
            let data
            try {
              data = JSON.parse(body)
            } catch (e) {
              // throw new Error("[fetcher.js] Maybe not a problem")
              reject()
              return
            }

            const result = {
              timestamp: data.timestamp / 1000, // Math.round(data.timestamp * 1 / 1000),
              // timestamp: data.timestamp * 1,
              bid: data.bids.map(([price, qty]) => {return {price: price*1, qty: qty*1}}),
              ask: data.asks.map(([price, qty]) => {return {price: price*1, qty: qty*1}})
            }

            if (result.timestamp > 0)
              resolve(result)
            else
              reject(result)
        });
  })
}
exports.getKorbitBalance = async function(){
  const result = await korbitAPI({
    type: "BALANCE"
  })

  let bals = {}
  for (const name in result) {
    if (result[name].available)
      bals[name.toUpperCase()] = {
        available: result[name].available * 1,
        balance: result[name].available * 1 + result[name].trade_in_use * 1
      }
  }
  return bals

  // return {
  //   BTC: {
  //     available: result.btc.available * 1,
  //     balance: result.btc.available * 1 + result.btc.trade_in_use * 1
  //   },
  //   BCH: {
  //     available: result.bch.available * 1,
  //     balance: result.bch.available * 1 + result.bch.trade_in_use * 1
  //   },
  //   ETH: {
  //     available: result.eth.available * 1,
  //     balance: result.eth.available * 1 + result.eth.trade_in_use * 1
  //   },
  //   ETC: {
  //     available: result.etc.available * 1,
  //     balance: result.etc.available * 1 + result.etc.trade_in_use * 1
  //   },
  //   XRP: {
  //     available: result.xrp.available * 1,
  //     balance: result.xrp.available * 1 + result.xrp.trade_in_use * 1
  //   },
  //   KRW: {
  //     available: result.krw.available * 1,
  //     balance: result.krw.available * 1 + result.krw.trade_in_use * 1
  //   }
  // }
}
exports.getKorbitRecentCompleteOrders = function (coinType) {
  return new Promise((resolve, reject) => {
    request({
        method: "GET",
        uri: "https://api.korbit.co.kr/v1/transactions",
        qs: {
          currency_pair: coinType.toLowerCase() + "_krw",
          time: 'hour' // 'minite', 'hour', 'day'
        }
      },
      function (error, response, body) {
        let result
        try {
          result = JSON.parse(body).map(o => {
            return {
              timestamp: o.timestamp / 1000, // Math.round(o.timestamp/1000),
              price: o.price * 1,
              qty: o.amount * 1
            }
          })
        } catch (e) {
          // throw new Error("[fetcher.js] Maybe not a problem")
          reject()
          return
        }

        if (result.length > 0)
          resolve(result)
        else
          reject(result)
      })
  })
}

exports.getCoinoneRecentCompleteOrders = function (coinType, period) {
  return new Promise((resolve, reject) => {
    request({
        method: "GET",
        uri: "https://api.coinone.co.kr/trades/",
        qs: {
          currency: coinType.toLowerCase(),
          period: period || 'hour'
        }
      },
      function (error, response, body) {
        let result
        try {
          result = JSON.parse(body)
        } catch (e) {
          // throw new Error("[fetcher.js] Maybe not a problem")
          reject()
          return
        }

        if (result.result == 'success')
          resolve(result.completeOrders)
        else
          reject(result)
      })
  })
}
exports.getCoinoneInfo = function (coinType){
  return new Promise((resolve, reject) => {
    request({
        method: "GET",
        uri: "https://api.coinone.co.kr/ticker/",
        qs: {
          currency: coinType.toLowerCase()
        }
      },
      function(error, response, body) {
        let result
        try {
          result = JSON.parse(body)
        } catch (e) {
          // throw new Error("[fetcher.js] Maybe not a problem")
          reject()
          return
        }

        if (result.result == 'success')
          resolve(result)
        else
          reject(result)
      })
  })
}
exports.getCoinoneOrderbook = function(coinType) {
  // console.log("coinone with", (coinType == "ETH") ? "eth" : "btc")
  return new Promise((resolve, reject) => {
    request({
            method: "GET",
            uri: "https://api.coinone.co.kr/orderbook/",
            qs: {
              currency: coinType.toLowerCase()
            }
        },
        function(error, response, body) {
            let data, result
            try {
              data = JSON.parse(body)
              result = {
                timestamp: data.timestamp * 1,
                bid: data.bid.map(({price, qty}) => {return {price: price*1, qty: qty*1}}),
                ask: data.ask.map(({price, qty}) => {return {price: price*1, qty: qty*1}})
              }
            } catch (e) {
              console.log(e)
              reject("[fetcher.js] Maybe market's problem. not me")
              // resolve() // resolve() with undefined than reject()
              return
            }

            if( data.result == 'success')
              resolve(result)
            else
              reject("[fetcher.js] idk what wrong?")
        });
  })
}
exports.getCoinoneBalance = async function(){
  const result = await coinoneAPI({
    type: "BALANCE"
  })
  
  let bals = {}
  for (const name in result){
    if (result[name].balance)
      bals[name.toUpperCase()] = {
        available: result[name].avail * 1,
        balance: result[name].balance * 1
      }
  }
  return bals
  // return {
  //   BTC: {
  //     available: result.btc.avail * 1,
  //     balance: result.btc.balance * 1
  //   },
  //   BCH: {
  //     available: result.bch.avail * 1,
  //     balance: result.bch.balance * 1
  //   },
  //   ETH: {
  //     available: result.eth.avail * 1,
  //     balance: result.eth.balance * 1
  //   },
  //   ETC: {
  //     available: result.etc.avail * 1,
  //     balance: result.etc.balance * 1
  //   },
  //   XRP: {
  //     available: result.xrp.avail * 1,
  //     balance: result.xrp.balance * 1
  //   },
  //   QTUM: {
  //     available: result.qtum.avail * 1,
  //     balance: result.qtum.balance * 1
  //   },
  //   LTC: {
  //     available: result.ltc.avail * 1,
  //     balance: result.ltc.balance * 1
  //   },
  //   IOTA: {
  //     available: result.iota.avail * 1,
  //     balance: result.iota.balance * 1
  //   },
  //   KRW: {
  //     available: result.krw.avail * 1,
  //     balance: result.krw.balance * 1
  //   }
  // }
}
