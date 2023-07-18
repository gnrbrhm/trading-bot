<?php 

ob_start();
ob_implicit_flush(true);
error_reporting(E_ALL & ~E_NOTICE);

ini_set("display_errors","On");
ini_set("implicit_flush","On");

include("binance.rest.php");

$p_name="hknvip3";


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
$my = new mysqli($mysql_host, $mysql_user, $mysql_pass, $mysql_name);

$my->query("set names utf8;");

?>