"use strict";
const ccxt = require("ccxt");
const wss = require("ws");
const fs = require("fs");

const mysql = require("mysql");
const request = require("request");
var url = require("url");
const crypto = require("crypto");
//const querystring = require('querystring');
const querystring = require("qs");
var util = require("util");
const sync_request = require("sync-request");

var conf_data = "";

const islem_ac = 1;
const bildirim_gonder = 1;
const kanal_bildirim_gonder = 1;
var last_ping = 0;
var fake_signal_t = 0;

try {
  conf_data = fs.readFileSync("config.py", "utf8");
} catch (err) {
  console.error(err);
}

const my_host = conf_data.split('mysql_host = "')[1].split('"')[0];
const my_user = conf_data.split('mysql_user = "')[1].split('"')[0];
const my_pass = "root";
// const my_pass = conf_data.split('mysql_pass = "')[1].split('"')[0];
const my_name = conf_data.split('mysql_name = "')[1].split('"')[0];

console.log("my_host", my_host);
console.log("my_user", my_user);
console.log("my_pass", my_pass);
console.log("my_name", my_name);

let db = mysql.createConnection({
  host: my_host,
  port: 8889,
  user: my_user,
  password: my_pass,
  database: my_name,
});

let today_date = new Date();
today_date = today_date.toISOString().split("T")[0];

var logFile = fs.createWriteStream("trade_bot_log" + today_date + ".txt", {
  flags: "a",
});
// Or 'w' to truncate the file every time the process starts.
var logStdout = process.stdout;

console.log = function () {
  logFile.write(util.format.apply(null, arguments) + "\n");
  logStdout.write(util.format.apply(null, arguments) + "\n");
};
console.error = console.log;

db.connect(function (err) {
  if (err) return console.log("err:", err);

  console.log("MySQL bağlantısı başarıyla gerçekleştirildi.");
});

var start_ed = {};
var binance_symbols = {};
var binance_ws_symbols = [];
var binance_pending = [];
var binance_unpending = [];
var bn_wsp;
var binance_ready = 0;
var time_shift = 3 * 60 * 60 * 1000;

async function symbol_ws_reconnect(borsa) {
  try {
    while (true) {
      if (binance_ws.readyState == 1) {
        break;
      } else {
        await wait(100);
      }
    }

    var sdata = binance_ws_symbols;

    for (var i = 0; i < sdata.length; i++) {
      var symbol = sdata[i];
      symbol = symbol.toLowerCase();

      if (borsa == "binance") {
        if (binance_pending.indexOf(symbol) == -1) {
          binance_pending.push(symbol);
        }
      } else if (borsa == "mexc") {
        var sm = brd[borsa]["symbol"][symbol];
        console.log("sm:", sm);
        var sym_name = sm.base + "_" + sm.quote;
        var wes = { method: "sub.ticker", param: { symbol: sym_name } };
        console.log("mexc socket start -> ", wes);
        mexc_ws.send(JSON.stringify(wes));
      }
    }
  } catch (err) {
    console.log("symbol_ws_reconnect_err :", err);
  }
}

function binance_websocket(reconnect = 0) {
  try {
    var bws = new wss("wss://fstream.binance.com/ws");
    bws.on("open", function open() {
      console.log("binance websocket started");
      if (reconnect == 1) symbol_ws_reconnect("binance");
      //   bws.send(Date.now());
    });
    let deneme = {
      method: "SUBSCRIBE",
      params: ["btcusdt@aggTrade", "btcusdt@depth"],
      id: 1,
    };
    bws.on("message", function message(dat) {
      var data = JSON.parse(dat);
      console.log("Websocket Message ::: ", data);
      if (data.s != undefined) {
        var symbol = data.s;

        binance_symbols[symbol].bid = data.b;
        binance_symbols[symbol].ask = data.a;
        binance_symbols[symbol].date = data.E;
      }
    });

    bws.on("close", function close() {
      console.log("binance websocket disconnected");
      binance_ws = binance_websocket(1);
    });
  } catch (err) {
    console.log("binance websocket error:", err);
  }

  return bws;
}

var binance_ws = binance_websocket();

bn_wsp = setInterval(function () {
  try {
    if (binance_ws.readyState == 0) {
      return;
    }

    if (binance_pending.length > 0) {
      var symbol = binance_pending[0];
      var borsa = "binance";

      if (binance_ws_symbols.indexOf(symbol) == -1) {
        var sym_name = symbol.toLowerCase();
        var wes = {
          method: "SUBSCRIBE",
          params: [sym_name + "@bookTicker"],
          id: binance_ws_symbols.length + 1,
        };
        console.log("binance socket subscribe -> ", wes);
        binance_ws.send(JSON.stringify(wes));
        binance_ws_symbols.push(symbol);
      }

      binance_pending = binance_pending.slice(1);
    }

    if (binance_unpending.length > 0) {
      var symbol = binance_unpending[0];
      var borsa = "binance";

      var sdata = binance_ws_symbols;

      if (binance_ws_symbols.indexOf(symbol) > -1) {
        var sym_name = symbol.toLowerCase();
        var wes = {
          method: "UNSUBSCRIBE",
          params: [sym_name + "@bookTicker"],
          id: binance_ws_symbols.length,
        };
        console.log("binance socket unsubscribe -> ", wes);
        binance_ws.send(JSON.stringify(wes));
        binance_ws_symbols = arrayRemove(binance_ws_symbols, symbol);
      }

      binance_unpending = binance_unpending.slice(1);
    }
  } catch (err) {
    console.log("err:", err);
  }
  // console.log("binance socket open ",new Date()," ",binance_pending)
}, 250);

function ajax_query(sql) {
  var d_yol = __dirname.split("/");
  var user_dir = d_yol[d_yol.length - 1];

  var a_sql = querystring.stringify({ q: sql });

  var res = sync_request(
    "GET",
    "http://localhost/" + user_dir + "/ajax.php?" + a_sql
  );
  var body = res.getBody();
  return JSON.parse(body);
}

function bildirim_ekle(user_id, msg, durum = 0) {
  //return

  if (msg == undefined) return;
  msg = msg.toString().split("'").join("").split('"').join("");
  console.log("bildirim(" + user_id + ")=", msg);
  if (bildirim_gonder == 1)
    mysql_query(
      "insert into bildirimler values('','" +
        user_id +
        "','" +
        msg +
        "','" +
        durum +
        "')"
    );
}

async function ch_bildirim_ekle(
  user_id,
  post_id,
  symbol,
  trend,
  open,
  opendate,
  sl,
  last,
  lastdate,
  cmd,
  profit,
  msg
) {
  //return
  if (msg == undefined) return;
  if (user_id == 0) return;
  msg = msg.toString().split("'").join("").split('"').join("");
  console.log("bildirim_ch(" + user_id + ")=", msg);
  var bild_sql =
    "INSERT INTO `bildirimler_ch` (`id`, `user_id`, `post_id`, `symbol`, `trend`, `open`, `opendate`, `sl`, `last`, `lastdate`, `cmd`, `profit`, `msg`, `gonderim`)" +
    "VALUES (NULL, '" +
    user_id +
    "', '" +
    post_id +
    "', '" +
    symbol +
    "', '" +
    trend +
    "', '" +
    open +
    "', '" +
    opendate +
    "', '" +
    sl +
    "', '" +
    last +
    "', '" +
    lastdate +
    "', '" +
    cmd +
    "', '" +
    profit +
    "', '" +
    msg +
    "', '');";
  //console.log(bild_sql)
  if (kanal_bildirim_gonder == 1) await mysql_query(bild_sql);
}

function datetime() {
  var suan = new Date()
    .toISOString()
    .toString()
    .replace("T", " ")
    .split(".")[0]
    .split(" ")[1];
  return suan;
}

function format_date(tm) {
  let yourDate = new Date(parseInt(tm));
  yourDate = yourDate.toISOString().split(".")[0].replace("T", " ");
  return yourDate;
}

function wait(time) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, time);
  });
}

async function mysql_query(query) {
  //console.log("mysql_query() ",query);

  var data2 = await new Promise((resolve, reject) => {
    db.query(query, function (err, rows) {
      if (err) {
        //console.log(err);
      } else {
        //console.log("rows:",rows);
        return resolve(rows);
      }
    });
  }).then((data) => data);
  return data2;
}

function preg_match_all(regex, str) {
  return new RegExp(regex, "g").test(str);
}

async function run_user_signals(sid) {}

async function run_signal(sid) {
  var rsi = await mysql_query("SELECT * FROM `signals` WHERE id='" + sid + "'");

  var new_upd = 0;
  var signal = rsi[0];

  var symbol = signal.symbol;
  // binance_pending.push(symbol)

  var tgh = await mysql_query("SELECT * FROM sinyalgrup where id = '1';");

  var tgh1 = tgh[0];
  var telegram_id = tgh1.telegram_id;

  var signal_finished = 0;
  var signal_runned = 0;
  var sig_interval;

  sig_interval = setInterval(async function () {
    try {
      var sym = binance_symbols[symbol];
      var ask = sym.ask;
      var bid = sym.bid;

      if (bid > 0 && ask > 0) {
      } else {
        return;
      }

      var sdate = format_date(new Date().getTime() + time_shift).toString();

      var rsi = await mysql_query(
        "SELECT * FROM `signals` WHERE id='" + sid + "'"
      );
      var signal = rsi[0];

      // console.log(sdate," #",sid," ",symbol," bid:",bid," ask:",ask," sl:",signal.sl," e1:",signal.entry1," e2:",signal.entry2," tp1:",signal['tp1']," tp2:",signal['tp2']," tp3:",signal.tp3," tp4:",signal.tp4," tp5:",signal.tp5);

      if (signal["close"] > 0) {
        console.log("Sinyal #" + sid + " başarı ile tamamlandı\n");
        clearInterval(sig_interval);
        return;
      }

      if (signal.trend == "LONG") {
        if (signal.open == 0) {
          if (signal.entry1 <= ask && signal.entry2 >= ask) {
            var signal_str =
              "#" +
              signal.symbol +
              " " +
              signal.trend +
              " sinyal takibe alındı. ✅\nEntry1 : " +
              signal.entry1 +
              "\nEntry2: " +
              signal.entry2 +
              "  Ask:" +
              sym.ask;
            await ch_bildirim_ekle(
              telegram_id,
              signal.signalid,
              signal.symbol,
              signal.trend,
              sym.ask,
              sdate,
              signal.sl,
              0,
              0,
              "OPEN",
              0,
              signal_str
            );
            await mysql_query(
              "update signals set open='" +
                ask +
                "', opendate='" +
                sdate +
                "' where id ='" +
                sid +
                "'"
            );
            run_user_signals(sid);
            signal_runned = 1;
          }
        } else {
          for (var t = 10; t >= 0; t--) {
            if (t == 0) {
              if (signal.stoploss == 0 && signal.sl >= bid) {
                var profit = ((bid / signal.open) * 100 - 100) * 20;
                profit = profit.toFixed(3);
                var signal_str = "#" + signal.symbol + " " + signal.trend + " ";
                // bildirim_ekle(telegram_id,signal_str,-1*ss.signalid);
                await ch_bildirim_ekle(
                  telegram_id,
                  signal.signalid,
                  signal.symbol,
                  signal.trend,
                  signal.open,
                  signal.opendate,
                  signal.sl,
                  bid,
                  sdate,
                  "SL",
                  profit,
                  signal_str
                );
                await mysql_query(
                  "update signals set stoploss='" +
                    bid +
                    "',last_sl=1,profit='" +
                    profit +
                    "', close='" +
                    bid +
                    "', closedate='" +
                    sdate +
                    "' where id ='" +
                    sid +
                    "'"
                );
                new_upd = 1;
              }
            } else {
              if (
                (signal.takeprofit == 0 ||
                  signal.takeprofit < signal["tp" + t]) &&
                signal["tp" + t] > 0 &&
                signal["tp" + t] <= bid
              ) {
                var profit = ((bid / signal.open) * 100 - 100) * 20;
                profit = profit.toFixed(3);
                // var signal_str = ss.symbol+" "+ss.trend+" sinyali TP1 e ulaştı. Open:"+ss.open+" TP1:"+ss.tp1+" Bid:"+sym.bid+" profit: %"+profit;
                var signal_str =
                  "#" +
                  signal.symbol +
                  " " +
                  signal.trend +
                  " Take-Profit " +
                  t +
                  " ✅\nProfit: %" +
                  profit +
                  " ";
                //bildirim_ekle(telegram_id,signal_str,-1*ss.signalid);
                if (signal["tp" + (t + 1)] > 0) {
                  await ch_bildirim_ekle(
                    telegram_id,
                    signal.signalid,
                    signal.symbol,
                    signal.trend,
                    signal.open,
                    signal.opendate,
                    signal.sl,
                    bid,
                    sdate,
                    "TP" + t,
                    profit,
                    signal_str
                  );
                  await mysql_query(
                    "update signals set last_tp='" +
                      t +
                      "',takeprofit='" +
                      signal["tp" + t] +
                      "',profit='" +
                      profit +
                      "' where id ='" +
                      signal.id +
                      "'"
                  );
                } else {
                  await ch_bildirim_ekle(
                    telegram_id,
                    signal.signalid,
                    signal.symbol,
                    signal.trend,
                    signal.open,
                    signal.opendate,
                    signal.sl,
                    bid,
                    sdate,
                    "TP" + t,
                    profit,
                    signal_str
                  );
                  await mysql_query(
                    "update signals set last_tp='" +
                      t +
                      "',takeprofit='" +
                      signal["tp" + t] +
                      "',close='" +
                      bid +
                      "',closedate='" +
                      sdate +
                      "',profit='" +
                      profit +
                      "' where id ='" +
                      signal.id +
                      "'"
                  );
                  signal_finished = 1;
                }

                new_upd = 1;
                if (signal_finished == 1) clearInterval(sig_interval);
                // return;
              }
            }
          }

          if (signal_runned == 0 && signal.open > 0 && signal.close == 0) {
            // run_user_signals(sid);
            signal_runned = 1;
            console.log("buy signal.runned");
          }
        }
      } else if (signal.trend == "SHORT") {
        if (signal.open == 0) {
          if (signal.entry1 <= bid && signal.entry2 >= bid) {
            var signal_str =
              "#" +
              signal.symbol +
              " " +
              signal.trend +
              " sinyal takibe alındı. ✅\nEntry1 : " +
              signal.entry1 +
              "\nEntry2: " +
              signal.entry2 +
              "  Bid:" +
              sym.bid;
            await ch_bildirim_ekle(
              telegram_id,
              signal.signalid,
              signal.symbol,
              signal.trend,
              sym.ask,
              sdate,
              signal.sl,
              0,
              0,
              "OPEN",
              0,
              signal_str
            );
            await mysql_query(
              "update signals set open='" +
                ask +
                "', opendate='" +
                sdate +
                "' where id ='" +
                sid +
                "'"
            );
            run_user_signals(sid);
            signal_runned = 1;
          }
        } else {
          for (var t = 10; t >= 0; t--) {
            if (t == 0) {
              if (signal.stoploss == 0 && signal.sl <= ask) {
                var profit = ((signal.open / ask) * 100 - 100) * 20;
                profit = profit.toFixed(3);
                var signal_str = "#" + signal.symbol + " " + signal.trend + " ";
                // bildirim_ekle(telegram_id,signal_str,-1*ss.signalid);
                await ch_bildirim_ekle(
                  telegram_id,
                  signal.signalid,
                  signal.symbol,
                  signal.trend,
                  signal.open,
                  signal.opendate,
                  signal.sl,
                  bid,
                  sdate,
                  "SL",
                  profit,
                  signal_str
                );
                await mysql_query(
                  "update signals set stoploss='" +
                    bid +
                    "',last_sl=1,profit='" +
                    profit +
                    "', close='" +
                    bid +
                    "', closedate='" +
                    sdate +
                    "' where id ='" +
                    sid +
                    "'"
                );
                new_upd = 1;
              }
            } else {
              if (
                (signal.takeprofit == 0 ||
                  signal.takeprofit > signal["tp" + t]) &&
                signal["tp" + t] > 0 &&
                signal["tp" + t] >= ask
              ) {
                var profit = ((signal["open"] / ask) * 100 - 100) * 20;
                profit = profit.toFixed(3);
                signal_str =
                  "#" +
                  signal.symbol +
                  " " +
                  signal.trend +
                  " Take-Profit " +
                  t +
                  " ✅\nProfit: %" +
                  profit +
                  " ";

                if (signal["tp" + (t + 1)] > 0) {
                  await ch_bildirim_ekle(
                    telegram_id,
                    signal.signalid,
                    signal.symbol,
                    signal.trend,
                    signal.open,
                    signal.opendate,
                    signal.sl,
                    bid,
                    sdate,
                    "TP" + t,
                    profit,
                    signal_str
                  );
                  await mysql_query(
                    "update signals set last_tp=" +
                      t +
                      ",takeprofit='" +
                      signal["tp" + t] +
                      "',profit='" +
                      profit +
                      "' where id ='" +
                      signal.id +
                      "'"
                  );
                } else {
                  await ch_bildirim_ekle(
                    telegram_id,
                    signal.signalid,
                    signal.symbol,
                    signal.trend,
                    signal.open,
                    signal.opendate,
                    signal.sl,
                    bid,
                    sdate,
                    "TP" + t,
                    profit,
                    signal_str
                  );
                  await mysql_query(
                    "update signals set last_tp=" +
                      t +
                      ",takeprofit='" +
                      signal["tp" + t] +
                      "',close='" +
                      ask +
                      "',closedate='" +
                      sdate +
                      "',profit='" +
                      profit +
                      "' where id ='" +
                      signal.id +
                      "'"
                  );
                  signal_finished = 1;
                }

                new_upd = 1;
                if (signal_finished == 1) clearInterval(sig_interval);
                // return;
              }
            }
          }

          if (signal_runned == 0 && signal.open > 0 && signal.close == 0) {
            run_user_signals(sid);
            signal_runned = 1;
            console.log("sell signal.runned");
          }
        }
      }

      //echo "signal detail:".implode("\t",signal)."\n";

      await mysql_query(
        "update signals set tickdate='" +
          sym.ticktime +
          "',bid='" +
          sym.bid +
          "',ask='" +
          sym.ask +
          "' where id = '" +
          sid +
          "';"
      );
    } catch (err) {
      console.log("run_signal error:", err);
    }
  }, 500);
}

async function main() {
  await mysql_query("truncate table signals");
  await mysql_query("truncate table user_signals");
  await mysql_query("truncate table bildirimler");
  await mysql_query("truncate table bildirimler_ch");

  await mysql_query("DROP TABLE IF EXISTS `symboldata`;");
  await mysql_query(
    "CREATE TABLE `symboldata` (	  `id` int(11) NOT NULL,	  `symbol` varchar(100) NOT NULL,	  `base` varchar(100) NOT NULL,	  `quote` varchar(100) NOT NULL,	  `digits` int(11) NOT NULL,	  `vdigits` int(11) NOT NULL,	  `ws` int(1) NOT NULL,	  `ticktime` bigint(20) NOT NULL,	  `bid` double NOT NULL,	  `ask` double NOT NULL	) ENGINE=MEMORY DEFAULT CHARSET=utf8;"
  );
  await mysql_query("ALTER TABLE `symboldata` ADD PRIMARY KEY (`id`);");
  await mysql_query("ALTER TABLE `symboldata` ADD INDEX(`symbol`);");
  await mysql_query("ALTER TABLE `symboldata` ADD INDEX(`ws`);");
  await mysql_query(
    "ALTER TABLE `symboldata` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;"
  );

  try {
    let binanced = new ccxt.binanceusdm();
    // console.log(binanced);

    var binance_markets = await binanced.loadMarkets();

    for (const key in binance_markets) {
      var vals = binance_markets[key];

      if (vals.symbol.indexOf("_") > -1) continue;

      var lsa = {
        symbol: vals.symbol,
        base: vals.base,
        quote: vals.quote,
        min_lot: vals.limits.amount.min,
        vdigits: vals.precision.amount,
        digits: vals.precision.price,
        prev_bid: 0,
        prev_ask: 0,
        bid: 0,
        ask: 0,
        date: 0,
        run: 0,
      };

      var nsymbol = vals.base + vals.quote;

      binance_symbols[nsymbol] = lsa;
    }
  } catch (err) {
    console.log("binance connect error:", err);
  }

  while (true) {
    var api_signals = await mysql_query("SELECT * FROM signals where close=0;");

    // console.log("api_signals:",api_signals);

    for (var i = 0; i < api_signals.length; i++) {
      try {
        var api_signal = api_signals[i];

        if (api_signal.symbol.indexOf("1000") > -1) continue;

        var sid = api_signal.id;

        if (start_ed[sid] != true) {
          //await mysql_query("update signals set close = tp3,closedate=from_unixtime(tickdate/1000) where id = '"+sid+"' and tp4=0 and tp5=0 and takeprofit=tp3;");
          //await mysql_query("update signals set close = tp4,closedate=from_unixtime(tickdate/1000) where id = '"+sid+"' and tp5=0 and takeprofit=tp4;");
          binance_pending.push(api_signal.symbol);
          run_signal(sid);
          start_ed[sid] = true;
        }
      } catch (err) {
        console.log("signal while error:", err.message);
      }
    }

    await wait(300);
  }
}

main();
