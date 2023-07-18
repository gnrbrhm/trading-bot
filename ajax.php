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

$mysqli->query("set names utf8;");

$q = $_GET['q'];

$q1 = explode(" ",$q);
$ilk = strtolower($q1[0]);


if(strlen($q)>0) {
	

$qwe = $mysqli->query($q);

if ($ilk == "select") {
$rows = array();

while($a = $qwe->fetch_assoc()) {
	$rows[]=$a;
}

echo json_encode($rows);

} else {
	
	echo json_encode(array("response"=>"ok"));
}

}
