"use strict";
const fs = require("fs");
const wss = require("ws");
const mysql = require("mysql");

var conf_data = "";

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

let db = mysql.createConnection({
  host: my_host,
  port: 8889,
  user: my_user,
  password: my_pass,
  database: my_name,
});

db.connect(function (err) {
  if (err) console.log("err:", err);

  console.log("MySQL bağlantısı başarıyla gerçekleştirildi.");
});

var binance_pending = [];
var binance_unpending = [];
var binance_sockets = [];
var bn_wsp;
var binance_ready = 0;

function arrayRemove(arr, value) {
  return arr.filter(function (ele) {
    return ele != value;
  });
}

function wait(time) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, time);
  });
}

async function select_query(query) {
  //console.log("select_query() ",query);

  var data2 = await new Promise((resolve, reject) => {
    db.query(query, function (err, rows) {
      // console.log("query:",query);
      if (err) {
        console.log(err);
      } else {
        // console.log("rows:",rows);
        return resolve(rows);
      }
    });
  }).then((data) => data);
  return data2;
}

function binance_websocket(reconnect = 0) {
  try {
    // var bws = new wss("wss://fstream.binance.com/ws");
    var bws = new wss("wss://stream.binancefuture.com");
    bws.on("open", async function open() {
      console.log("binance websocket started");
      if (reconnect == 1) {
        binance_pending = binance_sockets;
        binance_sockets = [];

        for (var h = 0; h < binance_pending.length; h++) {
          var symbol = binance_pending[0];
          var borsa = "binance";

          if (binance_sockets.indexOf(symbol) == -1) {
            var sym_name = symbol.toLowerCase();
            var wes = {
              method: "SUBSCRIBE",
              params: [sym_name + "@bookTicker"],
              id: binance_sockets.length + 1,
            };
            console.log("binance socket subscribe -> ", wes);
            binance_ws.send(JSON.stringify(wes));
            binance_sockets.push(symbol);
            await select_query(
              "update symboldata set ws='2' where symbol='" + symbol + "'"
            );
          }

          binance_pending = binance_pending.slice(1);
        }
      }

      // ws.send(Date.now());

      bn_wsp = setInterval(async function () {
        if (binance_ws.readyState == 0) {
          return;
        }

        if (binance_pending.length > 0) {
          var symbol = binance_pending[0];
          var borsa = "binance";

          if (binance_sockets.indexOf(symbol) == -1) {
            var sym_name = symbol.toLowerCase();
            var wes = {
              method: "SUBSCRIBE",
              params: [sym_name + "@bookTicker"],
              id: binance_sockets.length + 1,
            };
            console.log("binance socket subscribe -> ", wes);
            binance_ws.send(JSON.stringify(wes));
            binance_sockets.push(symbol);
            await select_query(
              "update symboldata set ws='2' where symbol='" + symbol + "'"
            );
          }

          binance_pending = binance_pending.slice(1);
        }

        if (binance_unpending.length > 0) {
          var symbol = binance_unpending[0];
          var borsa = "binance";

          var sdata = binance_sockets;

          if (binance_sockets.indexOf(symbol) > -1) {
            var sym_name = symbol.toLowerCase();
            var wes = {
              method: "UNSUBSCRIBE",
              params: [sym_name + "@bookTicker"],
              id: binance_sockets.length,
            };
            console.log("binance socket unsubscribe -> ", wes);
            binance_ws.send(JSON.stringify(wes));
            binance_sockets = arrayRemove(binance_sockets, symbol);
            await select_query(
              "update symboldata set ws='0',tickdata='',bid='',ask='' where symbol='" +
                symbol +
                "'"
            );
          }

          binance_unpending = binance_unpending.slice(1);
        }

        // console.log("binance socket open ",new Date()," ",binance_pending)
      }, 250);
    });

    bws.on("message", async function message(dat) {
      var data = JSON.parse(dat);

      if (data.s != undefined) {
        var symbol = data.s;

        await select_query(
          "update symboldata set ticktime='" +
            data.E +
            "',bid='" +
            data.b +
            "',ask='" +
            data.a +
            "' where symbol='" +
            symbol +
            "'"
        );

        //console.log("binance",symbol,data.b,data.a,data.E);
      }
    });

    bws.on("close", async function close() {
      console.log("binance websocket disconnected");
      await select_query("update symboldata set ws='0' where 1");
      binance_ws = binance_websocket(1);
    });
  } catch (err) {
    console.log("binance websocket error:", err);
  }

  return bws;
}

var binance_ws = binance_websocket();

async function run() {
  var qr = await select_query("select * from symboldata where ws = '2'");

  for (var e = 0; e < qr.length; e++) {
    var id = qr[e].id;
    var symbol = qr[e].symbol;
    var iws = qr[e].ws;

    if (iws == 2) {
      binance_pending.push(symbol);
      await select_query(
        "update symboldata set ws='2' where symbol='" + symbol + "'"
      );
    }
  }

  while (true) {
    var qr = await select_query(
      "select * from symboldata where ws = '1' or ws='3'"
    );

    for (var e = 0; e < qr.length; e++) {
      var id = qr[e].id;
      var symbol = qr[e].symbol;
      var iws = qr[e].ws;

      if (iws == 1) {
        binance_pending.push(symbol);
      } else if (iws == 3) {
        binance_unpending.push(symbol);
      }
    }

    // binance_pending.push("BTCUSDT")

    await wait(300);
  }
}

run();
