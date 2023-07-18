'use strict';
const ccxt = require ('ccxt');
const wss = require ('ws');
const fs = require('fs')

const mysql = require('mysql');
const request = require('request');
var url = require('url');
const crypto = require('crypto');
//const querystring = require('querystring');
const querystring = require('qs');
var util = require('util');
const sync_request = require('sync-request');

var conf_data = "";
 
const islem_ac = 1;
const bildirim_gonder=1; 
const kanal_bildirim_gonder=1;
var last_ping = 0;
var fake_signal_t=0;

var sl_tp_wait_seconds=15;
var signal_cancel_seconds=(60*30);


try {
  conf_data = fs.readFileSync('config.py', 'utf8');
 
} catch (err) {
  console.error(err);
}

const my_host = conf_data.split('mysql_host = "')[1].split('"')[0];
const my_user = conf_data.split('mysql_user = "')[1].split('"')[0];
const my_pass = conf_data.split('mysql_pass = "')[1].split('"')[0];
const my_name = conf_data.split('mysql_name = "')[1].split('"')[0];
 

let db = mysql.createConnection({
  host: my_host,
  port:3306,
  user: my_user,
  password: my_pass, 
  database: my_name
});



let today_date = new Date()
today_date=today_date.toISOString().split('T')[0]

var logFile = fs.createWriteStream('trade_bot_log'+today_date+'.txt', { flags: 'a' });
  // Or 'w' to truncate the file every time the process starts.
var logStdout = process.stdout;

console.log = function () {
  logFile.write(util.format.apply(null, arguments) + '\n');
  logStdout.write(util.format.apply(null, arguments) + '\n');
}
console.error = console.log;




db.connect(function (err) {
  if (err) console.log("err:",err);

  console.log('MySQL bağlantısı başarıyla gerçekleştirildi');

})

var start_ed={};
var binance_symbols={}
var binance_ws_symbols=[]
var binance_pending=[];
var binance_unpending=[];
var bn_wsp;
var binance_ready=0;
var time_shift=3*60*60*1000;
var max_lots={};


async function symbol_ws_reconnect(borsa) {
	
	try {
	
	while(true) {
		
		if(binance_ws.readyState==1) {
			break;
		} else  {
			await wait(100);
		}
	}
	
	var sdata = binance_ws_symbols;
	
	
	for(var i=0;i<sdata.length;i++) {
		
		var symbol = sdata[i];
		symbol = symbol.toLowerCase();
		
		if (borsa == "binance") {
			if(binance_pending.indexOf(symbol)==-1) {
				binance_pending.push(symbol);	
			}
		} else if (borsa == "mexc") {
			
			var sm = brd[borsa]['symbol'][symbol]
			console.log("sm:",sm);
			var sym_name = sm.base+"_"+sm.quote;
			var wes = {"method":"sub.ticker","param":{"symbol":sym_name}};
			console.log("mexc socket start -> ",wes);
			mexc_ws.send(JSON.stringify(wes));
			
		}

	}
	
	} catch(err) {
		console.log("symbol_ws_reconnect_err :",err);
	}

}	


	
function binance_websocket(reconnect=0) {
	
	try {
	
	var bws = new wss('wss://fstream.binance.com/ws');
	bws.on('open', function open() {
	  console.log('binance websocket started');
	  if(reconnect==1) symbol_ws_reconnect("binance");
	  // ws.send(Date.now());

	  
	  
	});

	bws.on('message', function message(dat) {
	  var data = JSON.parse(dat)
	 
	  if (data.s != undefined) {
		 
		  var symbol = data.s
		  
		  binance_symbols[symbol].bid = data.b
		  binance_symbols[symbol].ask = data.a
		  binance_symbols[symbol].date = data.E
		  

	  }
	  
	});

	bws.on('close', function close() {
	  console.log('binance websocket disconnected');
	  binance_ws = binance_websocket(1);
	  
	  
	});
	
	} catch(err) {
		console.log("binance websocket error:",err);
	}
	
	return bws;
}


var binance_ws = binance_websocket();


  bn_wsp = setInterval(function() {
		
		try {
			
			if (binance_ws.readyState==0) {
				return;
			}
			
			if ( binance_pending.length>0 ) {
				
				var symbol = binance_pending[0];
				var borsa = "binance";
				
				
				if(binance_ws_symbols.indexOf(symbol)==-1) { 
					var sym_name = symbol.toLowerCase();
					var wes = {"method": "SUBSCRIBE","params": [sym_name+"@bookTicker"],"id": binance_ws_symbols.length+1};
					console.log("binance socket subscribe -> ",wes);
					binance_ws.send(JSON.stringify(wes));
					binance_ws_symbols.push(symbol);
				
				}
				
					binance_pending=binance_pending.slice(1);
				
			}
			
			if ( binance_unpending.length>0 ) {
				
				var symbol = binance_unpending[0];
				var borsa = "binance";
				
				var sdata = binance_ws_symbols;
				
				if(binance_ws_symbols.indexOf(symbol)>-1) { 
					var sym_name = symbol.toLowerCase();
					var wes = {"method": "UNSUBSCRIBE","params": [sym_name+"@bookTicker"],"id": binance_ws_symbols.length};
					console.log("binance socket unsubscribe -> ",wes);
					binance_ws.send(JSON.stringify(wes));
					binance_ws_symbols=arrayRemove(binance_ws_symbols, symbol);
				
				}
				
					binance_unpending=binance_unpending.slice(1);
				
			}
		} catch(err) {
			console.log("err:",err)
		}				
		// console.log("binance socket open ",new Date()," ",binance_pending)
		
},250);
	


function ajax_query(sql){

	var d_yol = __dirname.split("/")
	var user_dir = d_yol[d_yol.length-1]
	
	var a_sql = querystring.stringify({q: sql});
	
	var res = sync_request('GET', "http://localhost/"+user_dir+"/ajax.php?"+a_sql);
	var body = res.getBody();
	return JSON.parse(body);
}

async function bildirim_ekle(user_id,msg,durum=0) {
	
	//return
	
	if(msg==undefined) return;
	msg = msg.toString().split("'").join("").split("\"").join("");
	console.log("bildirim("+user_id+")=",msg);
	if(bildirim_gonder==1) await mysql_query("insert into bildirimler values('','"+user_id+"','"+msg+"','"+durum+"')")
	
}

async function ch_bildirim_ekle(user_id,post_id,symbol,trend,open,opendate,sl,last,lastdate,cmd,profit,msg) {
	
	//return
	if(msg==undefined) return;
	if(user_id==0) return;
	msg = msg.toString().split("'").join("").split("\"").join("");
	console.log("bildirim_ch("+user_id+")=",msg);
	var bild_sql = "INSERT INTO `bildirimler_ch` (`id`, `user_id`, `post_id`, `symbol`, `trend`, `open`, `opendate`, `sl`, `last`, `lastdate`, `cmd`, `profit`, `msg`, `gonderim`)"+ 	"VALUES (NULL, '"+user_id+"', '"+post_id+"', '"+symbol+"', '"+trend+"', '"+open+"', '"+opendate+"', '"+sl+"', '"+last+"', '"+lastdate+"', '"+cmd+"', '"+profit+"', '"+msg+"', '');";
	//console.log(bild_sql)
	if(kanal_bildirim_gonder==1) await mysql_query(bild_sql);
	
}


function format_date(tm) {
	let yourDate = new Date(parseInt(tm))
	yourDate = yourDate.toISOString().split('+')[0].replace("T"," ")
	yourDate = yourDate.split('.')[0].replace("Z"," ")
	return (yourDate)
}


function datetime() {
	var suan = format_date(new Date().getTime())
	return suan;
}


function wait(time) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve();
        }, time);
    });
}

async function mysql_query(query) {
	
	//console.log("mysql_query() ",query);
	
	var data2 = await new Promise((resolve, reject) => {
		db.query(query, function (err, rows) {
			if(err){
				//console.log(err);
			}else{
				//console.log("rows:",rows);
				return resolve(rows)
			}
		});
  
	}).then(data => data);	
	return data2;
	
}

function preg_match_all(regex, str) {
  return new RegExp(regex,'g').test(str)
}

function strtotime(tm) {
	
	var taym = Math.round(new Date(tm).getTime()/1000)
	return taym
	
}

function time() {
	
	var taym = Math.round(new Date().getTime()/1000)
	return taym
	
	
}

function stripslashes(htm) {
	
	htm = htm.replace("\\\"","\"")
	htm = htm.replace("\\\'","\'")
	return htm 
}

function str_replace(rep1,rep2,data) {
	var data2 = data.replace(rep1,rep2);
	return data2;
}

function stristr(data,ara) {
	if(data.indexOf(ara)>-1) {
		return true;
	} else {
		return false;
	}
	
}

function count(say) {
	return say.length;
}

function number_format(rakam,digit,a1="",a2="") {
	return parseFloat(rakam).toFixed(digit);
}


async function api_create_order(b_api,csymbol,side,type,amount,price,cls=0) {
	
		console.log("api_create_order(b_api,",csymbol,",",side,",",type,",",amount,",",price,",",cls,")");
	
        var order;
		var response;
		
		var symbol = binance_symbols[csymbol].base+"/"+binance_symbols[csymbol].quote
		
		var o_symbol = symbol;
		var o_type = type;
		var o_side = side;
		var o_amount = amount;
		var o_price=price;
		var o_params={};
		

		if (type=="MARKET") {
			
			o_price=0;
			
			
		} else if (type == "LIMIT") {
		
			
		} else if (type=="SL") {
			
			o_type = "STOP_MARKET";
			o_params = {
				'closePosition': 'true',
				'stopPrice': price
			};
			
		} else if (type=="TP") {
		
			o_type = "TAKE_PROFIT_MARKET";
			o_params = {
				'closePosition': 'true',
				'stopPrice': price
			};
			
		}
		
		if (cls==1) {
			o_params['reduceOnly'] = "true";
		}
		
		var response;
		
		try {
		
			var reqs = await b_api.createOrder(o_symbol, o_type, o_side, o_amount, o_price, o_params);
			
			response=reqs['info'];
			
			if (response['code']==undefined) {
				response['code']=0;
				response['msg']="";
			}
			
		} catch(c_err) {
			
			var c_msg = c_err.message;
			c_msg = c_msg.split("binanceusdm")[1]
			response = JSON.parse(c_msg);
			console.log("create_order_err:",c_err.message," ",response);
		}
		
		
	
	return response;
	
}

async function api_open_orders(b_api,csymbol) {
	 
        var order;
		var response;
		
		var symbol = binance_symbols[csymbol].base+"/"+binance_symbols[csymbol].quote
		
		var o_symbol = symbol;
		var o_id = orderid;
		
		var response;
		
		try {
		
			response = await b_api.fetchOpenOrders(o_id,o_symbol);
		} catch(c_err) {
			
			var c_msg = c_err.message;
			c_msg = c_msg.split("binanceusdm")[1]
			response = JSON.parse(c_msg);
			console.log("c_open_orders_err:",c_err.message," ",response);
		}
		
	return response;
	
}

async function api_position_risk(b_api) {
	var posr = await b_api.fetchPositionsRisk();
	var vpr={};
	for(var a1 in posr) {
		var a2 = posr[a1].info;
		vpr[a2['symbol']]=parseFloat(a2['positionAmt']);
		
	}
	return vpr;
}

async function api_order_delete(b_api,csymbol,orderid) {
	

        var order;
		var response;
		
		var symbol = binance_symbols[csymbol].base+"/"+binance_symbols[csymbol].quote
		
		var o_symbol = symbol;
		var o_id = orderid;
		
		var response;
		
		try {
		
			response = await b_api.cancelOrder(o_id,o_symbol);
			
			response=response['info'];
			
		} catch(c_err) {
			
			var c_msg = c_err.message;
			c_msg = c_msg.split("binanceusdm")[1]
			response = JSON.parse(c_msg);
			console.log("c_order_delete_err:",c_err.message," ",response);
		}
		
	return response;
	
}


async function create_order(b_api,sid) {
	
	try {

		var rsi = await mysql_query("SELECT * FROM `user_signals` WHERE id='"+sid+"'");
		var us=rsi[0]
		
		if(us['close']>0 || us['open']>0) return;

		var rsi1 = await mysql_query("SELECT * FROM `signals` WHERE id='"+us['signal_id']+"'");
		var sg=rsi1[0]

		var api1 = await mysql_query("SELECT * FROM `apikeys` WHERE id='"+us['api_id']+"'");
		var api=api1[0]
		var user_id = api['user_id'];

		var symbol = us["symbol"];
		var sym = binance_symbols[symbol]
		var s_id = sg['id'];
		var us_id = us['id'];
		
		
		
		var price = 0;
		var volume=number_format(api['lot'],sym['vdigits'],"+","");
		var sprice=number_format(sg['sl'],sym['digits'],"+","");
		
		var sinyal_tp = sg['tp10'];
		if(sinyal_tp==0) sinyal_tp = sg['tp9'];
		if(sinyal_tp==0) sinyal_tp = sg['tp8'];
		if(sinyal_tp==0) sinyal_tp = sg['tp7'];
		if(sinyal_tp==0) sinyal_tp = sg['tp6'];
		if(sinyal_tp==0) sinyal_tp = sg['tp5'];
		if(sinyal_tp==0) sinyal_tp = sg['tp4'];
		if(sinyal_tp==0) sinyal_tp = sg['tp3'];
		if(sinyal_tp==0) sinyal_tp = sg['tp2'];
		if(sinyal_tp==0) sinyal_tp = sg['tp1'];
		
		
		var tprice=number_format(sinyal_tp,sym['digits'],"+","");
		
		var p_risk = await api_position_risk(b_api)
		
		var emir_adet = 0;
		
		for(var a in p_risk) {
			var b = p_risk[a];
			if(b!=0) {
				emir_adet++;
			}
		}
		
		var orders=[];
		
		try {
		
		if(p_risk[symbol]!=0) {
			
			orders['code'] = -101;
			orders['msg'] = "zaten elinizde açık "+symbol+" pozisyonu olduğu için pozisyon açılamadı";
			
		} else if(emir_adet>=api['maxemir']) {
			
			orders={}
			orders['code'] = -102;
			orders['msg'] = "maksimum "+api["maxemir"]+" adet emir açmaya izin verdiğiniz için bu emir açılamadı. Şuan açık emir sayınız "+emir_adet;
			
		} else {
			
			var max_lot = max_lots[symbol];
			
			
			if(sg['trend']=="LONG") {
				var price = sym['ask'];
				var volume=number_format(api['lot']/price,sym['vdigits'],"+","");
				if(max_lot>0 && volume>max_lot) volume = number_format(max_lot,sym['vdigits'],"+","");
				var order_ticket = await api_create_order(b_api,symbol,"BUY","MARKET",volume,price);
				console.log("order_ticket:",order_ticket);
				orders.push(order_ticket)

				
				if (order_ticket['code']==0) {
					
					if(api['stoploss'] == 0 && api['sltpemir']==1) {
						var order_sl = await api_create_order(b_api,symbol,"SELL","SL",0,sprice);
						orders.push(order_sl)
					} else if(api['stoploss']>0 && api['sltpemir']==1) {
						var sprice = number_format(sym['ask']*((100-api['stoploss'])/100),sym['digits'],"+","");
						var order_sl = await api_create_order(b_api,symbol,"SELL","SL",0,sprice);
						orders.push(order_sl)
					} else {
						var order_sl={'orderId':0}
						orders.push(order_sl)
					}	
					
					if(api['takeprofit'] == 0 && api['sltpemir']==1) {
						var tprice = sinyal_tp;
						var order_tp = await api_create_order(b_api,symbol,"SELL","TP",0,tprice);
						orders.push(order_tp)
					} else if(api['takeprofit'] == -1 && api['sltpemir']==1) {
						var tprice = sg['tp1'];
						var order_tp = await api_create_order(b_api,symbol,"SELL","TP",0,tprice);
						orders.push(order_tp)
					} else if(api['takeprofit'] == -2 && api['sltpemir']==1) {
						var tprice = sg['tp2'];
						var order_tp = await api_create_order(b_api,symbol,"SELL","TP",0,tprice);
						orders.push(order_tp)
					} else if(api['takeprofit'] == -3 && api['sltpemir']==1) {
						var tprice = sg['tp3'];
						var order_tp = await api_create_order(b_api,symbol,"SELL","TP",0,tprice);
						orders.push(order_tp)
					} else if(api['takeprofit'] == -4 && api['sltpemir']==1) {
						var tprice = sg['tp4'];
						var order_tp = await api_create_order(b_api,symbol,"SELL","TP",0,tprice);
						orders.push(order_tp)
					} else if(api['takeprofit'] == -5 && api['sltpemir']==1) {
						var tprice = sg['tp5'];
						var order_tp = await api_create_order(b_api,symbol,"SELL","TP",0,tprice);
						orders.push(order_tp)
					} else if(api['takeprofit']>0 && api['sltpemir']==1) {
						var tprice = number_format(sym['ask']*((100+api['takeprofit'])/100),sym['digits'],"+","");
						var order_tp = await api_create_order(b_api,symbol,"SELL","TP",0,tprice);
						orders.push(order_tp)
					} else if (api['sltpemir']==1) {
						var tprice = sg['tp5'];
						var order_tp = await api_create_order(b_api,symbol,"SELL","TP",0,tprice);
						orders.push(order_tp)
					}
					
				}
				
				
			} else if(us['trend']=="SHORT") {
				price = sym['bid'];
				volume=number_format(api['lot']/price,sym['vdigits'],"+","");
				if(max_lot>0 && volume>max_lot) volume = number_format(max_lot,sym['vdigits'],"+","");

				var order_ticket = await api_create_order(b_api,symbol,"SELL","MARKET",volume,price);
				orders.push(order_ticket)
			
				if (order_ticket['code']==0) {

					if(api['stoploss'] == 0 && api['sltpemir']==1) {
						var order_sl = await api_create_order(b_api,symbol,"BUY","SL",0,sprice);
						orders.push(order_sl)
					} else if(api['stoploss']>0 && api['sltpemir']==1) {
						sprice = number_format(sym['ask']*((100+api['stoploss'])/100),sym['digits'],"+","");
						var order_sl = await api_create_order(b_api,symbol,"BUY","SL",0,sprice);
						orders.push(order_sl)
					} else {
						var order_sl={'orderId':0}
						orders.push(order_sl)
					}	
					
					if(api['takeprofit'] == 0 && api['sltpemir']==1) {
						var tprice = sinyal_tp;
						var order_tp = await api_create_order(b_api,symbol,"BUY","TP",0,tprice);
						orders.push(order_tp)
					} else if(api['takeprofit'] == -1) {
						var tprice = sg['tp1'];
						var order_tp = await api_create_order(b_api,symbol,"BUY","TP",0,tprice);
						orders.push(order_tp)
					} else if(api['takeprofit'] == -2) {
						var tprice = sg['tp2'];
						var order_tp = await api_create_order(b_api,symbol,"BUY","TP",0,tprice);
						orders.push(order_tp)
					} else if(api['takeprofit'] == -3) {
						var tprice = sg['tp3'];
						var order_tp = await api_create_order(b_api,symbol,"BUY","TP",0,tprice);
						orders.push(order_tp)
					} else if(api['takeprofit'] == -4) {
						var tprice = sg['tp4'];
						var order_tp = await api_create_order(b_api,symbol,"BUY","TP",0,tprice);
						orders.push(order_tp)
					} else if(api['takeprofit'] == -5) {
						var tprice = sg['tp5'];
						var order_tp = await api_create_order(b_api,symbol,"BUY","TP",0,tprice);
						orders.push(order_tp)
					} else if(api['takeprofit']>0) {
						var tprice = number_format(sym['ask']*((100-api['takeprofit'])/100),sym['digits'],"+","");
						var order_tp = await api_create_order(b_api,symbol,"BUY","TP",0,tprice);
						orders.push(order_tp)
					}
					
				}
				
			}	
			
			
		}
		
		} catch(err) {
			
		}
		
		var order_ticket = 0;
		var order_status = "";
		var sl_ticket = 0;
		var tp_ticket = 0;
		
		var error_code=0;
		var error_msg = "";		
		
		try {
			var error_code=orders[0]['code'];
			var error_msg = orders[0]['msg'];		
		} catch(err) {
			

			try {
				var error_code=orders['code'];
				var error_msg = orders['msg'];		
			} catch(err) {
				
				
			}			
			
		}
		
		try {
			var order_ticket = orders[0]['orderId'];
		} catch(err){ }
		try {
		var order_status = orders[0]['status'];
		} catch(err){ }
		try {
		var sl_ticket = orders[1]['orderId'];
		} catch(err){ }
		try {
		var tp_ticket = orders[2]['orderId'];
		} catch(err){ }
		
		
		//console.log("orders:",orders);
		
		
		var api_exchange="binance";
		
		//console.log("create order result : ",count(orders)," && order_ticket:",order_ticket);
		
		if(count(orders)>0 && order_ticket>0) {
			
			var results = "#"+order_ticket+" "+symbol+" "+volume+" "+us['trend']+" "+price+" #"+order_ticket+" "+price+" "+format_date(new Date().getTime())+" "+order_status;
			// echo(api['exchange']+"[u"+user_id+"] [s"+us['signal_id']+"] ["+api['id']+"] ->"+symbol+"->"+us['trend']+" results : "+results+"\n");
			
			var signal_str = api_exchange+" OPEN #"+order_ticket+"  "+us['symbol']+" "+us['trend']+" price:"+price+" sl:"+sprice+" volume:"+volume;
			await bildirim_ekle(user_id,signal_str,0);
			
			await mysql_query("update user_signals set open='"+price+"',ticket='"+order_ticket+"',sl='"+sprice+"',sticket='"+sl_ticket+"',tticket='"+tp_ticket+"',opentime='"+datetime()+"',volume='"+volume+"',status=1 where id ='"+us['id']+"'");
			console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] "+results+"\n");

			if(sl_ticket>0) {
				
			} else {

				var sl_error_msg = stripslashes(orders[1]['msg']);
				sl_error_msg = str_replace("'","",sl_error_msg);
				sl_error_msg = str_replace("\"","",sl_error_msg);	
				if(stristr(sl_error_msg,"direction is existing")) {
					sl_ticket=-1;
				}
				
				
			}
			if(tp_ticket>0) {
				
			} else {

				var tp_error_msg = stripslashes(orders[2]['msg']);
				tp_error_msg = str_replace("'","",tp_error_msg);
				tp_error_msg = str_replace("\"","",tp_error_msg);	
				
				if(stristr(tp_error_msg,"direction is existing")) {
					tp_ticket=-1;
				}
				
			}
				
		

		} else if(error_code<0) {
			
			if(error_code == -4061) {
				error_msg = "Hesabınız hedge modunda olduğu için işlem açılamamıştır. Hesabınız one-way moduna aldığınızda işlemleriniz açılacaktır";
			} else if(error_code == -2019) {
				error_msg = "Hesap bakiyeniz bu işlemi açabilmek için yetersiz";
			} else if(error_code == -4164) {
				error_msg = "Kapatmak istediğiniz lot miktarı 6 USDT den küçük olamaz. 6 USDT den daha küçük bir pozisyon kapatmaya çalışıyorsunuz. ";
			} else if(error_code == -2015) {
				error_msg = "API key anahtarınız yanlıştır. Eğer doğru olduğunu düşünüyorsanız. Futures cüzdanı olup olmadığına, Api key için futures izni verip vermediğinize emin olun. ";
			}
			
			var error_msg = str_replace("'","",error_msg);
			error_msg = str_replace("\"","",error_msg);

			var signal_str = api_exchange+" Emir açılamadı. OPEN "+us['symbol']+" "+us['trend']+" ERROR price:"+price+" code:"+error_code+" msg:"+error_msg;
			await bildirim_ekle(user_id,signal_str,0);
			var new_sql = "update user_signals set open='"+price+"',close='"+price+"',opentime='"+datetime()+"',closetime='"+datetime()+"',status=2,ticket='-1',event='"+error_code+"|"+error_msg+"' where id = '"+us['id']+"'";
			
			console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] "+signal_str+"\n");
			
			await mysql_query(new_sql);	
				
				
		}	

	} catch(err2) {
		
		console.log(datetime()+" - create order error [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] : ", err2)
		
	}
	
	
}

async function trail_stop(b_api,sid,name,hedef,sprice) {


	var rsi = await mysql_query("SELECT * FROM `user_signals` WHERE id='"+sid+"'");
	var us=rsi[0]
	
	if(us['close']>0) return;

	var rsi1 = await mysql_query("SELECT * FROM `signals` WHERE id='"+us['signal_id']+"'");
	var sg=rsi1[0]


	var api1 = await mysql_query("SELECT * FROM `apikeys` WHERE id='"+us['api_id']+"'");
	var api=api1[0]
	var user_id = api['user_id'];


	var symbol = us["symbol"];
	var sym = binance_symbols[symbol]
	var s_id = sg['id'];
	var us_id = us['id'];
	
	var api_exchange="binance";

	
	if(us['sticket']>0) {
		
		var ord_delete = await api_order_delete(b_api,symbol,us['sticket']);
		//echo "order_delete:";
		//print_rr(ord_delete);
		await mysql_query("update user_signals set sticket='"+us['sticket']+"' where id ='"+us['id']+"'");
		
	}
	 
	var sprice=number_format(sprice,sym['digits'],"+","");	 
	var sl_ticket = await api_create_order(b_api,symbol,(us['trend']=="LONG" ? "SELL" : "BUY"),"SL",0,sprice);
	
	if(sl_ticket['orderId']>0) {
		var sticket=sl_ticket['orderId'];
		var signal_str = api_exchange+" #"+sticket+" UPDATE name "+us['symbol']+" yeni_hedef:"+hedef+" yeni_sl:"+sprice;
		await bildirim_ekle(user_id,signal_str,0);
		await mysql_query("update user_signals set sticket='"+sticket+"',sl='"+sprice+"' where id ='"+us['id']+"'");
		console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] "+signal_str+"\n");
	} else {
		
		var profit=0;
		if(us['trend']=="LONG") {
			profit=((us['sl']/us['open'])*api['lot'])-api['lot'];
		} else if(us['trend']=="SHORT") {
			profit=((us['open']/us['sl'])*api['lot'])-api['lot']; 
		}
		
		var signal_str = api_exchange+" #"+us['ticket']+" CLOSED name "+us['symbol']+" open:"+us['open']+" close:"+us['sl']+" profit:"+profit;
		await bildirim_ekle(user_id,signal_str,0);
		console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] "+signal_str+"\n");
		await mysql_query("update user_signals set closed_volume=volume,close=sl,closetime='"+datetime()+"',profit='"+profit+"' where id ='"+us['id']+"'");
	}
	
}	

async function close_order(b_api,sid,close_price=0,close_point="",close_volume=0) {
	
	
	var rsi = await mysql_query("SELECT * FROM `user_signals` WHERE id='"+sid+"'");
	var us=rsi[0]
	
	if(us['close']>0) return;

	var rsi1 = await mysql_query("SELECT * FROM `signals` WHERE id='"+us['signal_id']+"'");
	var sg=rsi1[0]

	var api1 = await mysql_query("SELECT * FROM `apikeys` WHERE id='"+us['api_id']+"'");
	var api=api1[0]
	var user_id = api['user_id'];


	var sym1 = await mysql_query("SELECT * FROM `symboldata` WHERE symbol='"+us['symbol']+"'");
	var sym=sym1[0]
	var symbol = us["symbol"];
	

	var api_exchange="binance";
	var symbol = us["symbol"];
	var sym = binance_symbols[symbol]
	var s_id = sg['id'];
	var us_id = us['id'];
	
	
	var price = 0;
	var volume=api['lot'];
	var sprice=sg['sl'];
	var tprice=sg['tp5'];
	
	var b_orders=[];
	var tamamen_kapandi=0;
	
	var p_risk = await api_position_risk(b_api);	
	var acik_poz = p_risk[symbol];
	
	if(acik_poz == 0) {

		var close_price = us['sl'];
		
		var kapat_volume = us['volume']-us['closed_volume'];

		if(sg['trend']=="LONG") {
			
			var profit = ((us['open']/us['sl'])*api['lot'])-api['lot'];
			var profit = profit*(kapat_volume/us['volume']);
			
		} else if(us['trend']=="SHORT") {
			
			var profit = ((us['open']/us['sl'])*api['lot'])-api['lot'];
			var profit = profit*(kapat_volume/us['volume']);

		}			

		var signal_str = api_exchange+" N-CLOSED "+us['symbol']+" "+us['trend']+" open:"+us['open']+" close:"+close_price+" lot:"+kapat_volume+" profit:"+profit;
		await bildirim_ekle(user_id,signal_str,0);
		console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] "+signal_str+"\n");
		await mysql_query("update user_signals set close='"+close_price+"',closed_volume=(closed_volume+"+kapat_volume+"),closetime='"+datetime()+"' where id ='"+us['id']+"'");
	
	} else if(us['volume']>us['closed_volume']) {
		
		var kapat_volume = number_format(us['volume']*(close_volume/100),sym['vdigits'],"+","");
		
		
		var min_lot = Math.pow(10,-sym['vdigits']);
		
		if(kapat_volume<min_lot) kapat_volume=min_lot;
		
		
		if(us['closed_volume']+kapat_volume>=us['volume']) {
			var kapat_volume = number_format(us['volume']-us['closed_volume'],sym['vdigits'],"+","");
			var tamamen_kapandi=1;
		}
		
		console.log("kapat_volume>>   us['volume']:",us['volume']," kapat_volume:",kapat_volume," close_volume:",close_volume," closed_volume:",us['closed_volume']," vdigits:",sym['vdigits']);
		
		var profit = 0;
		var price = 0;
		
		if(api['sltpemir']==1 && api['stoploss']!=-1) {
			if(sg['trend']=="LONG") {
				
				var price = sym['bid'];
				var kapat_ticket = await api_create_order(b_api,symbol,"SELL","MARKET",kapat_volume,price,1);
				var profit = ((us['open']/us['sl'])*api['lot'])-api['lot'];
				var profit = profit*(kapat_volume/us['volume']);
				
			} else if(us['trend']=="SHORT") {
				
				var price = sym['ask'];
				var kapat_ticket = await api_create_order(b_api,symbol,"BUY","MARKET",kapat_volume,price,1);
				var profit = ((us['open']/us['sl'])*api['lot'])-api['lot'];
				var profit = profit*(kapat_volume/us['volume']);

			}	
		}
		
		var order_ticket = kapat_ticket['orderId'];
		var order_status = kapat_ticket['status'];
		var api_exchange="binance";

		if(order_ticket>0) {
			
			var results = "#"+order_ticket+" "+symbol+" "+kapat_volume+" "+us['trend']+" "+price+" #"+order_ticket+" "+profit+" "+datetime()+" "+order_status;
			
			if(tamamen_kapandi==0) {

				var signal_str = api_exchange+" PARTIAL CLOSED "+us['symbol']+" "+us['trend']+" open:"+us['open']+" close:"+price+" lot:"+kapat_volume+" profit:"+profit;
				await bildirim_ekle(user_id,signal_str,0);
				console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] "+signal_str+"\n");
				await mysql_query("update user_signals set tp='"+close_price+"',closed_volume=(closed_volume+"+kapat_volume+") where id ='"+us['id']+"'");
			} else {

				var signal_str = api_exchange+" CLOSED "+us['symbol']+" "+us['trend']+" open:"+us['open']+" close:"+price+" lot:"+kapat_volume+" profit:"+profit;
				await bildirim_ekle(user_id,signal_str,0);
				console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] "+signal_str+"\n");
				await mysql_query("update user_signals set close='"+close_price+"',closed_volume=(closed_volume+"+kapat_volume+"),closetime='"+datetime()+"' where id ='"+us['id']+"'");
			}
				
		} else {

			var error_code = kapat_ticket['code'];
			var error_msg = stripslashes(kapat_ticket['msg']);
			var error_msg = str_replace("'","",error_msg);
			var error_msg = str_replace("\"","",error_msg);
			
			if (error_code == -100) {
				
				var kapat_volume = api['lot'];
				
				if(us['trend']=="LONG") {
					profit = ((us['open']/us['sl'])*api['lot'])-api['lot'];
					profit = profit*(kapat_volume/us['volume']);
				} else {
					profit = ((us['open']/us['sl'])*api['lot'])-api['lot'];
					profit = profit*(kapat_volume/us['volume']);
				}
				
				var signal_str = api_exchange+" CLOSED "+us['symbol']+" "+us['trend']+" open:"+us['open']+" close:"+price+" lot:"+kapat_volume+" profit:"+profit;
				await bildirim_ekle(user_id,signal_str,0);
				var new_sql = "update user_signals set close='"+price+"',closetime='"+datetime()+"',status=1 where id = '"+us['id']+"'";
				console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] "+signal_str+"\n");
				await mysql_query(new_sql);	
				
				
				
			} else {
				
				if(price==0)price=us['sl'];
				if(price==0)price=sg['entry1'];
				var signal_str = api_exchange+" Emir kapatılamadı. CLOSE "+us['symbol']+" "+us['trend']+" ERROR price:"+price+" code:"+error_code+" msg:"+error_msg;
				await bildirim_ekle(user_id,signal_str,0);
				var new_sql = "update user_signals set close='"+price+"',closetime='"+datetime()+"',status=2,event='"+error_code+"|"+error_msg+"' where id = '"+us['id']+"'";
				console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] "+signal_str+"\n");
				await mysql_query(new_sql);	
				
			}
			
		}	

	}
	
	
}	


async function run_user(sid) {
		
	console.log(datetime()+" - [s:"+sid+"] run_user("+sid+");\n");



	var rsi = await mysql_query("SELECT * FROM `user_signals` WHERE id='"+sid+"'");
	var us=rsi[0]
	var api_signal=us;


	var rsi1 = await mysql_query("SELECT * FROM `signals` WHERE id='"+us['signal_id']+"'");
	var sg=rsi1[0];



	var api1 = await mysql_query("SELECT * FROM `apikeys` WHERE id='"+us['api_id']+"'");
	var api=api1[0];

	var user_id = api['user_id'];
	var s_id = sg['id'];
	var us_id = us['id'];

	var symbol = us["symbol"];
	var sym=binance_symbols[symbol];
	var signal_id=sid;

	var api_key=api['api_key'];
	var api_secret=api['api_secret'];
	console.log("api_key:",api_key," api_secret:",api_secret)
	
	var b_user = new ccxt.binanceusdm ({
		'enableRateLimit': true,
        'apiKey': api_key,
        'secret': api_secret,
    });
	
	var api_exchange="binance";
	var price=sym['bid'];

	console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] started");

	try {
		var margin_sonuc;
		
		if(api['margin']==0) {
			margin_sonuc = await b_user.setMarginMode("ISOLATED",symbol);
		} else {
			margin_sonuc = await b_user.setMarginMode("CROSSED",symbol);
		}

		console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] margin_mode:",margin_sonuc)
		

	} catch(err) {
			
			var msg = err.message.replace("binanceusdm ","")
			var apikeyr = JSON.parse(msg);
			
			var error_code = apikeyr.code;
			var error_msg = apikeyr.msg;
			
			console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] margin_mode error:",apikeyr);
			
			var error_msg = error_msg.replace("'","");
			var error_msg = error_msg.replace('"','');
			
			var signal_str = api_exchange+" Emir açılamadı. OPEN "+api_signal['symbol']+" "+api_signal['trend']+" ERROR price:"+price+" code:"+error_code+" msg:"+error_msg;
			await bildirim_ekle(user_id,signal_str,0);
			var new_sql = "update user_signals set open='"+price+"',close='"+price+"',opentime='"+datetime()+"',closetime='"+datetime()+"',status=2,ticket='-1',event='"+error_code+"|"+error_msg+"' where id = '"+api_signal.id+"'";
			await mysql_query(new_sql);	
				
	} 

	try {

		var level_status = await b_user.setLeverage(api['leverage'],symbol);
		console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] leverage status:",level_status);
		

	} catch(leverage_err) {

			leverage_err = leverage_err.message.replace("binanceusdm ","")
			leverage_err = JSON.parse(leverage_err);
			
			console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] leverage error:",leverage_err);
			
		
	} 



	run_user_f(b_user,sid,s_id,user_id,us_id,symbol,signal_id);

}

async function run_user_f(b_user,sid,s_id,user_id,us_id,symbol,signal_id) {
	

	var rsi = await mysql_query("SELECT * FROM `user_signals` WHERE id='"+sid+"'");
	var us=rsi[0]
	var api_signal=us;	
	


	var rsi1 = await mysql_query("SELECT * FROM `signals` WHERE id='"+us['signal_id']+"'");
	var sg=rsi1[0];



	var api1 = await mysql_query("SELECT * FROM `apikeys` WHERE id='"+us['api_id']+"'");
	var api=api1[0];
	

	//console.log(datetime()+" - [s:"+sid+"] run_user_f("+sid+","+s_id+","+user_id+","+us_id+","+symbol+","+signal_id+");\n");
	
	var sym=binance_symbols[symbol];
	
	var user_timer;
	var fba=0;
	var loop_finished=1;
	
	//user_timer = setInterval(async function() {
		
	
	
	try {


		var aa1 = await mysql_query("SELECT * FROM user_signals where id = '"+signal_id+"';");
		var aa = aa1[0]


		if(aa['id']>0) { } else { 
			console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] "+api['name']+" "+signal['symbol']+" "+signal['trend']+" -> user_signals bulunamadı signal_id:"+signal_id); 
			//clearInterval(user_timer);
			return;
		}
		


		var rsi1 = await mysql_query("SELECT * FROM `signals` WHERE id='"+us['signal_id']+"'");
		
		var signal=rsi1[0]


		if ((aa['close']>0) || aa['ticket']==-1) {  
			console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] "+api['name']+" "+signal['symbol']+" "+signal['trend']+" ->  #"+aa['ticket']+" sinyal kapandı close:"+aa['close']); 
			//clearInterval(user_timer);
			return;
		}
		
		var symbol = signal['symbol'];
		var binance_digits = binance_symbols[symbol].digits
		var binance_vdigits = binance_symbols[symbol].vdigits
		
		var bid = binance_symbols[symbol].bid
		var ask = binance_symbols[symbol].ask
		
		if (ask == 0 || bid == 0) return;
		
		if(fba==0) {
			//console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] "+api['user_id']+" "+api['name']+" "+signal['symbol']+" "+signal['trend']+" "+signal['opendate']+" b:"+bid+" a:"+ask+" #"+aa['ticket']+" o:"+aa['open']+" "+aa['opentime']+" c:"+aa['close']+" "+aa['closetime']);
			fba=1;
		}
		
		var last_bid = bid;
		var last_ask = ask;
			
		

		if ( signal['trend'] == "LONG" ) {
			
			if(aa['close']>0 && aa['volume']<=aa['closed_volume']) {
				console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"]  "+signal['symbol']+" "+signal['trend']+" -> sinyal kapandığı için durduruldu close:"+aa['close']+" \n");
				//trade_log(user_id,signal_id+" "+signal['symbol']+" "+signal['trend']+" pozisyonu takibi tamamlandı. volume:"+aa['volume']+" closed_volume:"+aa['closed_volume'])
				//clearInterval(user_timer);
				return;
			} else if (aa['open'] == 0 && strtotime(signal['opendate'])>0 && strtotime(signal['opendate'])+signal_cancel_seconds>time() /* && aralikta(signal.entry1,signal.entry2,sym['bid'])*/ ) {
				await create_order(b_user,sid);
			} else if (aa['open']>0 && aa['close']==0) {	
				
				var new_sl = 0;
				var new_tp = 0;
				
				if(aa['sticket']<1 && api['sltpemir']==1 && aa['sl_wait']+sl_tp_wait_seconds<time() && api['exchange']=="binance" && api['stoploss'] != -1) {
					
					if(aa['sl']>0) {
						new_sl = aa['sl'];
					} else if(api['stoploss']==0) {
						new_sl = signal['sl'];
					} else if(api['stoploss']>0) {
						new_sl = number_format(sym['ask']*((100-api['stoploss'])/100),sym['digits'],"+","");
					}
					
					if(new_sl>0 && api['exchange']=="binance") {
						// send_json = {"symbol":signal['symbol'],"side":"SELL","type":"STOP_MARKET","closePosition":"true","stopPrice":new_sl};	
						sl_ticket = await api_create_order(signal['symbol'],"SELL","SL",0,new_sl)
						sl_order_id=0;
						if(sl_ticket['orderId']>0) {
							await mysql_query("update user_signals set sl='"+new_sl+"',sl_wait='"+time()+"',sticket='"+sl_ticket['orderId']+"' where id ='"+aa['id']+"'");		
							console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] fix broken sl #"+sl_ticket['orderId']+" new_sl:"+new_sl+"\n");
							aa['sl'] = new_sl;
							sl_order_id=sl_ticket['orderId'];
						} else {
							
							error_code = sl_ticket['code'];
							error_msg = stripslashes(sl_ticket['msg']);
							error_msg = str_replace("'","",error_msg);
							error_msg = str_replace("\"","",error_msg);
							
							p_risk = await api_position_risk(b_user);	
							acik_poz = p_risk[signal['symbol']];
							
							if(acik_poz==0) {

								close_price = aa['sl'];
								
								kapat_volume = aa['volume']-aa['closed_volume'];

								if(aa['trend']=="LONG") {
									
									profit = ((aa['open']/aa['sl'])*api['lot'])-api['lot'];
									profit = profit*(kapat_volume/aa['volume']);
									
								} else if(aa['trend']=="SHORT") {
									
									profit = ((aa['open']/aa['sl'])*api['lot'])-api['lot'];
									profit = profit*(kapat_volume/aa['volume']);

								}			

								signal_str = api_exchange+" N-CLOSED "+aa['symbol']+" "+aa['trend']+" open:"+aa['open']+" close:"+close_price+" lot:"+kapat_volume+" profit:"+profit;
								await bildirim_ekle(user_id,signal_str,0);
								console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] "+signal_str+"\n");
								mysql_query("update user_signals set close='"+close_price+"',closed_volume=(closed_volume+"+kapat_volume+"),closetime='"+datetime()+"' where id ='"+aa['id']+"'");
														
							
							} else if(error_code == "-4130") {
								
								var open_orders = await api_open_orders(b_user,symbol);
								var cancel_stop={'orderId':0};
								for(var op1 in open_orders) {
									var op2 = open_orders[op1].info;
									if(op2['symbol'] == symbol && op2['type'] == "STOP_MARKET") {
										cancel_stop = await api_order_delete(b_user,symbol,op2['orderId']);
										console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] cancel_order("+op2['orderId']+")  symbol:"+op2['symbol']);
										//print_rr(cancel_stop);
									}
								}
								
								mysql_query("update user_signals set sticket='"+cancel_stop['orderId']+"' where id ='"+aa['id']+"'");		
								
							} else {
								
								sticket = -1;
								
								if(stristr(error_msg,"orders or positions are available")) {
									sticket=us_id;
								}
							
								mysql_query("update user_signals set sticket='"+sticket+"',sl_wait='"+time()+"',event='"+error_code+"|"+error_msg+"' where id ='"+aa['id']+"'");		
								console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] fix sl error code:"+error_code+"  err:"+error_msg+"\n");
							
							}
							
						}
					
						//echo ("fix_sl_order["+signal_id+"]\n");
						//print_rr(sl_ticket);
						
					}
				
				}
				
				if(aa['tticket']<1 && api['sltpemir']==1 && api['exchange']=="binance") {
					
					if(api['takeprofit']==0) {
						
						new_tp = signal['tp10'];
						if(new_tp==0)new_tp = signal['tp9'];
						if(new_tp==0)new_tp = signal['tp8'];
						if(new_tp==0)new_tp = signal['tp7'];
						if(new_tp==0)new_tp = signal['tp6'];
						if(new_tp==0)new_tp = signal['tp5'];
						if(new_tp==0)new_tp = signal['tp4'];
						if(new_tp==0)new_tp = signal['tp3'];
						if(new_tp==0)new_tp = signal['tp2'];
						if(new_tp==0)new_tp = signal['tp1'];
						
					} else if(api['takeprofit']==-1) {
						new_tp = (signal['tp1']);
					} else if(api['takeprofit']==-2) {
						new_tp = (signal['tp2']);
					} else if(api['takeprofit']==-3) {
						new_tp = (signal['tp3']);
					} else if(api['takeprofit']==-4) {
						new_tp = (signal['tp4']);
					} else if(api['takeprofit']==-5) {
						new_tp = (signal['tp5']);
					} else if(api['takeprofit']==-6) {
						new_tp = (signal['tp6']);
					} else if(api['takeprofit']==-7) {
						new_tp = (signal['tp7']);
					} else if(api['takeprofit']==-8) {
						new_tp = (signal['tp8']);
					} else if(api['takeprofit']==-9) {
						new_tp = (signal['tp9']);
					} else if(api['takeprofit']==-10) {
						new_tp = (signal['tp10']);
					} else if(api['takeprofit']>0) {
						new_tp = (sym['ask']*((100+api['takeprofit'])/100));
					}
					
					if(new_tp>0 && aa['tp_wait']+sl_tp_wait_seconds<time() && api['sltpemir']==1) {
						//send_json = {symbol:signal['symbol'],side:"SELL",type:"TAKE_PROFIT_MARKET","closePosition":"true","stopPrice":new_tp};	
						var tp_ticket = await api_create_order(b_user,signal['symbol'],"SELL","TP",0,new_tp);
						var tp_order_id=0;
						
						if(tp_ticket['orderId']>0) {
							
							mysql_query("update user_signals set tticket='"+tp_ticket['orderId']+"',tp_wait='"+time()+"' where id ='"+aa['id']+"'");		
							var tp_order_id=tp_ticket['orderId'];
							console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] fix broken tp #"+tp_ticket["orderId"]+" new_tp:"+new_tp+"\n");
							
						} else {
							

							var error_code = tp_ticket['code'];
							var error_msg = stripslashes(tp_ticket['msg']);
							var error_msg = str_replace("'","",error_msg);
							var error_msg = str_replace("\"","",error_msg);

							
							var p_risk = await api_position_risk(b_user);	
							var acik_poz = p_risk[signal['symbol']];
							
							if(acik_poz==0) {

								var close_price = aa['sl'];
								
								var kapat_volume = aa['volume']-aa['closed_volume'];

								if(aa['trend']=="LONG") {
									
									var profit = ((aa['open']/aa['sl'])*api['lot'])-api['lot'];
									var profit = profit*(kapat_volume/aa['volume']);
									
								} else if(aa['trend']=="SHORT") {
									
									var profit = ((aa['open']/aa['sl'])*api['lot'])-api['lot'];
									var profit = profit*(kapat_volume/aa['volume']);

								}			

								var signal_str = api_exchange+" N-CLOSED "+aa['symbol']+" "+aa['trend']+" open:"+aa['open']+" close:"+close_price+" lot:"+kapat_volume+" profit:"+profit;
								await bildirim_ekle(user_id,signal_str,0);
								console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] "+signal_str+"\n");
								mysql_query("update user_signals set close='"+close_price+"',closed_volume=(closed_volume+"+kapat_volume+"),closetime='"+datetime()+"' where id ='"+aa['id']+"'");
														
							
							} else if(error_code == "-4130") {
								
								var open_orders = await api_open_orders(b_user,symbol);
								var cancel_stop={'orderId':0};
								for(var op1 in open_orders) {
									var op2 = open_orders[op1].info;
									if(op2['symbol'] == symbol && op2['type'] == "TAKE_PROFIT_MARKET") {
										cancel_stop = await api_order_delete(b_user,symbol,op2['orderId']);
										console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] cancel_order("+op2['orderId']+") TAKE_PROFIT_MARKET symbol:"+op2['symbol']);
										
									}
								}
								
								mysql_query("update user_signals set tticket='"+cancel_stop['orderId']+"' where id ='"+aa['id']+"'");		
								
							} else {
															
								
								var tticket = -1;
								
								if(stristr(error_msg,"orders or positions are available")) {
									tticket=us_id;
								}
								
								mysql_query("update user_signals set tticket='"+tticket+"',tp_wait='"+time()+"',event='"+error_code+"|"+error_msg+"' where id ='"+aa['id']+"'");		
								console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] fix tp error code:"+error_code+"  err:"+error_msg+"\n");
								
							}
							
						}
						//echo ("fix_tp_order["+signal_id+"] ");
						//print_rr(tp_ticket);
		
					}
				
				}
				
				var a_sl_price=0;
				
				if(api['trailstop']<0) {
						
					for(var y=Math.abs(api['trailstop']);y<10;y++) {
						
						
						a_sl_price = 0;
						a_sl_id = y-Math.abs(api['trailstop']);
						if(a_sl_id==0) {
							new_sl=aa['open'];
						} else {
							new_sl=signal['tp'+a_sl_id];
						}
						
						if(signal['tp'+y]<sym['bid'] && signal['tp'+y]>0 && (aa['sl']<new_sl || aa['sl']==0)) {
							await trail_stop(b_user,sid,"TRAILSTOP "+(a_sl_id+1),signal['tp'+y],new_sl);
							aa['sl']=new_sl;
						}
					}
					
				} else if(api['trailstop']>0) {
					
					var tsl = (aa['open']*((100+api['trailstop'])/100));
					var tsp = (aa['open']*((100+api['trailstep'])/100));
					
					var tsl_fark = tsl-aa['open'];
					var tsp_fark = tsp-aa['open'];
					var min_val = Math.pow(10,sym['digits']*-1);
					if(tsl_fark<min_val) tsl_fark=min_val;
					if(tsp_fark<min_val) tsp_fark=min_val;
					
					var new_tsl_open = (aa['open'])+(tsl_fark)+(tsp_fark);
					var new_tsl_sl = (aa['sl'])+(tsl_fark)+(tsp_fark);
					var new_tsl = (sym['bid'])-(tsl_fark);
					
					var new_tsl_open = (new_tsl_open);
					var new_tsl_sl = (new_tsl_sl);
					var new_tsl = (new_tsl);
					
					if( (aa['sl'] == 0 || aa['sl']<aa['open']) && new_tsl_open<=sym['bid'] ) {
						await trail_stop(b_user,sid,"NEW TSL",new_tsl_open,new_tsl);
					} else if (aa['sl']>aa['open'] && new_tsl_sl<=sym['bid']) {
						await trail_stop(b_user,sid,"NEW TSL 2",new_tsl_sl,new_tsl);
					}
					
				} 
				
				if(api['maliyetinecek']>0) {
					
					for(i=1;i<10;i++) {
						if (sym['bid']>=signal['tp'+i] && signal['tp'+i]>0 && api['maliyetinecek']==i && (aa['sl']<aa['open'] || aa['sl']==0)) {
							await trail_stop(b_user,sid,"MALIYETINE CEK "+i,signal['tp'+i],aa['open']);
						}	
					}
				}
				
				for(var i=0;i<=10;i++) {
					
					if(i==0) {
					
						if (aa['sl']>0 && api['stoploss'] != -1 && sym['bid']<=aa['sl']) {
							await close_order(b_user,sid,aa['sl'],"SL",100);
							//clearInterval(user_timer);
							break;			
						}
						
					} else {
						
						
						if (sym['bid']<signal['tp'+i]) break;
						
						console.log(symbol," i:",i," tp:",aa['tp']," sigtp:",signal['tp'+i]);
						
						if (sym['bid']>=signal['tp'+i] && (aa['tp']==0 || aa['tp']<signal['tp'+i]) && signal['tp'+i]>0 && api['tp'+i]>0) {
							
							
							await close_order(b_user,sid,signal['tp'+i],"TP "+i,api['tp'+i]);
							//clearInterval(user_timer);
							
						}				
							
					}	
						
				}
				

			}
			
		

		} else if ( signal['trend'] == "SHORT" ) {
			
			if(aa['close']>0 && aa['volume']<=aa['closed_volume']) {
				console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"]  "+signal['symbol']+" "+signal['trend']+" -> sinyal kapandığı için durduruldu close:"+aa['close']+" \n");
				//clearInterval(user_timer);
				return;
			} else if (aa['open'] == 0 && strtotime(signal['opendate'])>0 && strtotime(signal['opendate'])+signal_cancel_seconds>time() /* && aralikta(signal.entry1,signal.entry2,sym['bid'])*/ ) {
				await create_order(b_user,sid);
			} else if (aa['open']>0 && aa['close']==0) {	
				
				

				var new_sl = 0;
				var new_tp = 0;
				
				if(aa['sticket']<1 && aa['sl_wait']+sl_tp_wait_seconds<time() && api['stoploss'] != -1) {
					
					if(aa['sl']>0) {
						new_sl = (aa['sl']);
					} else if(api['stoploss']==0) {
						new_sl = (signal['sl']);
					} else if(api['stoploss']>0) {
						new_sl = (sym['bid']*((100+api['stoploss'])/100));
					}
					
					if(new_sl>0) {
						sl_ticket = await api_create_order(b_user,signal['symbol'],"BUY","SL",0,new_sl);
						if(sl_ticket['orderId']>0) {
							await mysql_query("update user_signals set sl='"+new_sl+"',sl_wait='"+time()+"',sticket='"+sl_ticket['orderId']+"' where id ='"+aa['id']+"'");		
							aa['sl'] = (new_sl);
							console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] fix broken sl #"+sl_ticket["orderId"]+" new_sl:"+new_sl+"\n");
						} else {
							

							var error_code = sl_ticket['code'];
							var error_msg = stripslashes(sl_ticket['msg']);
							var error_msg = str_replace("'","",error_msg);
							var error_msg = str_replace("\"","",error_msg);
							

							
							var p_risk = await api_position_risk(b_user);	
							var acik_poz = p_risk[signal['symbol']];
							
							if(acik_poz==0) {

								var close_price = aa['sl'];
								
								var kapat_volume = aa['volume']-aa['closed_volume'];

								if(aa['trend']=="LONG") {
									
									var profit = ((aa['open']/aa['sl'])*api['lot'])-api['lot'];
									profit = profit*(kapat_volume/aa['volume']);
									
								} else if(aa['trend']=="SHORT") {
									
									var profit = ((aa['open']/aa['sl'])*api['lot'])-api['lot'];
									profit = profit*(kapat_volume/aa['volume']);

								}			

								var signal_str = api_exchange+" N-CLOSED "+aa['symbol']+" "+aa['trend']+" open:"+aa['open']+" close:"+close_price+" lot:"+kapat_volume+" profit:"+profit;
								await bildirim_ekle(user_id,signal_str,0);
								console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] "+signal_str+"\n");
								await mysql_query("update user_signals set close='"+close_price+"',closed_volume=(closed_volume+"+kapat_volume+"),closetime='"+datetime()+"' where id ='"+aa['id']+"'");
														
							
							} else if(error_code == "-4130") {
								
								var open_orders = await api_open_orders(b_user,symbol);
								var cancel_stop={'orderId':0};
								for(var op1 in open_orders) {
									var op2 = open_orders[op1].info;
									if(op2['symbol'] == symbol && op2['type'] == "STOP_MARKET") {
										var cancel_stop = await api_order_delete(b_user,symbol,op2['orderId']);
										console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] cancel_order("+op2['orderId']+")  symbol:"+op2['symbol']);
										
									}
								}
								
								await mysql_query("update user_signals set sticket='"+cancel_stop['orderId']+"' where id ='"+aa['id']+"'");		
								
							} else {
								
								
								var sticket = -1;
								
								if(stristr(error_msg,"orders or positions are available")) {
									sticket=us_id;
								}
								
								await mysql_query("update user_signals set sticket='"+sticket+"',sl_wait='"+time()+"',event='"+error_code+"|"+error_msg+"' where id ='"+aa['id']+"'");		
								// echo "fix sl error code:error_code  err:error_msg \n";
								console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] fix sl error code:"+error_code+"  err:"+error_msg+"\n");
							
							}
							
							
						}
						
					}
				
				}
			
				if(aa['tticket']<1 && api['sltpemir']==1) {
					
					if(api['takeprofit']==0) {
						
						
						var new_tp = signal['tp10'];
						if(new_tp==0)new_tp = signal['tp9'];
						if(new_tp==0)new_tp = signal['tp8'];
						if(new_tp==0)new_tp = signal['tp7'];
						if(new_tp==0)new_tp = signal['tp6'];
						if(new_tp==0)new_tp = signal['tp5'];
						if(new_tp==0)new_tp = signal['tp4'];
						if(new_tp==0)new_tp = signal['tp3'];
						if(new_tp==0)new_tp = signal['tp2'];
						if(new_tp==0)new_tp = signal['tp1'];
						
						
					} else if(api['takeprofit']==-1) {
						var new_tp = (signal['tp1']);
					} else if(api['takeprofit']==-2) {
						var new_tp = (signal['tp2']);
					} else if(api['takeprofit']==-3) {
						var new_tp = (signal['tp3']);
					} else if(api['takeprofit']==-4) {
						var new_tp = (signal['tp4']);
					} else if(api['takeprofit']==-5) {
						var new_tp = (signal['tp5']);
					} else if(api['takeprofit']==-5) {
						var new_tp = (signal['tp5']);
					} else if(api['takeprofit']==-6) {
						var new_tp = (signal['tp6']);
					} else if(api['takeprofit']==-7) {
						var new_tp = (signal['tp7']);
					} else if(api['takeprofit']==-8) {
						var new_tp = (signal['tp8']);
					} else if(api['takeprofit']==-9) {
						var new_tp = (signal['tp9']);
					} else if(api['takeprofit']==-10) {
						var new_tp = (signal['tp1']);
						
					} else if(api['takeprofit']>0) {
						var new_tp = (sym['bid']*((100-api['takeprofit'])/100));
					}
					
					if(new_tp>0 && aa['tp_wait']+sl_tp_wait_seconds<time()) {
						var tp_ticket = await api_create_order(b_user,signal['symbol'],"BUY","TP",0,new_tp);
						if(tp_ticket['orderId']>0) {
							await mysql_query("update user_signals set tticket='"+tp_ticket['orderId']+"',tp_wait='"+time()+"' where id ='"+aa['id']+"'");		
							console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] fix broken tp #"+tp_ticket["orderId"]+" new_tp:"+new_tp+"\n");
							
						} else {
							


							var error_code = tp_ticket['code'];
							var error_msg = stripslashes(sl_ticket['msg']); 
							var error_msg = str_replace("'","",error_msg);
							var error_msg = str_replace("\"","",error_msg);
							
							
							
							var p_risk = await api_position_risk(b_user);	
							var acik_poz = p_risk[signal['symbol']];
							
							if(acik_poz==0) {

								var close_price = aa['sl'];
								
								var kapat_volume = aa['volume']-aa['closed_volume'];

								if(aa['trend']=="LONG") {
									
									var profit = ((aa['open']/aa['sl'])*api['lot'])-api['lot'];
									var profit = profit*(kapat_volume/aa['volume']);
									
								} else if(aa['trend']=="SHORT") {
									
									var profit = ((aa['open']/aa['sl'])*api['lot'])-api['lot'];
									var profit = profit*(kapat_volume/aa['volume']);

								}			

								var signal_str = api_exchange+" N-CLOSED "+aa['symbol']+" "+aa['trend']+" open:"+aa['open']+" close:"+close_price+" lot:"+kapat_volume+" profit:"+profit;
								await bildirim_ekle(user_id,signal_str,0);
								console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] signal_str\n");
								await mysql_query("update user_signals set close='"+close_price+"',closed_volume=(closed_volume+"+kapat_volume+"),closetime='"+datetime()+"' where id ='"+aa['id']+"'");
														
							
							} else if(error_code == "-4130") {
								
								var open_orders = await api_open_orders(b_user,symbol);
								var cancel_stop={'orderId':0};
								for(var op1 in open_orders) {
									var op2 = open_orders[op1].info;
									if(op2['symbol'] == symbol && op2['type'] == "TAKE_PROFIT_MARKET") {
										cancel_stop = await api_order_delete(b_user,symbol,op2['orderId']);
										console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] cancel_order("+op2['orderId']+") TAKE_PROFIT_MARKET symbol:"+op2['symbol']);
							}
								}
								
								await mysql_query("update user_signals set tticket='"+cancel_stop['orderId']+"' where id ='"+aa['id']+"'");		
								
							} else {
										
								var tticket = -1;
								
								if(stristr(error_msg,"orders or positions are available")) {
									tticket=us_id;
								}
								
								await mysql_query("update user_signals set tticket='"+tticket+"',tp_wait='"+time()+"',event='"+error_code+"|"+error_msg+"' where id ='"+aa['id']+"'");		
								console.log(datetime()+" - [s:"+s_id+"|u:"+user_id+"|us:"+us_id+"] fix tp error code:"+error_code+"  err:"+error_msg+"\n");
															
							}
							
						}
						
					}
				
				}
				
				if(api['trailstop']<0) {
		
					for(var y=Math.abs(api['trailstop']);y<10;y++) {
						
						var a_sl_price = 0;
						var a_sl_id = y-Math.abs(api['trailstop']);
						if(a_sl_id==0) {
							var new_sl=aa['open'];
						} else {
							var new_sl=signal['tp'+a_sl_id];
						}
						
						if(signal['tp'+y]>sym['ask'] && signal['tp'+y]>0 && (aa['sl']>new_sl || aa['sl']==0)) {
							await trail_stop(b_user,sid,"TRAILSTOP "+(a_sl_id+1),signal['tp'+y],new_sl);
							aa['sl']=new_sl;
						}
						
					}
										
				} else if(api['trailstop']>0) {
					
					var tsl = (aa['open']*((100-api['trailstop'])/100));
					var tsp = (aa['open']*((100-api['trailstep'])/100));
					
					var tsl_fark = ((aa['open']-tsl));
					var tsp_fark = ((aa['open']-tsp));
					var min_val = Math.pow(10,sym['digits']*-1);
					if(tsl_fark<min_val) tsl_fark=min_val;
					if(tsp_fark<min_val) tsp_fark=min_val;
					
					var new_tsl_open = (aa['open'])-(tsl_fark)-(tsp_fark);
					var new_tsl_sl = (aa['sl'])-(tsl_fark)-(tsp_fark);
					var new_tsl = (sym['ask'])+(tsl_fark);
					
					if( (aa['sl'] == 0 || aa['sl']>aa['open']) && new_tsl_open>=sym['ask'] ) {
						await trail_stop(b_user,sid,"NEW TSL",new_tsl_open,new_tsl);
					} else if (aa['sl']<aa['open'] && new_tsl_sl>=sym['ask']) {
						await trail_stop(b_user,sid,"NEW TSL 2",new_tsl_sl,new_tsl);
					}
					
				} 
					
				if(api['maliyetinecek']>0) {
					
					for(var i=1;i<10;i++) {
						if (sym['ask']<=signal['tp'+i] && signal['tp'+i]>0 && api['maliyetinecek']==i && (aa['sl']>aa['open'] || aa['sl']==0)) {
							await trail_stop(b_user,sid,"MALIYETINE CEK "+i,signal['tp'+i],aa['open']);
						}	
					}
				}
				
				for(var i=0;i<=10;i++) {
					
					if(i==0) {
					
						if (aa['sl']>0 && api['stoploss'] != -1 && api['sltpemir']==1 && sym['ask']>=aa['sl']) {
							await close_order(b_user,sid,aa['sl'],"SL",100);
							//clearInterval(user_timer);
							break;			
						}
						
					} else {
						
						if (sym['ask']<=signal['tp'+i] && (aa['tp']==0 || aa['tp']>signal['tp'+i]) && signal['tp'+i]>0 && api['tp'+i]>0) {
							await close_order(b_user,sid,signal['tp'+i],"TP "+i,api['tp'+i]);
							//clearInterval(user_timer);
							break;
						}				
							
					}	
						
				}
				



			}
			
		}		
	
	
	} catch(u_err) {
		 
		console.log("run_user_error :",u_err);
		
		//clearInterval(user_timer);
		return;
		
	}
	

	
	setTimeout(function() { run_user_f(b_user,sid,s_id,user_id,us_id,symbol,signal_id);  },1000);
	
	
	
}


async function run_user_signals(sid,rmd=0) {
	
	console.log(datetime()+" - [s:"+sid+"] run_user_signals();\n");
	
	
	var e_signal = await mysql_query("select * from signals where id = '"+sid+"'");
	var es = e_signal[0];
	
	
	var last_id = es['id'];
	var c_symbol = es['symbol'];
	var c_tarih = es['tarih'];
	var c_trend = es['trend'];
	var c_entry1 = es['entry1'];
	var c_entry2 = es['entry2'];
	var c_sl = es['sl'];
	var c_tp1 = es['tp1'];
	
	
	if(last_id>0) {
		
		var e_user = await mysql_query("select id,user_id,username,abonelik,api_yok_bildirim,abone_degil_bildirim,api_grup_bildirim from users where 1");
		
		for(var e=0;e<e_user.length;e++) {
			
			var eu = e_user[e];
			
			var abonelik=0;
			
			// print_rr($eu);
			
			if(eu['abonelik']==0) {
				abonelik=0;
			} else {
				abonelik=eu['abonelik'];
			}
			
			var apv= await mysql_query("select id from apikeys where user_id='"+eu['user_id']+"'");
			var api_varmi = apv.length;
			
			var agv=await mysql_query("select id from apigruplari where user_id='"+eu['user_id']+"'");
			var api_grup_varmi = agv.length;
			
			var suan = time();
			
			if (api_varmi==0) {
				if (eu['api_yok_bildirim']<suan) {
					await mysql_query("update users set api_yok_bildirim='"+suan+"' where id = '"+eu["id"]+"'");
				}
			} else if (abonelik==0) {
				if (eu['abone_degil_bildirim']<suan) {
					await mysql_query("update users set abone_degil_bildirim='"+suan+"' where id = '"+eu['id']+"'");
				}
			}
			
			
		}
		
		var e_user2 = await mysql_query("select id,lot,leverage,user_id,name,durum,maxemir from apikeys where exchange='binance';");
		
		for (var e2=0;e2<e_user2.length;e2++) {
			
			var eu2 = e_user2[e2];

			var uye1 = await mysql_query("select * from users where user_id = '"+eu2['user_id']+"'");
			var uye1u=uye1[0];
			var uye1s=uye1.length;
			
			if(uye1s==0) {
				continue;
			}
			
			var uye = uye1u;
			
			
			var abonelik=0;

			if(uye['abonelik']==0) {
				abonelik=0;
			}else{
				abonelik=uye['abonelik'];
			}
			
			var suser_id=eu2['user_id'];
			var uye_sinyali_var=false;
			var suan = time();
			

			//console.log("select * from user_signals where user_id = '"+apiler.user_id+"' and open>0 and close = 0")
			var kac_acik1 = await mysql_query("select * from user_signals where user_id = '"+eu2['user_id']+"' and open>0 and close = 0");
			var kac_acik = kac_acik1.length;
			
			//console.log("select * from user_signals where user_id = '"+apiler.user_id+"' and symbol = '"+apiler.id+"' and trend = '"+c_trend+"' and close = 0")
			var sgnv1 = await mysql_query("select * from user_signals where user_id = '"+eu2['user_id']+"' and symbol = '"+c_symbol+"' and trend = '"+c_trend+"' and close = 0");
			var sgnv = sgnv1[0];
			
			
			if (sgnv1.length>0 && sgnv['id']>0) {
				var sgn2a = await mysql_query("select symbol,trend,entry1,entry2,sl,tp1 from signals where id = '"+(sgnv['signal_id'])+"'");
				var sgn2 = sgn2[0];
				
				if(sgn2['id']>0) {
					var sgn3 = sgn2;
					
					if(sgn2['symbol'] == c_symbol && sgn2['trend'] == c_trend && sgn2['entry1'] == c_entry1 && sgn2['entry2'] == c_entry2 && sgn2['sl'] == c_sl && sgn2['tp1'] == c_tp1) {
						uye_sinyali_var=true;
					}
				}
				  
			}			
				
			/*
			echo ($uye1u['user_id']." ".$uye1u['username']." abonelik:".$abonelik.">suan:".$suan." && apiler.durum:".$eu2['durum']."==1 && uye_sinyali_var:".$uye_sinyali_var."==false\n");
			*/
			
			if (abonelik>suan && eu2['durum']==1 && uye_sinyali_var==false) {
					
				var s_user_id = eu2['user_id'];
				var s_api_id = eu2['id'];
				var s_signalid = sid;
				if (sgnv1.length>0) {
				var u_signal_id = sgnv['id'];
				} else {
					var u_signal_id = 0;
				}
				var s_lot = eu2['lot'];
				var s_leverage = eu2['leverage'];
				var s_strateji = "";
				
				

				var sgv=await mysql_query("select id from user_signals where user_id='"+s_user_id+"' and signal_id='"+s_signalid+"'");
				var signal_varmi = sgv[0];
				
				if(sgv.length==0) {
					
					var query = "INSERT INTO `user_signals` (`id`, `user_id`, `api_id`, `signal_id`, `lotsize`, `levelage`, `strateji`, `ticket`, `symbol`, `trend`, `open`, `opentime`, `volume`, `sl`, `close`, `closetime`, `profit`, `event`, `status`) VALUES ('', '"+(s_user_id)+"', '"+(s_api_id)+"', '"+(last_id)+"', '"+(s_lot)+"', '"+(s_leverage)+"','"+(s_strateji)+"', '', '"+(c_symbol)+"', '"+(c_trend)+"', '', '', '', '', '', '', '', '', '');";

					var sonucu = await mysql_query(query);
					var iid = sonucu.insertId;

					var unew_msg = "[s:"+s_signalid+"] u:"+s_user_id+"|us:"+iid+" START "+c_symbol+" "+c_trend+" "+c_tarih+" entry1:"+c_entry1+" sl:"+c_sl+" tp:"+c_tp1+" api:"+eu2['name'];      
					console.log(datetime()+" - "+unew_msg+"\n");				
					
				} else {
					
					var iid = signal_varmi['id'];
					
					var unew_msg = "[s:"+s_signalid+"] u:"+s_user_id+"|us:"+iid+" RUN "+c_symbol+" "+c_trend+" "+c_tarih+" entry1:"+c_entry1+" sl:"+c_sl+" tp:"+c_tp1+" api:"+eu2['name'];      
					console.log(datetime()+" - "+unew_msg+"\n");						
					
				}
				
				run_user(iid);
				await wait(300);
			
			}
		
		}
		
	} else {
		
		console.log("#"+sid+" nolu sinyal yok\n");
		
	}
	
}


async function run_signal(sid) {
	
		

	var rsi = await mysql_query("SELECT * FROM `signals` WHERE id='"+sid+"'");
	
	var new_upd=0;
	var signal=rsi[0];

	var symbol=signal.symbol;
	// binance_pending.push(symbol)

	var tgh = await mysql_query("SELECT * FROM sinyalgrup where id = '1';");
	
	var tgh1=tgh[0]
	var telegram_id = tgh1.telegram_id
	
	var signal_finished=0;
	var signal_runned=0;
	var sig_interval;

	sig_interval= setInterval(async function() {
		
		try {
				
			var sym = binance_symbols[symbol]
			var ask = sym.ask;
			var bid = sym.bid;
			
			if(bid>0 && ask>0) {
				
			} else {
				return;
			}
			
			var sdate = format_date(new Date().getTime()).toString()

			var rsi = await mysql_query("SELECT * FROM `signals` WHERE id='"+sid+"'");
			var signal=rsi[0]
			
			
			// console.log(sdate," #",sid," ",symbol," bid:",bid," ask:",ask," sl:",signal.sl," e1:",signal.entry1," e2:",signal.entry2," tp1:",signal['tp1']," tp2:",signal['tp2']," tp3:",signal.tp3," tp4:",signal.tp4," tp5:",signal.tp5);
			
			if(signal['close']>0) {
				
				console.log("Sinyal #"+sid+" başarı ile tamamlandı\n");
				clearInterval(sig_interval);
				return;
			}

			if(signal.trend == "LONG") {
				
				if(signal.open==0) {
					
					if(signal.entry1<=ask && signal.entry2>=ask) {
						
						var signal_str = "#"+signal.symbol+" "+signal.trend+" sinyal takibe alındı. ✅\nEntry1 : "+signal.entry1+"\nEntry2: "+signal.entry2+"  Ask:"+sym.ask;
						await ch_bildirim_ekle(telegram_id,signal.signalid,signal.symbol,signal.trend,sym.ask,sdate,signal.sl,0,0,"OPEN",0,signal_str);
						await mysql_query("update signals set open='"+ask+"', opendate='"+sdate+"' where id ='"+sid+"'");
						run_user_signals(sid);
						signal_runned=1;
					}
					
				} else {
					
					for(var t=0;t<10;t++) {
						
						if(t==0) {

							if(signal.stoploss == 0 && signal.sl>=bid) {
								var profit = ((((bid/signal.open)*100)-100)*20);
								profit = profit.toFixed(3)
								var signal_str = "#"+signal.symbol+" "+signal.trend+" ";
								// bildirim_ekle(telegram_id,signal_str,-1*ss.signalid);
								await ch_bildirim_ekle(telegram_id,signal.signalid,signal.symbol,signal.trend,signal.open,signal.opendate,signal.sl,bid,sdate,"SL",profit,signal_str);
								await mysql_query("update signals set stoploss='"+bid+"',last_sl=1,profit='"+profit+"', close='"+bid+"', closedate='"+sdate+"' where id ='"+sid+"'");
								new_upd=1;				
							
							}
						
						} else {
							
							if((signal.takeprofit == 0 || signal.takeprofit<signal['tp'+t]) && signal['tp'+t]>0 && signal['last_tp']<t && signal['tp'+t]<=bid) {
								
								var profit = ((((bid/signal.open)*100)-100)*20);
								profit = profit.toFixed(3)
								// var signal_str = ss.symbol+" "+ss.trend+" sinyali TP1 e ulaştı. Open:"+ss.open+" TP1:"+ss.tp1+" Bid:"+sym.bid+" profit: %"+profit;
								var signal_str = "#"+signal.symbol+" "+signal.trend+" Take-Profit "+t+" ✅\nProfit: %"+profit+" ";
								//bildirim_ekle(telegram_id,signal_str,-1*ss.signalid);
								if(signal['tp'+(t+1)]>0) {
									await ch_bildirim_ekle(telegram_id,signal.signalid,signal.symbol,signal.trend,signal.open,signal.opendate,signal.sl,bid,sdate,"TP"+t,profit,signal_str);
									await mysql_query("update signals set last_tp='"+t+"',takeprofit='"+signal['tp'+t]+"',profit='"+profit+"' where id ='"+signal.id+"'");
								} else {
									await ch_bildirim_ekle(telegram_id,signal.signalid,signal.symbol,signal.trend,signal.open,signal.opendate,signal.sl,bid,sdate,"TP"+t,profit,signal_str);
									await mysql_query("update signals set last_tp='"+t+"',takeprofit='"+signal['tp'+t]+"',close='"+bid+"',closedate='"+sdate+"',profit='"+profit+"' where id ='"+signal.id+"'");
									signal_finished=1;
								}
								
								new_upd=1;	
								if(signal_finished==1) clearInterval(sig_interval);								
								// return;
							}
							
						}
						
					}

					if(signal_runned==0 && signal.open>0 && signal.close==0) {
						// run_user_signals(sid);
						signal_runned=1;
						console.log("buy signal.runned")
					}
										
						
				}
				
			} else if (signal.trend == "SHORT") {
				

				if(signal.open==0) {
					
					if(signal.entry1<=bid && signal.entry2>=bid) {
						
						var signal_str = "#"+signal.symbol+" "+signal.trend+" sinyal takibe alındı. ✅\nEntry1 : "+signal.entry1+"\nEntry2: "+signal.entry2+"  Bid:"+sym.bid;
						await ch_bildirim_ekle(telegram_id,signal.signalid,signal.symbol,signal.trend,sym.ask,sdate,signal.sl,0,0,"OPEN",0,signal_str);
						await mysql_query("update signals set open='"+ask+"', opendate='"+sdate+"' where id ='"+sid+"'");
						run_user_signals(sid);
						signal_runned=1;
					}
					
				} else {
					
					for(var t=0;t<=10;t++) {
						
						if(t==0) {

							if(signal.stoploss == 0 && signal.sl<=ask) {
								var profit = ((((signal.open/ask)*100)-100)*20);
								profit = profit.toFixed(3)
								var signal_str = "#"+signal.symbol+" "+signal.trend+" ";
								// bildirim_ekle(telegram_id,signal_str,-1*ss.signalid);
								await ch_bildirim_ekle(telegram_id,signal.signalid,signal.symbol,signal.trend,signal.open,signal.opendate,signal.sl,bid,sdate,"SL",profit,signal_str);
								await mysql_query("update signals set stoploss='"+bid+"',last_sl=1,profit='"+profit+"', close='"+bid+"', closedate='"+sdate+"' where id ='"+sid+"'");
								new_upd=1;				
							
							}
						
						} else {
							
							if((signal.takeprofit == 0 || signal.takeprofit>signal['tp'+t]) && signal['tp'+t]>0 && signal['last_tp']<t && signal['tp'+t]>=ask) {
								
								var profit = ((((signal['open']/ask)*100)-100)*20)
								profit = profit.toFixed(3)
								signal_str = "#"+signal.symbol+" "+signal.trend+" Take-Profit "+t+" ✅\nProfit: %"+profit+" ";

								if(signal['tp'+(t+1)]>0) {
									await ch_bildirim_ekle(telegram_id,signal.signalid,signal.symbol,signal.trend,signal.open,signal.opendate,signal.sl,bid,sdate,"TP"+t,profit,signal_str);
									await mysql_query("update signals set last_tp="+t+",takeprofit='"+signal['tp'+t]+"',profit='"+profit+"' where id ='"+signal.id+"'");
								} else {
									await ch_bildirim_ekle(telegram_id,signal.signalid,signal.symbol,signal.trend,signal.open,signal.opendate,signal.sl,bid,sdate,"TP"+t,profit,signal_str);
									await mysql_query("update signals set last_tp="+t+",takeprofit='"+signal['tp'+t]+"',close='"+ask+"',closedate='"+sdate+"',profit='"+profit+"' where id ='"+signal.id+"'");
									signal_finished=1;
								}
								
								new_upd=1;	
								if(signal_finished==1) clearInterval(sig_interval);
								// return;
							}
							
						}
						
					}
					

					if(signal_runned==0 && signal.open>0 && signal.close==0) {
						run_user_signals(sid);
						signal_runned=1;
						console.log("sell signal.runned")
					}
										
						
				}
							
				
				
				
				
			}

			//echo "signal detail:"+implode("\t",signal));
			
			await mysql_query("update signals set tickdate='"+sym.ticktime+"',bid='"+sym.bid+"',ask='"+sym.ask+"' where id = '"+sid+"';");
			
			
			
		} catch(err) {
			
			console.log("run_signal error:",err);
			
		}
		
	},500);
		
	
	
	
}

		

async function main() {
	
	
	await mysql_query("truncate table signals");
	await mysql_query("truncate table user_signals");
	await mysql_query("truncate table bildirimler");
	await mysql_query("truncate table bildirimler_ch");
	

	await mysql_query("DROP TABLE IF EXISTS `symboldata`;");
	await mysql_query("CREATE TABLE `symboldata` (	  `id` int(11) NOT NULL,	  `symbol` varchar(100) NOT NULL,	  `base` varchar(100) NOT NULL,	  `quote` varchar(100) NOT NULL,	  `digits` int(11) NOT NULL,	  `vdigits` int(11) NOT NULL,	  `ws` int(1) NOT NULL,	  `ticktime` bigint(20) NOT NULL,	  `bid` double NOT NULL,	  `ask` double NOT NULL	) ENGINE=MEMORY DEFAULT CHARSET=utf8;");
	await mysql_query("ALTER TABLE `symboldata` ADD PRIMARY KEY (`id`);");
	await mysql_query("ALTER TABLE `symboldata` ADD INDEX(`symbol`);");
	await mysql_query("ALTER TABLE `symboldata` ADD INDEX(`ws`);");
	await mysql_query("ALTER TABLE `symboldata` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;");
	
	
	
	try {
	
	let binanced = new ccxt.binanceusdm ();
	
	var binance_markets = await binanced.loadMarkets ()
	
	
	for (const key in binance_markets) {
		
		var vals = binance_markets[key]
		var v_symbol = vals.symbol;
		
		for(var a1 in vals.info.filters) {
			var a2 = vals.info.filters[a1];
			if(a2['filterType']=="MARKET_LOT_SIZE") {
				max_lots[v_symbol] = parseFloat(a2['maxQty']);
			}
			
			
		}
		
		
		if (vals.symbol.indexOf("_")>-1) continue;
		
		
		var lsa = { 'symbol': vals.symbol, 'base' : vals.base, 'quote' : vals.quote, 'min_lot': vals.limits.amount.min, 'vdigits': vals.precision.amount, 'digits': vals.precision.price, 'prev_bid':0,'prev_ask':0, 'bid':0,'ask':0,'date':0,'run':0 };
		
		
		var nsymbol = vals.base + vals.quote;
		
		binance_symbols[nsymbol] = lsa
		
	}	
	
	} catch(err) {
		console.log("binance connect error:",err);
	}
	
	

	
	var apiler = await mysql_query("select * from apikeys where 1");
	
	for(var aps in apiler) {
		
		var api = apiler[aps];
		console.log("api:",api);
			
		var b_api_conn = new ccxt.binanceusdm ({
			'enableRateLimit': true,
			'apiKey': api['api_key'],
			'secret': api['api_secret'],
		});
		
		
		var pozlar = await api_position_risk(b_api_conn);
		console.log("acik_pozlar");
		for(var aw1 in pozlar) {
			
			var psr = pozlar[aw1];
			if(psr != 0.0) {
				console.log("acik_poz : ",aw1," - ",psr);
				
				var c_side="SELL";
				var c_amount=0;
				
				if(psr>0) {
					c_side="SELL";
					c_amount=parseFloat(psr);
				} else {
					c_side="BUY";
					c_amount=parseFloat(psr)*-1;
					
				}
				
				var emir_ac = await api_create_order(b_api_conn,aw1,c_side,"MARKET",c_amount,0,1);
				console.log("emir_ac:",emir_ac);
				
			}
			
		}
		
	}
		
	
	
	while (true) {

		

		var api_signals = await mysql_query("SELECT * FROM signals where close=0;");
		
		// console.log("api_signals:",api_signals);
		
		for (var i=0;i<api_signals.length;i++) {
			
			try {
				
				var api_signal = api_signals[i];
				
				
				if (api_signal.symbol.indexOf("1000")>-1) continue;
					 
				var sid = api_signal.id;
			
				
				if (start_ed[sid] != true) {

					//await mysql_query("update signals set close = tp3,closedate=from_unixtime(tickdate/1000) where id = '"+sid' and tp4=0 and tp5=0 and takeprofit=tp3;");
					//await mysql_query("update signals set close = tp4,closedate=from_unixtime(tickdate/1000) where id = '"+sid' and tp5=0 and takeprofit=tp4;");
					binance_pending.push(api_signal.symbol)
					run_signal(sid);
					start_ed[sid]=true;
				}  
			} catch(err) {
				console.log("signal while error:",err.message);
			}				
			

		}

		await wait(300);

	}
	
	
	
}

main();