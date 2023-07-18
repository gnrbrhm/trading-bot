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

$gid = $_POST['group_id'];
$gname = $_POST['group_name'];
$msg_id = $_POST['msg_id'];
$msg_date = $_POST['msg_date'];
$message = $_POST['message'];


if ($msg_id>0) {
	$signal_str = "INSERT INTO `signals_raw` (`id`, `group_id`, `group_name`, `msg_id`, `msg_date`, `msg_text`, `status`) VALUES (NULL, '".trim($gid)."', '".trim($gname)."', '".trim($msg_id)."', '".trim($msg_date)."', '".trim($message)."', '0');";
	
	$a = $mysqli->query($signal_str);
	$id = $mysqli->insert_id;
	
	echo "kayit_eklendi_{$id}_".date("Y-m-d_H:i:s");

}


?>

