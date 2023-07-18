<?php 

$config = file_get_contents("config.py");

preg_match("/mysql_host = \"(.*?)\"/i",$config,$m1);
preg_match("/mysql_user = \"(.*?)\"/i",$config,$m2);
preg_match("/mysql_pass = \"(.*?)\"/i",$config,$m3);
preg_match("/mysql_name = \"(.*?)\"/i",$config,$m4);

$mysql_host = $m1[1];
$mysql_user = $m2[1];
$mysql_pass = $m3[1];
$mysql_name = $m4[1];


mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
$mysqli = new mysqli($mysql_host, $mysql_user, $mysql_pass, $mysql_name);

$q = $mysqli->query("set names utf8;");
$q = $mysqli->query("truncate table apikeys;");



$tablolar = $mysqli->query("select * from apikeys1 where 1;");

while($ae = $tablolar->fetch_assoc()) {
	
	$asql = "INSERT INTO `apikeys` (`id`, `user_id`, `name`, `exchange`, `api_key`, `api_secret`, 
	`api_password`, `lot`, `leverage`, `margin`, `tp1`, `tp2`, `tp3`, `tp4`, `tp5`, `tp6`, `tp7`, 
	`tp8`, `tp9`, `tp10`, `stoploss`, `takeprofit`, `trailstop`, `trailstep`, `sltpemir`, 
	`maliyetinecek`, `maxemir`, `abonelik`, `durum`) VALUES (NULL, '$ae[user_id]', '$ae[name]', '$ae[exchange]', '$ae[api_key]', '$ae[api_secret]', '', 
	'$ae[maxmargin]', '$ae[leverage]', '0', '', '', '', '', '100', '', '', '', '', '', '', '', '', '', '', '', '3', '1', '0');";
	
	print_r($ae);
	
	$mysqli->query($asql);
	
}




?>