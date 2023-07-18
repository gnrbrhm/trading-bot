<?php
include("mysql.php");
if(php_sapi_name()==="cli")
  $cli_ok=1; 
else 
  die("Not Running from CLI");

#print_r($argv);


$sl_tp_wait_seconds=15;
$signal_cancel_seconds=(60*30);

$sid = $argv[1];
$channel = $argv[2];
$signal_id = $sid;
$api_exchange="binance";
$bildirim_gonder=1;
$pid = getmypid();

# php run_user.php 1 0 hknvip3

// $my->query("update `user_signals` set `open`='',`opentime`='',`close`='',`closetime`='',`ticket`='' where `id` = '$sid';");


function print_rr($arr,$alt=0) {
	
	$str = array();
	if(!is_array($arr)) {
		$arr=array($arr);
	}
	
	foreach($arr as $a => $b) {
		if (is_array($b) or is_object($b)) {
			$str[]="$a=[".print_rr($b,1)."] ";
		} else {
			$str[]="$a=$b ";
		}
	}
	if ($alt==1) {
		return implode(", ",$str)."\n";
	} else {
		echo implode(", ",$str)."\n";
	}
}




$rsi = $my->query("SELECT * FROM `user_signals` WHERE id='$sid'");
$us=$rsi->fetch_assoc();

#echo "user_signal detail:\n";
#echo implode("\t",$us)."\n";


$rsi1 = $my->query("SELECT * FROM `signals` WHERE id='$us[signal_id]'");
$sg=$rsi1->fetch_assoc();



#echo "signal detail:\n";
#echo implode("\t",$sg)."\n";


$api1 = $my->query("SELECT * FROM `apikeys` WHERE id='$us[api_id]'");
$api=$api1->fetch_assoc();

$user_id = $api['user_id'];
$s_id = $sg['id'];
$us_id = $us['id'];

$sym1 = $my->query("SELECT * FROM `symboldata` WHERE symbol='$us[symbol]'");
$sym=$sym1->fetch_assoc();
$symbol = $us["symbol"];

#echo "api detail:\n";
#echo implode("\t",$api)."\n";

$api_key=$api['api_key'];
$api_secret=$api['api_secret'];


$binance = new rbinance($api_key, $api_secret);




$exchange = $binance->get_exchange();

$max_lots=array();

$max_lots[$symbol] = 0;


foreach($exchange['symbols'] as $s1 => $s2) {
	
	foreach($s2['filters'] as $f1 => $f2) {
		
		if($f2['filterType']=="MARKET_LOT_SIZE") {
			$max_lot = $f2['maxQty'];
			$max_lots[$s2['symbol']] = $max_lot;
		}
		
	}
 	
}


$loop_signal=true;

if(strtotime($sg['opendate'])>0 && strtotime($sg['opendate'])+$signal_cancel_seconds<time() and $sg['open']>0 and $us['open']==0) {


	$my->query("update `user_signals` set `event`='sinyalin süresi dolduğu için pas gecildi.',status=2,ticket='-1', `close`='$sg[entry1]',`closetime`='".date("Y-m-d H:i:s")."' where `id` ='".$us['id']."'");
	
	echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] sinyalin süresi dolduğu için pas gecildi.\n";

	$loop_signal=false;
	die();
}




$find_run_user = shell_exec("ps aux | grep 'run_user.php'");

$lines = explode("\n",$find_run_user);
foreach($lines as $a1 => $a2) {
	
	$prc = explode(" ",$a2);
	$find_pid = intval(trim($prc[6]));
	
	if(stristr($a2,"run_user.php $signal_id $channel") and $find_pid != $pid && $find_pid>0) {
		echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] kill old pid #$find_pid run_user.php $sid $channel\n";
		$kill_exec = shell_exec("kill -9 $find_pid");
		#print_rr($kill_exec);
	}
	
}


echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] pid:$pid php run_user.php $sid $channel\n";

try {

	if($api['margin']==0) {
		$margin_sonuc = $binance->api_set_margin_type($symbol,"ISOLATED");
	} else {
		$margin_sonuc = $binance->api_set_margin_type($symbol,"CROSSED");
	}

	echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] margin_mode:";
	print_rr($margin_sonuc);
	

} catch(Exception $apikeyr) {
		
		echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] margin_mode error:\n";
		print_rr($apikeyr);
		
		$error_code = $apikeyr['code'];
		$error_msg = $apikeyr['msg'];
		$error_msg = str_replace("'","",$error_msg);
		$error_msg = str_replace("\"","",$error_msg);
		
		$signal_str = $api_exchange." Emir açılamadı. OPEN ".$api_signal['symbol']." ".$api_signal['trend']." ERROR price:".$price." code:".$error_code." msg:".$error_msg;
		bildirim_ekle($user_id,$signal_str,0);
		$new_sql = "update user_signals set open='".$price."',close='".$price."',opentime='".date("Y-m-d H:i:s")."',closetime='".date("Y-m-d H:i:s")."',status=2,ticket='-1',event='".$error_code."|".$error_msg."' where id = '".$api_signal['id']."'";
		#echo($new_sql."\n");
		$my->query($new_sql);	
			
} 

try {

	$level_status = $binance->api_set_leverage($symbol,$api['leverage']);
	echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] leverage status:";
	print_rr($level_status);
	#$max_lots[$symbol] = $level_status['maxNotionalValue'];

} catch(Exception $leverage_err) {
		
		echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] leverage error:";
		print_rr($leverage_err);
	
} 



function bildirim_ekle($user_id,$msg,$durum=0) {
	global $bildirim_gonder, $my,$user_id,$s_id,$us_id;
	//return
	
	if($msg=="") return;
	$msg = stripslashes($msg);
	$msg1 = str_replace("\n"," ",$msg);
	echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] bildirim = ".$msg1."\n";
	if($bildirim_gonder==1) $my->query("insert into bildirimler values('','".$user_id."','".$msg."','".$durum."')");
	
}

function create_order($sid) {
	global $my,$binance,$api_exchange,$max_lots,$user_id,$s_id,$us_id;
	

	$rsi = $my->query("SELECT * FROM `user_signals` WHERE id='$sid'");
	$us=$rsi->fetch_assoc();
	
	if($us['close']>0 || $us['open']>0) return;

	$rsi1 = $my->query("SELECT * FROM `signals` WHERE id='$us[signal_id]'");
	$sg=$rsi1->fetch_assoc();

	$api1 = $my->query("SELECT * FROM `apikeys` WHERE id='$us[api_id]'");
	$api=$api1->fetch_assoc();
	$user_id = $api['user_id'];


	$sym1 = $my->query("SELECT * FROM `symboldata` WHERE symbol='$us[symbol]'");
	$sym=$sym1->fetch_assoc();
	$symbol = $us["symbol"];
	
	$price = 0;
	$volume=number_format($api['lot'],$sym['vdigits'],".","");
	$sprice=number_format($sg['sl'],$sym['digits'],".","");
	$tprice=number_format($sg['tp5'],$sym['digits'],".","");
	
	$p_risk = $binance->position_risk();
	
	$emir_adet = 0;
	
	foreach($p_risk as $a => $b) {
		if($b!=0) {
			$emir_adet++;
		}
	}
	
	if($p_risk[$symbol]!=0) {
		
		$orders=array();
		$orders['code'] = -101;
		$orders['code'] = "zaten elinizde açık $symbol pozisyonu olduğu için pozisyon açılamadı.";
		
	} else if($emir_adet>=$api['maxemir']) {
		
		$orders=array();
		$orders['code'] = -102;
		$orders['code'] = "maksimum $api[maxemir] adet emir açmaya izin verdiğiniz için bu emir açılamadı. Şuan açık emir sayınız $emir_adet";
		
	} else {
		
		$max_lot = $max_lots[$symbol];
		
		$b_orders=array();
		
		if($sg['trend']=="LONG") {
			$price = $sym['ask'];
			$volume=number_format($api['lot']/$price,$sym['vdigits'],".","");
			if($max_lot>0 && $volume>$max_lot) $volume = number_format($max_lot,$sym['vdigits'],".","");
			$b_orders[]=$binance->prepare_order($symbol,"BUY","MARKET",$volume,$price);
			if($api['stoploss'] == 0 && $api['sltpemir']==1) {
				$b_orders[]=$binance->prepare_order($symbol,"SELL","SL",0,$sprice);
			} else if($api['stoploss']>0 && $api['sltpemir']==1) {
				$sprice = number_format($sym['ask']*((100-$api['stoploss'])/100),$sym['digits'],".","");
				$b_orders[]=$binance->prepare_order($symbol,"SELL","SL",0,$sprice);
			} else {
				$b_orders[]=$binance->prepare_order($symbol,"SELL","NSL",0,$sprice);
			}	
			
			if($api['takeprofit'] == 0 && $api['sltpemir']==1) {
				$tprice = $sg['tp5'];
				$b_orders[]=$binance->prepare_order($symbol,"SELL","TP",0,$tprice);
			} else if($api['takeprofit'] == -1 && $api['sltpemir']==1) {
				$tprice = $sg['tp1'];
				$b_orders[]=$binance->prepare_order($symbol,"SELL","TP",0,$tprice);
			} else if($api['takeprofit'] == -2 && $api['sltpemir']==1) {
				$tprice = $sg['tp2'];
				$b_orders[]=$binance->prepare_order($symbol,"SELL","TP",0,$tprice);
			} else if($api['takeprofit'] == -3 && $api['sltpemir']==1) {
				$tprice = $sg['tp3'];
				$b_orders[]=$binance->prepare_order($symbol,"SELL","TP",0,$tprice);
			} else if($api['takeprofit'] == -4 && $api['sltpemir']==1) {
				$tprice = $sg['tp4'];
				$b_orders[]=$binance->prepare_order($symbol,"SELL","TP",0,$tprice);
			} else if($api['takeprofit'] == -5 && $api['sltpemir']==1) {
				$tprice = $sg['tp5'];
				$b_orders[]=$binance->prepare_order($symbol,"SELL","TP",0,$tprice);
			} else if($api['takeprofit']>0 && $api['sltpemir']==1) {
				$tprice = number_format($sym['ask']*((100+$api['takeprofit'])/100),$sym['digits'],".","");
				$b_orders[]=$binance->prepare_order($symbol,"SELL","TP",0,$tprice);
			} else if ($api['sltpemir']==1) {
				$tprice = $sg['tp5'];
				$b_orders[]=$binance->prepare_order($symbol,"SELL","TP",0,$tprice);
			}
			
			
		} else if($us['trend']=="SHORT") {
			$price = $sym['bid'];
			$volume=number_format($api['lot']/$price,$sym['vdigits'],".","");
			if($max_lot>0 && $volume>$max_lot) $volume = number_format($max_lot,$sym['vdigits'],".","");
			$b_orders[]=$binance->prepare_order($symbol,"SELL","MARKET",$volume,$sym['bid']);
			if($api['stoploss'] == 0 && $api['sltpemir']==1) {
				$b_orders[]=$binance->prepare_order($symbol,"BUY","SL",0,$sprice);
			} else if($api['stoploss']>0 && $api['sltpemir']==1) {
				$sprice = number_format($sym['ask']*((100+$api['stoploss'])/100),$sym['digits'],".","");
				$b_orders[]=$binance->prepare_order($symbol,"BUY","SL",0,$sprice);
			} else {
				$b_orders[]=$binance->prepare_order($symbol,"BUY","NSL",0,$sprice);
			}	
			
			if($api['takeprofit'] == 0 && $api['sltpemir']==1) {
				$tprice = $sg['tp5'];
				$b_orders[]=$binance->prepare_order($symbol,"BUY","TP",0,$tprice);
			} else if($api['takeprofit'] == -1) {
				$tprice = $sg['tp1'];
				$b_orders[]=$binance->prepare_order($symbol,"BUY","TP",0,$tprice);
			} else if($api['takeprofit'] == -2) {
				$tprice = $sg['tp2'];
				$b_orders[]=$binance->prepare_order($symbol,"BUY","TP",0,$tprice);
			} else if($api['takeprofit'] == -3) {
				$tprice = $sg['tp3'];
				$b_orders[]=$binance->prepare_order($symbol,"BUY","TP",0,$tprice);
			} else if($api['takeprofit'] == -4) {
				$tprice = $sg['tp4'];
				$b_orders[]=$binance->prepare_order($symbol,"BUY","TP",0,$tprice);
			} else if($api['takeprofit'] == -5) {
				$tprice = $sg['tp5'];
				$b_orders[]=$binance->prepare_order($symbol,"BUY","TP",0,$tprice);
			} else if($api['takeprofit']>0) {
				$tprice = number_format($sym['ask']*((100-$api['takeprofit'])/100),$sym['digits'],".","");
				$b_orders[]=$binance->prepare_order($symbol,"BUY","TP",0,$tprice);
			}
		
		}	
			
		$orders = $binance->bulk_order_send($b_orders);
		
		#echo "order_send_return:\n";
		#print_r($orders);
		
	}
	
	$order_ticket = $orders[0]['orderId'];
	$order_status = $orders[0]['status'];
	$sl_ticket = $orders[1]['orderId'];
	$tp_ticket = $orders[2]['orderId'];
	
	
	$api_exchange="binance";
	
	
	
	if(count($orders)>0 && $order_ticket>0) {
		
		$results = "#".$order_ticket." ".$symbol." ".$volume." ".$us['trend']." ".$price." #".$order_ticket." ".$price." ".date("Y-m-d H:i:s")." ".$order_status;
		#echo($api['exchange']."[u".$user_id."] [s".$us['signal_id']."] [".$api['id']."] ->".$symbol."->".$us['trend']." results : ".$results."\n");
		
		$signal_str = $api_exchange." OPEN #".$order_ticket."  ".$us['symbol']." ".$us['trend']." price:".$price." sl:".$sprice." volume:".$volume;
		bildirim_ekle($user_id,$signal_str,0);
		
		$my->query("update user_signals set open='".$price."',ticket='".$order_ticket."',sl='".$sprice."',sticket='".$sl_ticket."',tticket='".$tp_ticket."',opentime='".date("Y-m-d H:i:s")."',volume='".$volume."',status=1 where id ='".$us['id']."'");
		echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] $results\n";

		if($sl_ticket>0) {
			
		} else {

			$sl_error_msg = stripslashes($orders[1]['msg']);
			$sl_error_msg = str_replace("'","",$sl_error_msg);
			$sl_error_msg = str_replace("\"","",$sl_error_msg);	
			if(stristr($sl_error_msg,"direction is existing")) {
				$sl_ticket=-1;
			}
			
			
		}
		if($tp_ticket>0) {
			
		} else {

			$tp_error_msg = stripslashes($orders[2]['msg']);
			$tp_error_msg = str_replace("'","",$tp_error_msg);
			$tp_error_msg = str_replace("\"","",$tp_error_msg);	
			
			if(stristr($tp_error_msg,"direction is existing")) {
				$tp_ticket=-1;
			}
			
		}
			
	

	} else if($orders['code']!="" or $orders[0]['code']!="") {
		
		if ($orders[0]['code']!="") {
		
			$error_code = $orders[0]['code'];
			$error_msg = stripslashes($orders[0]['msg']);
			
		} else {
			
			$error_code = $orders['code'];
			$error_msg = stripslashes($orders['msg']);
		}  
		
		if($error_code == "-4061") {
			$error_msg = "Hesabınız hedge modunda olduğu için işlem açılamamıştır. Hesabınız one-way moduna aldığınızda işlemleriniz açılacaktır.";
		} else if($error_code == "-2019") {
			$error_msg = "Hesap bakiyeniz bu işlemi açabilmek için yetersiz.";
		} else if($error_code == "-4164") {
			$error_msg = "Kapatmak istediğiniz lot miktarı 6 USDT den küçük olamaz. 6 USDT den daha küçük bir pozisyon kapatmaya çalışıyorsunuz. ";
		} else if($error_code == "-2015") {
			$error_msg = "API key anahtarınız yanlıştır. Eğer doğru olduğunu düşünüyorsanız. Futures cüzdanı olup olmadığına, Api key için futures izni verip vermediğinize emin olun. ";
		}
		
		$error_msg = str_replace("'","",$error_msg);
		$error_msg = str_replace("\"","",$error_msg);

		$signal_str = $api_exchange." Emir açılamadı. OPEN ".$us['symbol']." ".$us['trend']." ERROR price:".$price." code:".$error_code." msg:".$error_msg;
		bildirim_ekle($user_id,$signal_str,0);
		$new_sql = "update user_signals set open='".$price."',close='".$price."',opentime='".date("Y-m-d H:i:s")."',closetime='".date("Y-m-d H:i:s")."',status=2,ticket='-1',event='".$error_code."|".$error_msg."' where id = '".$us['id']."'";
		
		echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] $signal_str\n";
		
		$my->query($new_sql);	
			
			
	}					
	
	
}

function trail_stop($sid,$name,$hedef,$sprice) {

	global $my,$binance,$api_exchange,$signal_id,$s_id,$us_id;
	

	$rsi = $my->query("SELECT * FROM `user_signals` WHERE id='$sid'");
	$us=$rsi->fetch_assoc();
	
	if($us['close']>0) return;

	$rsi1 = $my->query("SELECT * FROM `signals` WHERE id='$us[signal_id]'");
	$sg=$rsi1->fetch_assoc();


	$api1 = $my->query("SELECT * FROM `apikeys` WHERE id='$us[api_id]'");
	$api=$api1->fetch_assoc();
	$user_id = $api['user_id'];


	$sym1 = $my->query("SELECT * FROM `symboldata` WHERE symbol='$us[symbol]'");
	$sym=$sym1->fetch_assoc();
	$symbol = $us["symbol"];
	
	if($us['sticket']>0) {
		
		$ord_delete = $binance->order_delete($symbol,$us['sticket']);
		#echo "order_delete:";
		#print_rr($ord_delete);
		$my->query("update user_signals set sticket='' where id ='".$us['id']."'");
		
	}
	 
	$sprice=number_format($sprice,$sym['digits'],".","");	 
	$sl_ticket = $binance->order_send($symbol,($us['trend']=="LONG" ? "SELL" : "BUY"),"SL",0,$sprice);
	
	#echo "new_sl_ticket:\n";
	#print_rr($sl_ticket);
	
	if($sl_ticket['orderId']>0) {
		$sticket=$sl_ticket['orderId'];
		$signal_str = $api_exchange." #$sticket UPDATE $name ".$us['symbol']." yeni_hedef:".$hedef." yeni_sl:".$sprice;
		bildirim_ekle($user_id,$signal_str,0);
		$my->query("update user_signals set sticket='".$sticket."',sl='".$sprice."' where id ='".$us['id']."'");
		echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] $signal_str\n";
	} else {
		
		$profit=0;
		if($us['trend']=="LONG") {
			$profit=(($us['sl']/$us['open'])*$api['lot'])-$api['lot'];
		} else if($us['trend']=="SHORT") {
			$profit=(($us['open']/$us['sl'])*$api['lot'])-$api['lot']; 
		}
		
		$signal_str = $api_exchange." #$us[ticket] CLOSED $name ".$us['symbol']." open:".$us['open']." close:".$us['sl']." profit:".$profit;
		bildirim_ekle($user_id,$signal_str,0);
		echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] $signal_str\n";
		$my->query("update user_signals set closed_volume=volume,close=sl,closetime='".date("Y-m-d H:i:s")."',profit='$profit' where id ='".$us['id']."'");
	}
	
}	

function close_order($sid,$close_price=0,$close_point="",$close_volume=0) {
	global $my,$binance,$api_exchange,$user_id,$s_id,$us_id;
	
	$rsi = $my->query("SELECT * FROM `user_signals` WHERE id='$sid'");
	$us=$rsi->fetch_assoc();
	
	if($us['close']>0) return;

	#echo "user_signal detail:\n";
	#echo implode("\t",$us)."\n";

	$rsi1 = $my->query("SELECT * FROM `signals` WHERE id='$us[signal_id]'");
	$sg=$rsi1->fetch_assoc();

	#echo "signal detail:\n";
	#echo implode("\t",$sg)."\n";


	$api1 = $my->query("SELECT * FROM `apikeys` WHERE id='$us[api_id]'");
	$api=$api1->fetch_assoc();
	$user_id = $api['user_id'];


	$sym1 = $my->query("SELECT * FROM `symboldata` WHERE symbol='$us[symbol]'");
	$sym=$sym1->fetch_assoc();
	$symbol = $us["symbol"];
	
	$price = 0;
	$volume=$api['lot'];
	$sprice=$sg['sl'];
	$tprice=$sg['tp5'];
	
	$b_orders=array();
	$tamamen_kapandi=0;
	
	$p_risk = $binance->position_risk();	
	$acik_poz = $p_risk[$symbol];
	
	if($acik_poz == 0) {

		$close_price = $us['sl'];
		
		$kapat_volume = $us['volume']-$us['closed_volume'];

		if($sg['trend']=="LONG") {
			
			$profit = (($us['open']/$us['sl'])*$api['lot'])-$api['lot'];
			$profit = $profit*($kapat_volume/$us['volume']);
			
		} else if($us['trend']=="SHORT") {
			
			$profit = (($us['open']/$us['sl'])*$api['lot'])-$api['lot'];
			$profit = $profit*($kapat_volume/$us['volume']);

		}			

		$signal_str = $api_exchange." N-CLOSED ".$us['symbol']." ".$us['trend']." open:".$us['open']." close:".$close_price." lot:".$kapat_volume." profit:".$profit;
		bildirim_ekle($user_id,$signal_str,0);
		echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] $signal_str\n";
		$my->query("update user_signals set close='".$close_price."',closed_volume=(closed_volume+".$kapat_volume."),closetime='".date("Y-m-d H:i:s")."' where id ='".$us['id']."'");
	
	} else if($us['volume']>$us['closed_volume']) {
		
		$kapat_volume = number_format($us['volume']*($close_volume/100),$sym['vdigits'],".","");
		$min_lot = pow(10,-$sym['vdigits']);
		
		if($kapat_volume<$min_lot) $kapat_volume=$min_lot;
		
		#echo "kapat_volume:$kapat_volume   volume:$us[volume]  close_volume:$close_volume   vdigits:$sym[vdigits]\n";
		
		if($us['closed_volume']+$kapat_volume>=$us['volume']) {
			$kapat_volume = number_format($us['volume']-$us['closed_volume'],$sym['vdigits'],".","");
			$tamamen_kapandi=1;
		}
		
		$profit = 0;
		$price = 0;
		
		if($api['sltpemir']==1 and $api['stoploss']!=-1) {
			if($sg['trend']=="LONG") {
				
				$price = $sym['bid'];
				$kapat_ticket = $binance->order_send($symbol,"SELL","MARKET",$kapat_volume,$price,1);
				$profit = (($us['open']/$us['sl'])*$api['lot'])-$api['lot'];
				$profit = $profit*($kapat_volume/$us['volume']);
				
			} else if($us['trend']=="SHORT") {
				
				$price = $sym['ask'];
				$kapat_ticket = $binance->order_send($symbol,"BUY","MARKET",$kapat_volume,$price,1);
				$profit = (($us['open']/$us['sl'])*$api['lot'])-$api['lot'];
				$profit = $profit*($kapat_volume/$us['volume']);

			}	
		}
		
		#echo "kapat_ticket:\n";
		#print_rr($kapat_ticket);
		#print_r("kapat_ticket\n");
		#print_r($kapat_ticket);
		
		$order_ticket = $kapat_ticket['orderId'];
		$order_status = $kapat_ticket['status'];
		$api_exchange="binance";

		if($order_ticket>0) {
			
			$results = "#".$order_ticket." ".$symbol." ".$kapat_volume." ".$us['trend']." ".$price." #".$order_ticket." ".$profit." ".date("Y-m-d H:i:s")." ".$order_status;
			#echo($api['exchange']."[u".$user_id."] [s".$us['signal_id']."] [".$api['id']."] ->".$symbol."->".$us['trend']." results : ".$results."\n");
			
			
			if($tamamen_kapandi==0) {

				$signal_str = $api_exchange." PARTIAL CLOSED ".$us['symbol']." ".$us['trend']." open:".$us['open']." close:".$price." lot:".$kapat_volume." profit:".$profit;
				bildirim_ekle($user_id,$signal_str,0);
				echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] $signal_str\n";
				$my->query("update user_signals set tp='".$close_price."',closed_volume=(closed_volume+".$kapat_volume.") where id ='".$us['id']."'");
			} else {

				$signal_str = $api_exchange." CLOSED ".$us['symbol']." ".$us['trend']." open:".$us['open']." close:".$price." lot:".$kapat_volume." profit:".$profit;
				bildirim_ekle($user_id,$signal_str,0);
				echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] $signal_str\n";
				$my->query("update user_signals set close='".$close_price."',closed_volume=(closed_volume+".$kapat_volume."),closetime='".date("Y-m-d H:i:s")."' where id ='".$us['id']."'");
			}
				
		} else {

			$error_code = $kapat_ticket['code'];
			$error_msg = stripslashes($kapat_ticket['msg']);
			$error_msg = str_replace("'","",$error_msg);
			$error_msg = str_replace("\"","",$error_msg);
			
			if ($error_code == "-100") {
				
				$kapat_volume = $api['lot'];
				
				if($us['trend']=="LONG") {
					$profit = (($us['open']/$us['sl'])*$api['lot'])-$api['lot'];
					$profit = $profit*($kapat_volume/$us['volume']);
				} else {
					$profit = (($us['open']/$us['sl'])*$api['lot'])-$api['lot'];
					$profit = $profit*($kapat_volume/$us['volume']);
				}
				
				$signal_str = $api_exchange." CLOSED ".$us['symbol']." ".$us['trend']." open:".$us['open']." close:".$price." lot:".$kapat_volume." profit:".$profit;
				bildirim_ekle($user_id,$signal_str,0);
				$new_sql = "update user_signals set close='".$price."',closetime='".date("Y-m-d H:i:s")."',status=1 where id = '".$us['id']."'";
				echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] $signal_str\n";
				$my->query($new_sql);	
				
				
				
			} else {
				
				if($price==0)$price=$us['sl'];
				if($price==0)$price=$sg['entry1'];
				$signal_str = $api_exchange." Emir kapatılamadı. CLOSE ".$us['symbol']." ".$us['trend']." ERROR price:".$price." code:".$error_code." msg:".$error_msg;
				bildirim_ekle($user_id,$signal_str,0);
				$new_sql = "update user_signals set close='".$price."',closetime='".date("Y-m-d H:i:s")."',status=2,event='".$error_code."|".$error_msg."' where id = '".$us['id']."'";
				echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] $signal_str\n";
				$my->query($new_sql);	
				
			}
			
		}	

	}
	
	
}	

$fba=0;

while ($loop_signal) {
	

	$aa1 = $my->query("SELECT * FROM user_signals where id = '".$signal_id."';");
	$aa = $aa1->fetch_assoc();


	if($aa['id']>0) { } else { 
	echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] ".$api['name']." ".$signal['symbol']." ".$signal['trend']." -> user_signals bulunamadı signal_id:".$signal_id."\n"; 
	break; 
	}
	


	$rsi1 = $my->query("SELECT * FROM `signals` WHERE id='$us[signal_id]'");
	$signal=$rsi1->fetch_assoc();

	$sym1 = $my->query("SELECT * FROM `symboldata` WHERE symbol='$us[symbol]'");
	$sym=$sym1->fetch_assoc();


	if (($aa['close']>0) || $aa['ticket']==-1) {  
		echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] ".$api['name']." ".$signal['symbol']." ".$signal['trend']." ->  #".$aa['ticket']." sinyal kapandı close:".$aa['close']."\n"; 
		break; 
	}
	
	$symbol = $signal['symbol'];
	
	if($binance->digits==0) $binance->digits=$sym['digits'];
	if($binance->vdigits==0) $binance->vdigits=$sym['vdigits'];
	
	$bid = $sym['bid'];
	$ask = $sym['ask'];
	
	if ($ask == 0 || $bid == 0) continue;
	
	if($fba==0) {
		echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] ".$api['user_id']." ".$api['name']." ".$signal['symbol']." ".$signal['trend']." ".$signal['opendate']." b:".$bid." a:".$ask." #".$aa['ticket']." o:".$aa['open']." ".$aa['opentime']." c:".$aa['close']." ".$aa['closetime']."\n";
		$fba=1;
	}
	
	$last_bid = $bid;
	$last_ask = $ask;
		
	

		if ( $signal['trend'] == "LONG" ) {
			
			if($aa['close']>0 && $aa['volume']<=$aa['closed_volume']) {
				#echo("cmd_user_signal(".$signal_id.") ".$api['user_id']." ".$api['name']." ".$signal['symbol']." ".$signal['trend']." -> sinyal kapandığı için durduruldu $aa[close]:".$aa['close'].". 2041\n");					
				echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id]  ".$signal['symbol']." ".$signal['trend']." -> sinyal kapandığı için durduruldu close:".$aa['close']." \n";
				//trade_log(user_id,signal_id+" "+$signal['symbol']+" "+$signal['trend']+" pozisyonu takibi tamamlandı. volume:"+$aa['volume']+" closed_volume:"+$aa['closed_volume'])
				break;
			} else if ($aa['open'] == 0 && strtotime($signal['opendate'])>0 && strtotime($signal['opendate'])+$signal_cancel_seconds>time() /* && aralikta(signal.entry1,signal.entry2,$sym['bid'])*/ ) {
				create_order($sid);
			} else if ($aa['open']>0 && $aa['close']==0) {	
				
				$new_sl = 0;
				$new_tp = 0;
				
				if($aa['sticket']<1 && $api['sltpemir']==1 && $aa['sl_wait']+$sl_tp_wait_seconds<time() && $api['exchange']=="binance" && $api['stoploss'] != -1) {
					
					if($aa['sl']>0) {
						$new_sl = $aa['sl'];
					} else if($api['stoploss']==0) {
						$new_sl = $signal['sl'];
					} else if($api['stoploss']>0) {
						$new_sl = number_format($sym['ask']*((100-$api['stoploss'])/100),$sym['digits'],".","");
					}
					
					if($new_sl>0 && $api['exchange']=="binance") {
						// $send_json = {"symbol":$signal['symbol'],"side":"SELL","type":"STOP_MARKET","closePosition":"true","stopPrice":new_sl};	
						$sl_ticket = $binance->order_send($signal['symbol'],"SELL","SL",0,$new_sl);
						$sl_order_id=0;
						if($sl_ticket['orderId']>0) {
							$my->query("update user_signals set sl='".$new_sl."',sl_wait='".time()."',sticket='".$sl_ticket['orderId']."' where id ='".$aa['id']."'");		
							echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] fix broken sl #$sl_ticket[orderId] new_sl:$new_sl\n";
							$aa['sl'] = $new_sl;
							$sl_order_id=$sl_ticket['orderId'];
						} else {
							
							$error_code = $sl_ticket['code'];
							$error_msg = stripslashes($sl_ticket['msg']);
							$error_msg = str_replace("'","",$error_msg);
							$error_msg = str_replace("\"","",$error_msg);
							
							$p_risk = $binance->position_risk();	
							$acik_poz = $p_risk[$signal['symbol']];
							
							if($acik_poz==0) {

								$close_price = $aa['sl'];
								
								$kapat_volume = $aa['volume']-$aa['closed_volume'];

								if($aa['trend']=="LONG") {
									
									$profit = (($aa['open']/$aa['sl'])*$api['lot'])-$api['lot'];
									$profit = $profit*($kapat_volume/$aa['volume']);
									
								} else if($aa['trend']=="SHORT") {
									
									$profit = (($aa['open']/$aa['sl'])*$api['lot'])-$api['lot'];
									$profit = $profit*($kapat_volume/$aa['volume']);

								}			

								$signal_str = $api_exchange." N-CLOSED ".$aa['symbol']." ".$aa['trend']." open:".$aa['open']." close:".$close_price." lot:".$kapat_volume." profit:".$profit;
								bildirim_ekle($user_id,$signal_str,0);
								echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] $signal_str\n";
								$my->query("update user_signals set close='".$close_price."',closed_volume=(closed_volume+".$kapat_volume."),closetime='".date("Y-m-d H:i:s")."' where id ='".$aa['id']."'");
														
							
							} else if($error_code == "-4130") {
								
								$open_orders = $binance->open_orders($symbol);
								
								foreach($open_orders as $op1 => $op2) {
									if($op2['symbol'] == $symbol and $op2['type'] == "STOP_MARKET") {
										$cancel_stop = $binance->order_delete($symbol,$op2['orderId']);
										echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] cancel_order(".$op2['orderId'].")  symbol:".$op2['symbol']."\n";
										#print_rr($cancel_stop);
									}
								}
								
								$my->query("update user_signals set sticket='' where id ='".$aa['id']."'");		
								
							} else {
								
								$sticket = -1;
								
								if(stristr($error_msg,"orders or positions are available")) {
									$sticket=$us_id;
								}
							
								$my->query("update user_signals set sticket='$sticket',sl_wait='".time()."',event='".$error_code."|".$error_msg."' where id ='".$aa['id']."'");		
								#echo "fix sl error code:$error_code  err:$error_msg \n";
								echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] fix sl error code:$error_code  err:$error_msg\n";
							
							}
							
						}
					
						#echo ("fix_sl_order[".$signal_id."]\n");
						#print_rr($sl_ticket);
						
					}
				
				}
				
				if($aa['tticket']<1 && $api['sltpemir']==1 && $api['exchange']=="binance") {
					
					if($api['takeprofit']==0) {
						$new_tp = ($signal['tp5']);
					} else if($api['takeprofit']==-1) {
						$new_tp = ($signal['tp1']);
					} else if($api['takeprofit']==-2) {
						$new_tp = ($signal['tp2']);
					} else if($api['takeprofit']==-3) {
						$new_tp = ($signal['tp3']);
					} else if($api['takeprofit']==-4) {
						$new_tp = ($signal['tp4']);
					} else if($api['takeprofit']==-5) {
						$new_tp = ($signal['tp5']);
					} else if($api['takeprofit']==-6) {
						$new_tp = ($signal['tp6']);
					} else if($api['takeprofit']==-7) {
						$new_tp = ($signal['tp7']);
					} else if($api['takeprofit']==-8) {
						$new_tp = ($signal['tp8']);
					} else if($api['takeprofit']==-9) {
						$new_tp = ($signal['tp9']);
					} else if($api['takeprofit']==-10) {
						$new_tp = ($signal['tp10']);
					} else if($api['takeprofit']>0) {
						$new_tp = ($sym['ask']*((100+$api['takeprofit'])/100));
					}
					
					if($new_tp>0 && $aa['tp_wait']+$sl_tp_wait_seconds<time() && $api['sltpemir']==1) {
						#$send_json = {symbol:$signal['symbol'],side:"SELL",type:"TAKE_PROFIT_MARKET","closePosition":"true","stopPrice":new_tp};	
						$tp_ticket = $binance->order_send($signal['symbol'],"SELL","TP",0,$new_tp);
						$tp_order_id=0;
						
						if($tp_ticket['orderId']>0) {
							
							$my->query("update user_signals set tticket='".$tp_ticket['orderId']."',tp_wait='".time()."' where id ='".$aa['id']."'");		
							$tp_order_id=$tp_ticket['orderId'];
							echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] fix broken tp #$tp_ticket[orderId] new_tp:$new_tp\n";
							
						} else {
							

							$error_code = $tp_ticket['code'];
							$error_msg = stripslashes($tp_ticket['msg']);
							$error_msg = str_replace("'","",$error_msg);
							$error_msg = str_replace("\"","",$error_msg);

							
							$p_risk = $binance->position_risk();	
							$acik_poz = $p_risk[$signal['symbol']];
							
							if($acik_poz==0) {

								$close_price = $aa['sl'];
								
								$kapat_volume = $aa['volume']-$aa['closed_volume'];

								if($aa['trend']=="LONG") {
									
									$profit = (($aa['open']/$aa['sl'])*$api['lot'])-$api['lot'];
									$profit = $profit*($kapat_volume/$aa['volume']);
									
								} else if($aa['trend']=="SHORT") {
									
									$profit = (($aa['open']/$aa['sl'])*$api['lot'])-$api['lot'];
									$profit = $profit*($kapat_volume/$aa['volume']);

								}			

								$signal_str = $api_exchange." N-CLOSED ".$aa['symbol']." ".$aa['trend']." open:".$aa['open']." close:".$close_price." lot:".$kapat_volume." profit:".$profit;
								bildirim_ekle($user_id,$signal_str,0);
								echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] $signal_str\n";
								$my->query("update user_signals set close='".$close_price."',closed_volume=(closed_volume+".$kapat_volume."),closetime='".date("Y-m-d H:i:s")."' where id ='".$aa['id']."'");
														
							
							} else if($error_code == "-4130") {
								
								$open_orders = $binance->open_orders($symbol);
								
								foreach($open_orders as $op1 => $op2) {
									if($op2['symbol'] == $symbol and $op2['type'] == "TAKE_PROFIT_MARKET") {
										$cancel_stop = $binance->order_delete($symbol,$op2['orderId']);
										echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] cancel_order(".$op2['orderId'].") TAKE_PROFIT_MARKET symbol:".$op2['symbol']."\n";
										#print_rr($cancel_stop);
									}
								}
								
								$my->query("update user_signals set tticket='' where id ='".$aa['id']."'");		
								
							} else {
															
								
								$tticket = -1;
								
								if(stristr($error_msg,"orders or positions are available")) {
									$tticket=$us_id;
								}
								
								$my->query("update user_signals set tticket='$tticket',tp_wait='".time()."',event='".$error_code."|".$error_msg."' where id ='".$aa['id']."'");		
								echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] fix tp error code:$error_code  err:$error_msg\n";
								
							}
							
						}
						#echo ("fix_tp_order[".$signal_id."] ");
						#print_rr($tp_ticket);
		
					}
				
				}
				
				if($api['trailstop']<0) {
						
					for($y=abs($api['trailstop']);$y<10;$y++) {
						
						
						$a_sl_price = 0;
						$a_sl_id = $y-abs($api['trailstop']);
						if($a_sl_id==0) {
							$new_sl=$aa['open'];
						} else {
							$new_sl=$signal['tp'.$a_sl_id];
						}
						
						if($signal['tp'.$y]<$sym['bid'] && $signal['tp'.$y]>0 && ($aa['sl']<$new_sl || $aa['sl']==0)) {
							trail_stop($sid,"TRAILSTOP ".($a_sl_id+1),$signal['tp'.$y],$new_sl);
							$aa['sl']=$new_sl;
						}
					}
					
				} else if($api['trailstop']>0) {
					
					$tsl = ($aa['open']*((100+$api['trailstop'])/100));
					$tsp = ($aa['open']*((100+$api['trailstep'])/100));
					
					$tsl_fark = $tsl-$aa['open'];
					$tsp_fark = $tsp-$aa['open'];
					$min_val = pow(10,$sym['digits']*-1);
					if($tsl_fark<$min_val) $tsl_fark=$min_val;
					if($tsp_fark<$min_val) $tsp_fark=$min_val;
					
					$new_tsl_open = ($aa['open'])+($tsl_fark)+($tsp_fark);
					$new_tsl_sl = ($aa['sl'])+($tsl_fark)+($tsp_fark);
					$new_tsl = ($sym['bid'])-($tsl_fark);
					
					$new_tsl_open = ($new_tsl_open);
					$new_tsl_sl = ($new_tsl_sl);
					$new_tsl = ($new_tsl);
					
					if( ($aa['sl'] == 0 || $aa['sl']<$aa['open']) && $new_tsl_open<=$sym['bid'] ) {
						trail_stop($sid,"NEW TSL",$new_tsl_open,$new_tsl);
					} else if ($aa['sl']>$aa['open'] && $new_tsl_sl<=$sym['bid']) {
						trail_stop($sid,"NEW TSL 2",$new_tsl_sl,$new_tsl);
					}
					
				} 
				
				if($api['maliyetinecek']>0) {
					
					for($i=1;$i<10;$i++) {
						if ($sym['bid']>=$signal['tp'.$i] && $signal['tp'.$i]>0 && $api['maliyetinecek']==$i && ($aa['sl']<$aa['open'] || $aa['sl']==0)) {
							trail_stop($sid,"MALIYETINE CEK ".$i,$signal['tp'.$i],$aa['open']);
						}	
					}
				}
				
				for($i=10;$i>=0;$i--) {
					
					if($i==0) {
					
						if ($aa['sl']>0 && $api['stoploss'] != -1 && $sym['bid']<=$aa['sl']) {
							close_order($sid,$aa['sl'],"SL",100);
							break;					
						}
						
					} else {
						
						if ($sym['bid']>=$signal['tp'.$i] && ($aa['tp']==0 || $aa['tp']<$signal['tp'.$i]) && $signal['tp'.$i]>0 && $api['tp'.$i]>0) {
							close_order($sid,$signal['tp'.$i],"TP ".$i,$api['tp'.$i]);
							break;
						}				
							
					}	
						
				}
				

			}
			
		

		} else if ( $signal['trend'] == "SHORT" ) {
			
			if($aa['close']>0 && $aa['volume']<=$aa['closed_volume']) {
				#echo("cmd_user_signal(".$signal_id.") ".$api['user_id']." ".$api['name']." ".$signal['symbol']." ".$signal['trend']." -> sinyal kapandığı için durduruldu $aa[close]:".$aa['close'].". 2041");					
				echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id]  ".$signal['symbol']." ".$signal['trend']." -> sinyal kapandığı için durduruldu close:".$aa['close']." \n";
				break;
			} else if ($aa['open'] == 0 && strtotime($signal['opendate'])>0 && strtotime($signal['opendate'])+$signal_cancel_seconds>time() /* && aralikta(signal.entry1,signal.entry2,$sym['bid'])*/ ) {
				create_order($sid);
			} else if ($aa['open']>0 && $aa['close']==0) {	
				
				

				$new_sl = 0;
				$new_tp = 0;
				
				if($aa['sticket']<1 && $aa['sl_wait']+$sl_tp_wait_seconds<time() && $api['stoploss'] != -1) {
					
					if($aa['sl']>0) {
						$new_sl = ($aa['sl']);
					} else if($api['stoploss']==0) {
						$new_sl = ($signal['sl']);
					} else if($api['stoploss']>0) {
						$new_sl = ($sym['bid']*((100+$api['stoploss'])/100));
					}
					
					if($new_sl>0) {
						$sl_ticket = $binance->order_send($signal['symbol'],"BUY","SL",0,$new_sl);
						if($sl_ticket['orderId']>0) {
							$my->query("update user_signals set sl='".$new_sl."',sl_wait='".time()."',sticket='".$sl_ticket['orderId']."' where id ='".$aa['id']."'");		
							$aa['sl'] = ($new_sl);
							echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] fix broken sl #$sl_ticket[orderId] new_sl:$new_sl\n";
						} else {
							

							$error_code = $sl_ticket['code'];
							$error_msg = stripslashes($sl_ticket['msg']);
							$error_msg = str_replace("'","",$error_msg);
							$error_msg = str_replace("\"","",$error_msg);
							

							
							$p_risk = $binance->position_risk();	
							$acik_poz = $p_risk[$signal['symbol']];
							
							if($acik_poz==0) {

								$close_price = $aa['sl'];
								
								$kapat_volume = $aa['volume']-$aa['closed_volume'];

								if($aa['trend']=="LONG") {
									
									$profit = (($aa['open']/$aa['sl'])*$api['lot'])-$api['lot'];
									$profit = $profit*($kapat_volume/$aa['volume']);
									
								} else if($aa['trend']=="SHORT") {
									
									$profit = (($aa['open']/$aa['sl'])*$api['lot'])-$api['lot'];
									$profit = $profit*($kapat_volume/$aa['volume']);

								}			

								$signal_str = $api_exchange." N-CLOSED ".$aa['symbol']." ".$aa['trend']." open:".$aa['open']." close:".$close_price." lot:".$kapat_volume." profit:".$profit;
								bildirim_ekle($user_id,$signal_str,0);
								echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] $signal_str\n";
								$my->query("update user_signals set close='".$close_price."',closed_volume=(closed_volume+".$kapat_volume."),closetime='".date("Y-m-d H:i:s")."' where id ='".$aa['id']."'");
														
							
							} else if($error_code == "-4130") {
								
								$open_orders = $binance->open_orders($symbol);
								
								foreach($open_orders as $op1 => $op2) {
									if($op2['symbol'] == $symbol and $op2['type'] == "STOP_MARKET") {
										$cancel_stop = $binance->order_delete($symbol,$op2['orderId']);
										echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] cancel_order(".$op2['orderId'].")  symbol:".$op2['symbol']."\n";
										#print_rr($cancel_stop);
									}
								}
								
								$my->query("update user_signals set sticket='' where id ='".$aa['id']."'");		
								
							} else {
								
								
								$sticket = -1;
								
								if(stristr($error_msg,"orders or positions are available")) {
									$sticket=$us_id;
								}
								
								$my->query("update user_signals set sticket='$sticket',sl_wait='".time()."',event='".$error_code."|".$error_msg."' where id ='".$aa['id']."'");		
								echo "fix sl error code:$error_code  err:$error_msg \n";
								echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] fix sl error code:$error_code  err:$error_msg\n";
							
							}
							
							
						}
						#echo("fix_sl_order[".$signal_id."] ");
						#print_rr($sl_ticket);
					}
				
				}
			
				if($aa['tticket']<1 && $api['sltpemir']==1) {
					
					if($api['takeprofit']==0) {
						$new_tp = ($signal['tp5']);
					} else if($api['takeprofit']==-1) {
						$new_tp = ($signal['tp1']);
					} else if($api['takeprofit']==-2) {
						$new_tp = ($signal['tp2']);
					} else if($api['takeprofit']==-3) {
						$new_tp = ($signal['tp3']);
					} else if($api['takeprofit']==-4) {
						$new_tp = ($signal['tp4']);
					} else if($api['takeprofit']==-5) {
						$new_tp = ($signal['tp5']);
					} else if($api['takeprofit']==-5) {
						$new_tp = ($signal['tp5']);
					} else if($api['takeprofit']==-6) {
						$new_tp = ($signal['tp6']);
					} else if($api['takeprofit']==-7) {
						$new_tp = ($signal['tp7']);
					} else if($api['takeprofit']==-8) {
						$new_tp = ($signal['tp8']);
					} else if($api['takeprofit']==-9) {
						$new_tp = ($signal['tp9']);
					} else if($api['takeprofit']==-10) {
						$new_tp = ($signal['tp1']);
						
					} else if($api['takeprofit']>0) {
						$new_tp = ($sym['bid']*((100-$api['takeprofit'])/100));
					}
					
					if($new_tp>0 && $aa['tp_wait']+$sl_tp_wait_seconds<time()) {
						$tp_ticket = $binance->order_send($signal['symbol'],"BUY","TP",0,$new_tp);
						if($tp_ticket['orderId']>0) {
							$my->query("update user_signals set tticket='".$tp_ticket['orderId']."',tp_wait='".time()."' where id ='".$aa['id']."'");		
							echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] fix broken tp #$tp_ticket[orderId] new_tp:$new_tp\n";
							
						} else {
							


							$error_code = $tp_ticket['code'];
							$error_msg = stripslashes($sl_ticket['msg']); 
							$error_msg = str_replace("'","",$error_msg);
							$error_msg = str_replace("\"","",$error_msg);
							
							
							
							$p_risk = $binance->position_risk();	
							$acik_poz = $p_risk[$signal['symbol']];
							
							if($acik_poz==0) {

								$close_price = $aa['sl'];
								
								$kapat_volume = $aa['volume']-$aa['closed_volume'];

								if($aa['trend']=="LONG") {
									
									$profit = (($aa['open']/$aa['sl'])*$api['lot'])-$api['lot'];
									$profit = $profit*($kapat_volume/$aa['volume']);
									
								} else if($aa['trend']=="SHORT") {
									
									$profit = (($aa['open']/$aa['sl'])*$api['lot'])-$api['lot'];
									$profit = $profit*($kapat_volume/$aa['volume']);

								}			

								$signal_str = $api_exchange." N-CLOSED ".$aa['symbol']." ".$aa['trend']." open:".$aa['open']." close:".$close_price." lot:".$kapat_volume." profit:".$profit;
								bildirim_ekle($user_id,$signal_str,0);
								echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] $signal_str\n";
								$my->query("update user_signals set close='".$close_price."',closed_volume=(closed_volume+".$kapat_volume."),closetime='".date("Y-m-d H:i:s")."' where id ='".$aa['id']."'");
														
							
							} else if($error_code == "-4130") {
								
								$open_orders = $binance->open_orders($symbol);
								
								foreach($open_orders as $op1 => $op2) {
									if($op2['symbol'] == $symbol and $op2['type'] == "TAKE_PROFIT_MARKET") {
										$cancel_stop = $binance->order_delete($symbol,$op2['orderId']);
										echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] cancel_order(".$op2['orderId'].") TAKE_PROFIT_MARKET symbol:".$op2['symbol']."\n";
										#print_rr($cancel_stop);
									}
								}
								
								$my->query("update user_signals set tticket='' where id ='".$aa['id']."'");		
								
							} else {
										
								$tticket = -1;
								
								if(stristr($error_msg,"orders or positions are available")) {
									$tticket=$us_id;
								}
								
								$my->query("update user_signals set tticket='$tticket',tp_wait='".time()."',event='".$error_code."|".$error_msg."' where id ='".$aa['id']."'");		
								#echo "fix tp error code:$error_code  err:$error_msg \n";
								echo date("Y-m-d H:i:s")." - [s:$s_id|u:$user_id|us:$us_id] fix tp error code:$error_code  err:$error_msg\n";
															
							}
							
						}
						#echo("fix_tp_order[".$signal_id."] ");
						#print_rr(($tp_ticket));
		
					}
				
				}
				
				if($api['trailstop']<0) {
		
					for($y=abs($api['trailstop']);$y<10;$y++) {
						
						$a_sl_price = 0;
						$a_sl_id = $y-abs($api['trailstop']);
						if($a_sl_id==0) {
							$new_sl=$aa['open'];
						} else {
							$new_sl=$signal['tp'.$a_sl_id];
						}
						
						if($signal['tp'.$y]>$sym['ask'] && $signal['tp'.$y]>0 && ($aa['sl']>$new_sl || $aa['sl']==0)) {
							trail_stop($sid,"TRAILSTOP ".($a_sl_id+1),$signal['tp'.$y],$new_sl);
							$aa['sl']=$new_sl;
						}
						
					}
										
				} else if($api['trailstop']>0) {
					
					$tsl = ($aa['open']*((100-$api['trailstop'])/100));
					$tsp = ($aa['open']*((100-$api['trailstep'])/100));
					
					$tsl_fark = (($aa['open']-$tsl));
					$tsp_fark = (($aa['open']-$tsp));
					$min_val = pow(10,$sym['digits']*-1);
					if($tsl_fark<$min_val) $tsl_fark=$min_val;
					if($tsp_fark<$min_val) $tsp_fark=$min_val;
					
					$new_tsl_open = ($aa['open'])-($tsl_fark)-($tsp_fark);
					$new_tsl_sl = ($aa['sl'])-($tsl_fark)-($tsp_fark);
					$new_tsl = ($sym['ask'])+($tsl_fark);
					
					if( ($aa['sl'] == 0 || $aa['sl']>$aa['open']) && $new_tsl_open>=$sym['ask'] ) {
						trail_stop($sid,"NEW TSL",$new_tsl_open,$new_tsl);
					} else if ($aa['sl']<$aa['open'] && $new_tsl_sl>=$sym['ask']) {
						trail_stop($sid,"NEW TSL 2",$new_tsl_sl,$new_tsl);
					}
					
				} 
					
				if($api['maliyetinecek']>0) {
					
					for($i=1;$i<10;$i++) {
						if ($sym['ask']<=$signal['tp'.$i] && $signal['tp'.$i]>0 && $api['maliyetinecek']==$i && ($aa['sl']>$aa['open'] || $aa['sl']==0)) {
							trail_stop($sid,"MALIYETINE CEK ".$i,$signal['tp'.$i],$aa['open']);
						}	
					}
				}
				
				for($i=10;$i>=0;$i--) {
					
					if($i==0) {
					
						if ($aa['sl']>0 && $api['stoploss'] != -1 && $api['sltpemir']==1 && $sym['ask']>=$aa['sl']) {
							close_order($sid,$aa['sl'],"SL",100);
							break;					
						}
						
					} else {
						
						if ($sym['ask']<=$signal['tp'.$i] && ($aa['tp']==0 || $aa['tp']<$signal['tp'.$i]) && $signal['tp'.$i]>0 && $api['tp'.$i]>0) {
							close_order($sid,$signal['tp'.$i],"TP ".$i,$api['tp'.$i]);
							break;
						}				
							
					}	
						
				}
				



			}
			
		}		
		
	
	
	
	
	
	
	flush();
	ob_flush();
	
	sleep(1);
}



?>