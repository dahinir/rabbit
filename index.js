"use strict"
/*
 * XCoin API-call related functions
 *
 * @author	btckorea
 * @date	2015-03-24
 * @description
		Needs :
			socket.io (npm install socket.io)
			request (npm install request)

		Include Function :
			microtime
			http_build_query
			base64_encode
			chr
			CryptoJS : HmacSHA512
*/
var fs = require('fs'),
		request = require('request');

var _ = require('underscore'),
		Backbone = require('backbone');

var ticNumber = 0;
var API_KEY = '874e9de3408580e57cfe564d242731b4',
	SECRET_KEY = '9c4fec35a9352461159247878200a975';
var xcoinAPI = new XCoinAPI(API_KEY, SECRET_KEY);

var CoinBaseClient = require('coinbase').Client;
var coinBaseClient = new CoinBaseClient({apiKey: "mykey", apiSecret: "mysecret"});

function getBtc_usd(resolve, reject){
	coinBaseClient.getBuyPrice({'currencyPair': 'BTC-USD'}, function(err, price) {
		var btc_usd = price.data.amount*1;
		// console.log("bit_usd:", btc_usd);
		if( _.isNumber(btc_usd) && btc_usd<2500 && btc_usd>500)
			resolve(btc_usd);
	});
}
function getUsd_krw(resolve, reject){
	coinBaseClient.getExchangeRates({'currency': 'USD'}, function(err, rates) {
		// var usd_krw = rates.data.rates.KRW*1.014903;	// buy cash
		var usd_krw = rates.data.rates.KRW*1.0075;	// send money
		// console.log("usd_krw:", usd_krw);
		if( _.isNumber(usd_krw) && usd_krw<20000 && usd_krw>500)
			resolve(usd_krw);
	});
}
function getBtc_krw(resolve, reject){
	xcoinAPI.xcoinApiCall('/public/orderbook', {}, function(result){
		var btc_krw = result.data.asks[0].price*1;
		// console.log("btc_krw:", btc_krw);
		if( _.isNumber(btc_krw) && btc_krw<2000000 && btc_krw>800000)
			resolve(btc_krw);
	});
}

// tic()
var minHope = [Infinity, 0], maxHope = [-Infinity, 0],
		minBtc_krw = [0, Infinity],	maxBtc_krw = [0, -Infinity];
// ONLY CASE: KRW WITH SEED MONEY!
var Machine = Backbone.Model.extend({
	defaults: {
		propensity: "STATIC",	// means static capacity. "GREEDY"
		craving_krw: 2000,	// 2,000 won!
		cravingRatio: 0.5,	// means 50%
		capacity: 0.001,	// min btc 0.001
		negativeHope: -5000,
		positiveHope: -3000,
		neverHope: -10000,
		maxHope: 0,
		status: "krw",	// "krw" or "btc"

		// balance_btc: 0,
		// balance_krw: 0,

		// profit_btc: 0,
		profit_krw: 0,
		traded_count: 0,
		traded_btc_krw: 0
	},
	initialize: function(){
		// this.set({status: this.get("balance_krw")>0?"krw":"btc"});
		// this.set({
		// 	balance_btc: this.get("seed_btc"),
		// 	balance_krw: this.get("seed_krw"),
		// 	status: this.get("seed_krw")
		// });
		// if(this.get("seed_btc") == 0)
		// 	this.set({seed_btc: this.get("seed_krw")/1000000});
	},
	mind: function(attr){
		var hope = attr.hope*1,
				btc_krw = attr.btc_krw*1;
		var negativeHope = this.get('negativeHope'),
				positiveHope = this.get('positiveHope');

		var mind = { type: "none",
								btc_krw: btc_krw,
								units: this.get("capacity").toString()};

		if( this.get("traded_count") > 0 ){
			if( this.get("status")=="krw" ){
				if( hope < negativeHope){
					if( btc_krw < this.get("traded_btc_krw")-this.get("craving_krw")*this.get("cravingRatio")){
						mind.type =  "bid";
					}
				}
			}else if( this.get("status")=="btc"){
				if( hope > positiveHope){
					if( btc_krw > this.get("traded_btc_krw")+this.get("craving_krw") ){
						mind.type = "ask";
					}
				}
			}
		}else	if( this.get("traded_count") == 0 ){
			if( hope < this.get("neverHope") && this.get("status")=="krw")
				mind.type =  "bid";
			if( hope > this.get("maxHope") && this.get("status")=="btc")
				mind.type = "ask";
		}

		this.set({mind: mind});
		return mind;
	},
	trade: function(){	// machine always trade with its mind..
		var mind = this.get("mind");

		var changed = {
			//  balance_btc: this.get("balance_btc")+units,
			//  balance_krw: this.get("balance_krw")-units*btc_krw,
			 traded_count: this.get("traded_count")+1,
			 traded_btc_krw: mind.btc_krw,
			 status: "btc"
		}
		if(mind.type == "ask"){
			changed.status = "krw";
			changed.profit_krw =
				this.get("profit_krw") + (mind.btc_krw - this.get("traded_btc_krw"))* mind.units;
		}
		this.set(changed);
	}
});
var Machines = Backbone.Collection.extend({
  model: Machine
});
// var m = new Machine({capacity:0.01});
// m.trade();
// console.log(m.attributes);
// return;


/*
{ status: '0000', order_id: '1485052731599', data: [] }
or
{ status: '0000',
	order_id: '1485011389177',
	data:
	 [ { cont_id: '1445825',
			 units: '0.001',
			 price: '1096000',
			 total: 1096,
			 fee: '0.00000150' } ] }
*/
var Order = Backbone.Model.extend({
	idAttribute: "order_id",
	defaults: {
		isDone: false,
		internalTradedUnits: 0,
		// dealedUnits: 0,	// dealed with bithumb. not store. calculate everytime
		adjustedUnits: 0	// adjusted with machines
	},
	initialize: function(attributes, options){
		this.done = false;	// if done this order
	},
	// var newOrder = new Order({machines: participants,
	// 							btParams: btParams,
	// 							internalTradedUnits: internalTradedUnits});
	adjust: function(){
		if(this.get("isDone"))
			return;
		var machines = this.get("machines"),
				adjustedUnits = this.get("adjustedUnits"),
				internalTradedUnits = this.get("internalTradedUnits"),
				data = this.get("data"),	// bithumb results
				type = this.get("btParams").type;

		var totalDuty = internalTradedUnits*2 + this.get("btParams").units;

		var dealedUnits = 0;	// dealed with bithumb
		_.each(this.get("data"), function(cont){
			dealedUnits = dealedUnits + (cont.units || cont.units_traded)*1;
		});

		var pendingMachines = new Machines();
		while(machines.length > 0){
			var m = machines.pop();
			if((internalTradedUnits*2+dealedUnits-adjustedUnits)
																							>= m.get("capacity")){
					m.trade();
					this.set({
						adjustedUnits: adjustedUnits+m.get("capacity")});
			}else{
				// penging machines..
				m.set("status", "pending");
				pendingMachines.push(m);
			}
		}
		this.set({machines: pendingMachines});
		if(pendingMachines.length==0){
			this.set({isDone: true});
			// order is done. destroy this
		}
	}	// adjust
});	// Order
var Orders = Backbone.Collection.extend({
  model: Order,
});

// propensity: "STATIC",	// means static capacity. "GREEDY"
// craving_krw: 2000,	// 2,000 won!
// cravingRatio: 0.5,	// means 50%
// capacity: 0.001,	// min btc 0.001
// negativeHope: -5000,
// positiveHope: -3000,
// neverHope: -10000,
// maxHope: 0,
// status: "krw"
var machines = new Machines([
												{	propensity: "STATIC",
													craving_krw: 2000,
													cravingRatio: 0.5,
													capacity: 0.001,	// btc
													negativeHope: -2000,
													positiveHope: 0,
													neverHope: -2000,
													maxHope: 0,
													status: "krw"},

												{	propensity: "STATIC",
													craving_krw: 2000,
													cravingRatio: 0.5,
													capacity: 0.001,	// btc
													negativeHope: -3000,
													positiveHope: -1000,
													neverHope: -3000,
													maxHope: -1000,
													status: "krw"},

												{	propensity: "STATIC",
													craving_krw: 2000,
													cravingRatio: 0.5,
													capacity: 0.001,	// btc
													negativeHope: -4000,
													positiveHope: -2000,
													neverHope: -4000,
													maxHope: -2000,
													status: "krw"},

												{	propensity: "STATIC",
													craving_krw: 2000,
													cravingRatio: 0.5,
													capacity: 0.001,	// btc
													negativeHope: -5000,
													positiveHope: -3000,
													neverHope: -5000,
													maxHope: -3000,
													status: "krw"},

												{	propensity: "STATIC",
													craving_krw: 20000,
													cravingRatio: 0.5,
													capacity: 1.0,	// btc
													negativeHope: -5000,
													positiveHope: -3000,
													neverHope: -10000,
													maxHope: 0,
													status: "krw"},
												{	propensity: "STATIC",
													craving_krw: 30000,
													cravingRatio: 0.5,
													capacity: 1.0,	// btc
													negativeHope: -5000,
													positiveHope: -3000,
													neverHope: -10000,
													maxHope: 0,
													status: "krw"}
												]);
var orders = new Orders();
var fee_krw, fee_btc = 0;
var startTime = new Date();
function tic(error, response, rgResult){
	var nowTime = new Date();
	console.log("=====", ++ticNumber, "== (", ((nowTime-startTime)/1000/60/60).toFixed(2), "hr", startTime.toLocaleString(), ") ====", new Date(), "==");

	Promise.all([new Promise(getBtc_usd),
			new Promise(getUsd_krw),
			new Promise(getBtc_krw)]).then(function (values) {
		// console.log("all clear", values);
		var btc_usd = values[0],
			usd_krw = values[1],
			btc_krw = values[2];
		var hope = btc_krw - btc_usd*usd_krw;
		if (minHope[0] > hope){
			minHope = [hope.toFixed(2), btc_krw];
		}
		if (maxHope[0] < hope){
			maxHope = [hope.toFixed(2), btc_krw];
		}
		if (minBtc_krw[1] > btc_krw)
			minBtc_krw = [hope.toFixed(2), btc_krw];
		if (maxBtc_krw[1] < btc_krw)
			maxBtc_krw = [hope.toFixed(2), btc_krw];
		// console.log("btc_usd*usd_krw:", btc_usd*usd_krw);
		console.log("hope\t\tmin:", minHope, "\tmax:", maxHope);
		console.log("btc_krw\t\tmin:", minBtc_krw, "\tmax:", maxBtc_krw);
		console.log("now\t\t", [hope, btc_krw]);

		/*
					var params = {
						order_id: "1485052731599",	// "1485011389177",
						type: "bid"
					};
					xcoinAPI.xcoinApiCall("/info/order_detail", params, function(result){
						console.log(result);
						{ status: '5600', message: '거래 체결내역이 존재하지 않습니다.' }
						or
						{ status: '0000',
						  data:
						   [ { cont_no: '1445825',
						       transaction_date: '1485011389000',
						       type: 'bid',
						       order_currency: 'BTC',
						       payment_currency: 'KRW',
						       units_traded: '0.001',
						       price: '1096000',
						       fee: '0.0000015',
						       total: '1096' } ] }
					});
					return;
		*/


		// var params = {
		// 	units: "0.001",
		// 	type: "bid",
		// 	price: btc_krw.toString()
		// };
		// var params = machine.mind({hope:hope, btc_krw:btc_krw});
		var totalBid =0, totalAsk = 0;
		var participants = new Machines();
		machines.each(function(m){
			var mind = m.mind({hope:hope, btc_krw:btc_krw});
			switch (mind.type) {
				case "bid":
					participants.push(m);
					totalBid = totalBid + mind.units*1;
					break;
				case "ask":
					participants.push(m);
					totalAsk = totalAsk + mind.units*1;
					break;
				default:
					// console.log("asdf");
			}
		});

		var internalTradedUnits=0, btParams={};
		if(totalBid > totalAsk){
			internalTradedUnits = totalAsk;
			btParams = {type: "bid",
									units: (totalBid-totalAsk).toString() }
		}else if(totalBid < totalAsk){
			internalTradedUnits = totalBid;
			btParams = {type: "ask",
									units: (totalAsk-totalBid).toString() }
		}else if(totalBid == totalAsk){
			internalTradedUnits = totalBid;
			btParams = {type: "none"};
		}
		// now `btParams` is completed..
		if(participants.length > 0){
			console.log("participants.length", participants.length);
			var newOrder = new Order({machines: participants,
										btParams: btParams,
										internalTradedUnits: internalTradedUnits});
			orders.push(newOrder);
			// console.log(btParams, totalBid, totalAsk, btc_krw);
			if( btParams.type=="ask" || btParams.type=="bid"){
				btParams.price = btc_krw.toString();
				// console.log(btParams);
				// return;
				xcoinAPI.xcoinApiCall('/trade/place', btParams, function(result){
					newOrder.set(result);
					newOrder.adjust();

					refreshOrdersChainAt(0);
					machines.each(function(m){
						console.log("traded_count:", m.get("traded_count"),
											" profit_krw:", m.get("profit_krw"),
											" capacity:", m.get("capacity"),
											" craving_krw:", m.get("craving_krw"),
											" negativeHope:", m.get("negativeHope"),
											" positiveHope:", m.get("positiveHope"));
					});
				});
			}else if( btParams.type=="none" && internalTradedUnits>0){
				newOrder.adjust();
			}
		}

		function refreshOrdersFromBithumb(){
			// for pending orders..
			orders.each(function(o){
				// console.log(o.attributes);
				if( o.get("isDone") || !o.get("order_id"))
					return;
				var params = {
					order_id: o.get("order_id").toString(), //"1485052731599",	// "1485011389177",
					type: o.get("btParams").type
				};
				xcoinAPI.xcoinApiCall("/info/order_detail", params, function(result){
					o.set(result);
					o.adjust();
				});
			});
		}

		function refreshOrdersChainAt(index){
			index = index || 0;
			if(orders.length <= index){
				return;
			}
			var o = orders.at(index);
			if( o.get("isDone") || !o.get("order_id"))
				return;
			var params = {
				order_id: o.get("order_id").toString(), //"1485052731599",	// "1485011389177",
				type: o.get("btParams").type
			};
			xcoinAPI.xcoinApiCall("/info/order_detail", params, function(result){
				o.set(result);
				o.adjust();
				refreshOrdersChainAt(index+1);
			});
		}


		// time to break
		setTimeout(tic, new Date()%58000 + 2000);	// 1 min
	}).catch(function(err){
		console.log("something happened in the promise", err);
		// but I'm going anyway
		setTimeout(tic, new Date()%58000 + 2000);	// 1 min
	});
}	// end of tic()






function XCoinAPI(api_key, api_secret){
	this.apiUrl = 'https://api.bithumb.com';
	this.api_key = api_key;
	this.api_secret = api_secret;
}

XCoinAPI.prototype.xcoinApiCall = function(endPoint, params, callback) {
	var rgParams = {
		'endPoint' : endPoint
	};

	if(params) {
		for(var o in params){
			rgParams[o] = params[o];
		}
	}

	var api_host = this.apiUrl + endPoint;
	var httpHeaders = this._getHttpHeaders(endPoint, rgParams, this.api_key, this.api_secret);

	var rgResult = this.request(api_host, 'POST', rgParams, httpHeaders, callback);
}

XCoinAPI.prototype.request = function(strHost, strMethod, rgParams, httpHeaders, callback) {
	var rgHeaders = {};
	if(httpHeaders) {
		rgHeaders = httpHeaders;
	}
	request({
		method : strMethod,
		uri : strHost,
		headers : rgHeaders,
		formData : rgParams
	},
	function(error, response, rgResult) {
		if(error) {
			console.log(error);
			return;
		}

		var rgResultDecode = JSON.parse(rgResult);
		// console.log(rgResultDecode);
		callback(rgResultDecode);
		// io.sockets.emit('XCoinAPIResponse', rgResultDecode);
	});
}


XCoinAPI.prototype._getHttpHeaders = function(endPoint, rgParams, api_key, api_secret) {
	var strData	= http_build_query(rgParams);
	var nNonce = this.usecTime();
	return {
		'Api-Key' : api_key,
		'Api-Sign' : (base64_encode(CryptoJS.HmacSHA512(endPoint + chr(0) + strData + chr(0) + nNonce, api_secret).toString())),
		'Api-Nonce' : nNonce
	};
}

XCoinAPI.prototype.usecTime = function(){
	var rgMicrotime = microtime().split(' '),
		usec = rgMicrotime[0],
		sec = rgMicrotime[1];

	usec = usec.substr(2, 3);
	return Number(String(sec) + String(usec));
}

function microtime(get_as_float) {
	//  discuss at: http://phpjs.org/functions/microtime/
	//	original by: Paulo Freitas
	//  example 1: timeStamp = microtime(true);
	//  example 1: timeStamp > 1000000000 && timeStamp < 2000000000
	//  returns 1: true

	var now = new Date()
			.getTime() / 1000;
	var s = parseInt(now, 10);

	return (get_as_float) ? now : (Math.round((now - s) * 1000) / 1000) + ' ' + s;
}

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
			var value = encodeURIComponent(obj[val].replace(/[!'()*]/g, escape));
			output_string.push(key + '=' + value)
		}
	})
// console.log("output_string:", output_string.join('&'));
	return output_string.join('&');
}

function base64_encode(data) {
	// discuss at: http://phpjs.org/functions/base64_encode/
	// original by: Tyler Akins (http://rumkin.com)
	// improved by: Bayron Guevara
	// improved by: Thunder.m
	// improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
	// improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
	// improved by: Rafał Kukawski (http://kukawski.pl)
	// bugfixed by: Pellentesque Malesuada
	// example 1: base64_encode('Kevin van Zonneveld');
	// returns 1: 'S2V2aW4gdmFuIFpvbm5ldmVsZA=='
	// example 2: base64_encode('a');
	// returns 2: 'YQ=='

	var b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
	var o1, o2, o3, h1, h2, h3, h4, bits, i = 0,
	ac = 0,
	enc = '',
	tmp_arr = [];

	if (!data) {
		return data;
	}

	do { // pack three octets into four hexets
		o1 = data.charCodeAt(i++);
		o2 = data.charCodeAt(i++);
		o3 = data.charCodeAt(i++);

		bits = o1 << 16 | o2 << 8 | o3;

		h1 = bits >> 18 & 0x3f;
		h2 = bits >> 12 & 0x3f;
		h3 = bits >> 6 & 0x3f;
		h4 = bits & 0x3f;

		// use hexets to index into b64, and append result to encoded string
		tmp_arr[ac++] = b64.charAt(h1) + b64.charAt(h2) + b64.charAt(h3) + b64.charAt(h4);
	} while (i < data.length);

	enc = tmp_arr.join('');

	var r = data.length % 3;

	return (r ? enc.slice(0, r - 3) : enc) + '==='.slice(r || 3);
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

/*
CryptoJS v3.1.2
code.google.com/p/crypto-js
(c) 2009-2013 by Jeff Mott. All rights reserved.
code.google.com/p/crypto-js/wiki/License
*/
var CryptoJS=CryptoJS||function(a,j){var c={},b=c.lib={},f=function(){},l=b.Base={extend:function(a){f.prototype=this;var d=new f;a&&d.mixIn(a);d.hasOwnProperty("init")||(d.init=function(){d.$super.init.apply(this,arguments)});d.init.prototype=d;d.$super=this;return d},create:function(){var a=this.extend();a.init.apply(a,arguments);return a},init:function(){},mixIn:function(a){for(var d in a)a.hasOwnProperty(d)&&(this[d]=a[d]);a.hasOwnProperty("toString")&&(this.toString=a.toString)},clone:function(){return this.init.prototype.extend(this)}},
u=b.WordArray=l.extend({init:function(a,d){a=this.words=a||[];this.sigBytes=d!=j?d:4*a.length},toString:function(a){return(a||m).stringify(this)},concat:function(a){var d=this.words,M=a.words,e=this.sigBytes;a=a.sigBytes;this.clamp();if(e%4)for(var b=0;b<a;b++)d[e+b>>>2]|=(M[b>>>2]>>>24-8*(b%4)&255)<<24-8*((e+b)%4);else if(65535<M.length)for(b=0;b<a;b+=4)d[e+b>>>2]=M[b>>>2];else d.push.apply(d,M);this.sigBytes+=a;return this},clamp:function(){var D=this.words,d=this.sigBytes;D[d>>>2]&=4294967295<<
32-8*(d%4);D.length=a.ceil(d/4)},clone:function(){var a=l.clone.call(this);a.words=this.words.slice(0);return a},random:function(D){for(var d=[],b=0;b<D;b+=4)d.push(4294967296*a.random()|0);return new u.init(d,D)}}),k=c.enc={},m=k.Hex={stringify:function(a){var d=a.words;a=a.sigBytes;for(var b=[],e=0;e<a;e++){var c=d[e>>>2]>>>24-8*(e%4)&255;b.push((c>>>4).toString(16));b.push((c&15).toString(16))}return b.join("")},parse:function(a){for(var d=a.length,b=[],e=0;e<d;e+=2)b[e>>>3]|=parseInt(a.substr(e,
2),16)<<24-4*(e%8);return new u.init(b,d/2)}},y=k.Latin1={stringify:function(a){var b=a.words;a=a.sigBytes;for(var c=[],e=0;e<a;e++)c.push(String.fromCharCode(b[e>>>2]>>>24-8*(e%4)&255));return c.join("")},parse:function(a){for(var b=a.length,c=[],e=0;e<b;e++)c[e>>>2]|=(a.charCodeAt(e)&255)<<24-8*(e%4);return new u.init(c,b)}},z=k.Utf8={stringify:function(a){try{return decodeURIComponent(escape(y.stringify(a)))}catch(b){throw Error("Malformed UTF-8 data");}},parse:function(a){return y.parse(unescape(encodeURIComponent(a)))}},
x=b.BufferedBlockAlgorithm=l.extend({reset:function(){this._data=new u.init;this._nDataBytes=0},_append:function(a){"string"==typeof a&&(a=z.parse(a));this._data.concat(a);this._nDataBytes+=a.sigBytes},_process:function(b){var d=this._data,c=d.words,e=d.sigBytes,l=this.blockSize,k=e/(4*l),k=b?a.ceil(k):a.max((k|0)-this._minBufferSize,0);b=k*l;e=a.min(4*b,e);if(b){for(var x=0;x<b;x+=l)this._doProcessBlock(c,x);x=c.splice(0,b);d.sigBytes-=e}return new u.init(x,e)},clone:function(){var a=l.clone.call(this);
a._data=this._data.clone();return a},_minBufferSize:0});b.Hasher=x.extend({cfg:l.extend(),init:function(a){this.cfg=this.cfg.extend(a);this.reset()},reset:function(){x.reset.call(this);this._doReset()},update:function(a){this._append(a);this._process();return this},finalize:function(a){a&&this._append(a);return this._doFinalize()},blockSize:16,_createHelper:function(a){return function(b,c){return(new a.init(c)).finalize(b)}},_createHmacHelper:function(a){return function(b,c){return(new ja.HMAC.init(a,
c)).finalize(b)}}});var ja=c.algo={};return c}(Math);
(function(a){var j=CryptoJS,c=j.lib,b=c.Base,f=c.WordArray,j=j.x64={};j.Word=b.extend({init:function(a,b){this.high=a;this.low=b}});j.WordArray=b.extend({init:function(b,c){b=this.words=b||[];this.sigBytes=c!=a?c:8*b.length},toX32:function(){for(var a=this.words,b=a.length,c=[],m=0;m<b;m++){var y=a[m];c.push(y.high);c.push(y.low)}return f.create(c,this.sigBytes)},clone:function(){for(var a=b.clone.call(this),c=a.words=this.words.slice(0),k=c.length,f=0;f<k;f++)c[f]=c[f].clone();return a}})})();
(function(){function a(){return f.create.apply(f,arguments)}for(var j=CryptoJS,c=j.lib.Hasher,b=j.x64,f=b.Word,l=b.WordArray,b=j.algo,u=[a(1116352408,3609767458),a(1899447441,602891725),a(3049323471,3964484399),a(3921009573,2173295548),a(961987163,4081628472),a(1508970993,3053834265),a(2453635748,2937671579),a(2870763221,3664609560),a(3624381080,2734883394),a(310598401,1164996542),a(607225278,1323610764),a(1426881987,3590304994),a(1925078388,4068182383),a(2162078206,991336113),a(2614888103,633803317),
a(3248222580,3479774868),a(3835390401,2666613458),a(4022224774,944711139),a(264347078,2341262773),a(604807628,2007800933),a(770255983,1495990901),a(1249150122,1856431235),a(1555081692,3175218132),a(1996064986,2198950837),a(2554220882,3999719339),a(2821834349,766784016),a(2952996808,2566594879),a(3210313671,3203337956),a(3336571891,1034457026),a(3584528711,2466948901),a(113926993,3758326383),a(338241895,168717936),a(666307205,1188179964),a(773529912,1546045734),a(1294757372,1522805485),a(1396182291,
2643833823),a(1695183700,2343527390),a(1986661051,1014477480),a(2177026350,1206759142),a(2456956037,344077627),a(2730485921,1290863460),a(2820302411,3158454273),a(3259730800,3505952657),a(3345764771,106217008),a(3516065817,3606008344),a(3600352804,1432725776),a(4094571909,1467031594),a(275423344,851169720),a(430227734,3100823752),a(506948616,1363258195),a(659060556,3750685593),a(883997877,3785050280),a(958139571,3318307427),a(1322822218,3812723403),a(1537002063,2003034995),a(1747873779,3602036899),
a(1955562222,1575990012),a(2024104815,1125592928),a(2227730452,2716904306),a(2361852424,442776044),a(2428436474,593698344),a(2756734187,3733110249),a(3204031479,2999351573),a(3329325298,3815920427),a(3391569614,3928383900),a(3515267271,566280711),a(3940187606,3454069534),a(4118630271,4000239992),a(116418474,1914138554),a(174292421,2731055270),a(289380356,3203993006),a(460393269,320620315),a(685471733,587496836),a(852142971,1086792851),a(1017036298,365543100),a(1126000580,2618297676),a(1288033470,
3409855158),a(1501505948,4234509866),a(1607167915,987167468),a(1816402316,1246189591)],k=[],m=0;80>m;m++)k[m]=a();b=b.SHA512=c.extend({_doReset:function(){this._hash=new l.init([new f.init(1779033703,4089235720),new f.init(3144134277,2227873595),new f.init(1013904242,4271175723),new f.init(2773480762,1595750129),new f.init(1359893119,2917565137),new f.init(2600822924,725511199),new f.init(528734635,4215389547),new f.init(1541459225,327033209)])},_doProcessBlock:function(a,b){for(var c=this._hash.words,
f=c[0],j=c[1],d=c[2],l=c[3],e=c[4],m=c[5],N=c[6],c=c[7],aa=f.high,O=f.low,ba=j.high,P=j.low,ca=d.high,Q=d.low,da=l.high,R=l.low,ea=e.high,S=e.low,fa=m.high,T=m.low,ga=N.high,U=N.low,ha=c.high,V=c.low,r=aa,n=O,G=ba,E=P,H=ca,F=Q,Y=da,I=R,s=ea,p=S,W=fa,J=T,X=ga,K=U,Z=ha,L=V,t=0;80>t;t++){var A=k[t];if(16>t)var q=A.high=a[b+2*t]|0,g=A.low=a[b+2*t+1]|0;else{var q=k[t-15],g=q.high,v=q.low,q=(g>>>1|v<<31)^(g>>>8|v<<24)^g>>>7,v=(v>>>1|g<<31)^(v>>>8|g<<24)^(v>>>7|g<<25),C=k[t-2],g=C.high,h=C.low,C=(g>>>19|
h<<13)^(g<<3|h>>>29)^g>>>6,h=(h>>>19|g<<13)^(h<<3|g>>>29)^(h>>>6|g<<26),g=k[t-7],$=g.high,B=k[t-16],w=B.high,B=B.low,g=v+g.low,q=q+$+(g>>>0<v>>>0?1:0),g=g+h,q=q+C+(g>>>0<h>>>0?1:0),g=g+B,q=q+w+(g>>>0<B>>>0?1:0);A.high=q;A.low=g}var $=s&W^~s&X,B=p&J^~p&K,A=r&G^r&H^G&H,ka=n&E^n&F^E&F,v=(r>>>28|n<<4)^(r<<30|n>>>2)^(r<<25|n>>>7),C=(n>>>28|r<<4)^(n<<30|r>>>2)^(n<<25|r>>>7),h=u[t],la=h.high,ia=h.low,h=L+((p>>>14|s<<18)^(p>>>18|s<<14)^(p<<23|s>>>9)),w=Z+((s>>>14|p<<18)^(s>>>18|p<<14)^(s<<23|p>>>9))+(h>>>
0<L>>>0?1:0),h=h+B,w=w+$+(h>>>0<B>>>0?1:0),h=h+ia,w=w+la+(h>>>0<ia>>>0?1:0),h=h+g,w=w+q+(h>>>0<g>>>0?1:0),g=C+ka,A=v+A+(g>>>0<C>>>0?1:0),Z=X,L=K,X=W,K=J,W=s,J=p,p=I+h|0,s=Y+w+(p>>>0<I>>>0?1:0)|0,Y=H,I=F,H=G,F=E,G=r,E=n,n=h+g|0,r=w+A+(n>>>0<h>>>0?1:0)|0}O=f.low=O+n;f.high=aa+r+(O>>>0<n>>>0?1:0);P=j.low=P+E;j.high=ba+G+(P>>>0<E>>>0?1:0);Q=d.low=Q+F;d.high=ca+H+(Q>>>0<F>>>0?1:0);R=l.low=R+I;l.high=da+Y+(R>>>0<I>>>0?1:0);S=e.low=S+p;e.high=ea+s+(S>>>0<p>>>0?1:0);T=m.low=T+J;m.high=fa+W+(T>>>0<J>>>0?1:
0);U=N.low=U+K;N.high=ga+X+(U>>>0<K>>>0?1:0);V=c.low=V+L;c.high=ha+Z+(V>>>0<L>>>0?1:0)},_doFinalize:function(){var a=this._data,b=a.words,c=8*this._nDataBytes,f=8*a.sigBytes;b[f>>>5]|=128<<24-f%32;b[(f+128>>>10<<5)+30]=Math.floor(c/4294967296);b[(f+128>>>10<<5)+31]=c;a.sigBytes=4*b.length;this._process();return this._hash.toX32()},clone:function(){var a=c.clone.call(this);a._hash=this._hash.clone();return a},blockSize:32});j.SHA512=c._createHelper(b);j.HmacSHA512=c._createHmacHelper(b)})();
(function(){var a=CryptoJS,j=a.enc.Utf8;a.algo.HMAC=a.lib.Base.extend({init:function(a,b){a=this._hasher=new a.init;"string"==typeof b&&(b=j.parse(b));var f=a.blockSize,l=4*f;b.sigBytes>l&&(b=a.finalize(b));b.clamp();for(var u=this._oKey=b.clone(),k=this._iKey=b.clone(),m=u.words,y=k.words,z=0;z<f;z++)m[z]^=1549556828,y[z]^=909522486;u.sigBytes=k.sigBytes=l;this.reset()},reset:function(){var a=this._hasher;a.reset();a.update(this._iKey)},update:function(a){this._hasher.update(a);return this},finalize:function(a){var b=
this._hasher;a=b.finalize(a);b.reset();return b.finalize(this._oKey.clone().concat(a))}})})();



if(require.main === module) {
	console.log("tic.", new Date());
	tic();
}
