<?php
include("mysql.php");
if(php_sapi_name()==="cli")
  $cli_ok=1; 
else 
  die("Not Running from CLI");

die;
$sid=860;

$rsi = $my->query("SELECT * FROM `user_signals` WHERE signal_id='$sid' and close =0;");
while($us=$rsi->fetch_assoc()) { 

	echo "user_signal detail:\n";
	echo implode("\t",$us)."\n";

	$ticket = $us['ticket'];
	
	$symbol=$us['symbol'];
	$volume = $us['volume'];
	

	$sym1 = $my->query("SELECT * FROM `symboldata` WHERE symbol='$us[symbol]'");
	$sym=$sym1->fetch_assoc();
	$symbol = $us["symbol"];	
	$price=$sym['bid'];
	
	if($volume>0 && $ticket>0) {
		
		


	$api1 = $my->query("SELECT * FROM `apikeys` WHERE id='$us[api_id]'");
	$api=$api1->fetch_assoc();
	
	$binance = new rbinance($api['api_key'], $api['api_secret']);
	
	
	$poz = $binance->poz_risk();
	
	foreach($poz as $p => $r) {
		
	
	
	print_r($poz);
	
	die;
	
			
		
		$b_orders=array();
		
		$b_orders[]=$binance->prepare_order($symbol,"SELL","MARKET",$volume,$price,1);
			
		echo "b_orders:\n";
		print_r($b_orders);
		$orders = $binance->bulk_order_send($b_orders);
		echo "orders:\n";
		print_r($orders);
		print_r($api);

	}
	

}

?>