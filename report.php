<?php 



$config = file_get_contents("config.py");

$key = "2023";
$p_name="longvip";

if($_POST['anahtar']!="") $anahtar = $_POST['anahtar'];
if($_GET['anahtar']!="") $anahtar = $_GET['anahtar'];



if($_GET['restart']=="bot" && $anahtar == $key) {
	echo "<pre>";
	echo "eski processler durduruluyor\n";
	
	$out = shell_exec("sudo rm -rf *.txt");
	print($out);
	
	$sonuc1 = shell_exec("sudo /usr/bin/pkill -f $p_name");
	echo $sonuc1."\n";
	echo "restart yapılıyor\n";
	$sonuc2 = shell_exec("sudo /bin/sh run.sh");
	echo $sonuc2;
	echo "yeniden başlatıldı\n";
	echo "</pre>";
	die();
	
}

if($_GET['run']>0 && $anahtar == $key) {
	echo "<pre>";
	echo "php run_user.php ".$_GET['run']," 1 timepass\n";
	$sonuc1 = shell_exec("php run_user.php ".$_GET['run']," 1 timepass");
	echo $sonuc1;
	echo "</pre>";
	die();
	
}

preg_match("/mysql_host = \"(.*?)\"/i",$config,$m1);
preg_match("/mysql_user = \"(.*?)\"/i",$config,$m2);
preg_match("/mysql_pass = \"(.*?)\"/i",$config,$m3);
preg_match("/mysql_name = \"(.*?)\"/i",$config,$m4);
preg_match("/kanal_tam_adi = \"(.*?)\"/i",$config,$m5);

$mysql_host = $m1[1];
$mysql_user = $m2[1];
$mysql_pass = $m3[1];
$mysql_name = $m4[1];
$kanal_adi = $m5[1];


mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
$mysqli = new mysqli($mysql_host, $mysql_user, $mysql_pass, $mysql_name);

$q = $mysqli->query("set names utf8;");

extract($_POST);

?><h1><a href="report.php" target="_blank"><?=$kanal_adi;?> Üye Raporları</a></h1>

<style>

* { font-family:Tahoma; }
a { color:red; }
table, th, td {
  font-size:10pt;
  border: 1px solid black;
  border-collapse: collapse;
  padding:2px;
}
</style>

<form method="post" action="report.php">
<input type="hidden" name="act" value="sorgula">
<table border=1 width=100% margin=0 padding=0>
<tr>
<td>
Kullanıcı adı, isim veya Telegram ID <input type="text" name="u_id" value="<?=$u_id;?>"></td><td>  Anahtar <input type="password" name="anahtar" value="<?=$anahtar;?>"></td><td> <input type="submit" value="Gönder"></td></tr></table>
</form>
 
<pre>
<?php

	
if($_POST['act']=="sorgula" && $key == $anahtar) {
	
	// echo "select * from users where user_id = '$u_id' or username='$u_id'\n";
	$q1 = $mysqli->query("select * from users where user_id like '%$u_id%' or username like '%$u_id%' or first_name like '%$u_id%' or last_name like '%$u_id%'");
	
?>


<h3 align="center"><a href="report.php?restart=bot&anahtar=<?=$anahtar?>" target="_blank">Restart Bot</a></h3>

<h3>Lütfen Üyeyi seçiniz</h3>
<table border=1 width="100%" margin=0 padding=0>
<tr><td>ID</td><td>Telegram ID</td><td>Kullanıcı Adı</td><td>İsim</td><td>Soyisim</td><td>Kayıt Tarihi</td><td>Son İşlem</td><td>Abonelik Tarihi</td></tr>
<?php
	while($uye = $q1->fetch_assoc()) {
	
	
	?>
	<tr><td><?=$uye['id']?></td><td><a href="report.php?userid=<?=$uye['user_id']?>&anahtar=<?=$anahtar;?>"><?=$uye['user_id']?></a></td><td><?=$uye['username']?></td><td><?=$uye['first_name']?></td><td><?=$uye['last_name']?></td><td><?=date("Y-m-d H:i:s",$uye['tarih'])?></td><td><?=date("Y-m-d H:i:s",$uye['sonislem'])?></td><td><?=date("Y-m-d H:i:s",$uye['abonelik'])?></td></tr>
	<?
	
	}
?>
</table>
<?php
	
	
}


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


if($_GET['userid']!="" && $key == $_GET['anahtar']) {
	
	$u_id = $_GET['userid'];
	

	// echo "select * from users where user_id = '$u_id' or username='$u_id'\n";
	$q1 = $mysqli->query("select * from users where user_id = '$u_id'");
	
?>
<h3>Üye Bilgileri</h3>
<table border=1 width="100%" margin=0 padding=0>
<tr><td>ID</td><td>Telegram ID</td><td>Kullanıcı Adı</td><td>İsim</td><td>Soyisim</td><td>Kayıt Tarihi</td><td>Son İşlem</td><td>Abonelik Tarihi</td></tr>
<?php
	while($uye = $q1->fetch_assoc()) {
	
	
	?>
	<tr><td><?=$uye['id']?></td><td><a href="report.php?u_id=<?=$uye['user_id']?>&anahtar=<?=$anahtar;?>"><?=$uye['user_id']?></a></td><td><?=$uye['username']?></td><td><?=$uye['first_name']?></td><td><?=$uye['last_name']?></td><td><?=date("Y-m-d H:i:s",$uye['tarih'])?></td><td><?=date("Y-m-d H:i:s",$uye['sonislem'])?></td><td><?=date("Y-m-d H:i:s",$uye['abonelik'])?></td></tr>
	<?
	
	}

?>
</table>
<?	
	
	$q1 = $mysqli->query("select * from apikeys where user_id = '$u_id'");
	
?>
<h3>Api Anahtarları</h3>
<table border=1 width="100%" margin=0 padding=0>
<tr><td>ID</td><td>User ID</td><td>Api Adı</td><td>Api key</td><td>Lot</td><td>Kaldıraç</td><td>Tp1</td><td>TP2</td><td>TP3</td><td>TP4</td><td>TP5</td><td>TP6</td><td>TP7</td><td>TP8</td><td>TP9</td><td>TP10</td><td>Stoploss</td><td>TakeProfit</td><td>SL_TP_Emir</td><td>Trailstop</td><td>TrailStep</td><td>Maliyetine Çek</td><td>Max Emir</td><td>Durum</td></tr>
<?php
	
	function print_row($ce) {
		
		$yaz="";
		
		foreach($ce as $a => $b) {
			$yaz.="<b>$a</b>=$b , ";
		}
		
		return $yaz;
	}

	require '../vendor/autoload.php';

	while($uye = $q1->fetch_assoc()) {
	
	
	?>
	<tr><td><?=$uye['id']?></a></td><td><?=$uye['user_id']?></td><td><?=$uye['name']?></td><td><?=substr($uye['api_key'],0,5)?>...</td><td><?=$uye['lot']?></td><td><?=$uye['leverage']?></td><td><?=$uye['tp1']?></td><td><?=$uye['tp2']?></td><td><?=$uye['tp3']?></td><td><?=$uye['tp4']?></td><td><?=$uye['tp5']?></td><td><?=$uye['tp6']?></td><td><?=$uye['tp7']?></td><td><?=$uye['tp8']?></td><td><?=$uye['tp9']?></td><td><?=$uye['tp10']?></td><td><?
	
	if($uye['stoploss']==-1) {
		echo "SL YOK";
	} else if($uye['stoploss']==0) {
		echo "SINYAL_SL";
	} else {
		echo "%".number_format($uye['stoploss'],2,".","");
	}
		
	?></td><td><?
	
	if($uye['takeprofit']==-1) {
		echo "TP1";
	} else if($uye['takeprofit']==-2) {
		echo "TP2";
	} else if($uye['takeprofit']==-3) {
		echo "TP3";
	} else if($uye['takeprofit']==-4) {
		echo "TP4";
	} else if($uye['takeprofit']==-5) {
		echo "TP5";
	} else if($uye['takeprofit']==-6) {
		echo "TP6";
	} else if($uye['takeprofit']==-7) {
		echo "TP7";
	} else if($uye['takeprofit']==-8) {
		echo "TP8";
	} else if($uye['takeprofit']==-9) {
		echo "TP9";
	} else if($uye['takeprofit']==-10) {
		echo "TP10";
	} else {
		echo "SINYAL_TP";
	}
		
	?></td><td><?
	
	if($uye['sltpemir']==1) {
		echo "Kullan";
	} else {
		echo "Kullanma";
	}
		
	?></td><td><?
	
	if($uye['trailstop']==-1) {
		echo "TP1";
	} else if($uye['trailstop']==-2) {
		echo "TP2";
	} else if($uye['trailstop']==-3) {
		echo "TP3";
	} else if($uye['trailstop']==-4) {
		echo "TP4";
	} else if($uye['trailstop']==-5) {
		echo "TP5";
	} else if($uye['trailstop']==-6) {
		echo "TP6";
	} else if($uye['trailstop']==-7) {
		echo "TP7";
	} else if($uye['trailstop']==-8) {
		echo "TP8";
	} else if($uye['trailstop']==-9) {
		echo "TP9";
	} else if($uye['trailstop']==-10) {
		echo "TP10";
	} else {
		echo "KAPALI";
	}
		
	?></td><td><?=$uye['trailstep']?></td><td><?
	
	if($uye['maliyetinecek']==1) {
		echo "TP1";
	} else if($uye['maliyetinecek']==2) {
		echo "TP2";
	} else if($uye['maliyetinecek']==3) {
		echo "TP3";
	} else if($uye['maliyetinecek']==4) {
		echo "TP4";
	} else if($uye['maliyetinecek']==5) {
		echo "TP5";
	} else {
		echo "Hayır";
	}
		
	?></td><td><?=$uye['maxemir']?></td><td><?
	
	if($uye['durum']==1) {
		echo "Aktif";
	} else {
		echo "Pasif";
	}
		
	?></td></tr>
	<tr><td colspan="24" style="padding-left:50px;">
	<b><u>Cüzdan Durumu</u></b><br>
	<?
	
	try {
	
	$api = new Binance\API($uye['api_key'],$uye['api_secret']);	
	$api->caOverride = true;
	
	$balances = $api->balances();
		
	foreach($balances as $b1 => $c1) {
		if ($c1['available']>0 or  $c1['onOrder']>0) {
			echo "$b1 : bulunan : ".$c1['available']." işlemde : ".$c1['onOrder']."<br>\n";
		}
	}
	
	
	?>
	<br>
	<b><u>apiTradingStatus</u></b><br><?
		
	$accountStatus = $api->apiTradingStatus();
	print_rr($accountStatus);
	echo "<br>\n";
	
	
	?>
	<br>
	<b><u>apiRestrictions</u></b><br><?
		
	$accountStatus = $api->apiRestrictions();
	print_rr($accountStatus);
	echo "<br>\n";
	
	?>
	<br>
	<b><u>accountStatus</u></b><br><?
		
	$accountStatus = $api->accountStatus();
	print_rr($accountStatus);
	echo "<br>\n";
	
	?>
	<br>
	<b><u>Açık İşlemler</u></b><br><?
		
	$balances = $api->position_risk();
	// print_r($balances)
	
	foreach($balances as $b1 => $c1) {
		if ($c1['positionAmt']!=0) {
			$c2 = array("symbol"=>$c1['symbol'],"lot"=>$c1['positionAmt'],"açılış fiyatı"=>$c1['entryPrice'],"kar"=>$c1['unRealizedProfit'],"acilis tarihi"=>date("Y-m-d H:i:s",round($c1['updateTime']/1000)));
			echo substr(print_row($c2),0,-1)."<br>\n";
			//echo "$c1[symbol]  positionAmt:".$c1['']." price:".$c1['entryPrice']." date:".$c1['updateTime']."<br>\n";
		}
	}
	
	} catch(Exception $err) {
		
		echo "binance api error : ";
		print_r($err);
		
	}
	
	?></td></tr>
	<?
	
	}
?>
</table>
<?php
	

	$q1 = $mysqli->query("SELECT * FROM `user_signals` where user_id = '$u_id' order by id desc LIMIT 50");
	
?>
<h3>Son 50 İşlem</h3>
<table border=1 width="100%" margin=0 padding=0>
<tr><td>ID</td><td>User ID</td><td>api_id</td><td>signal_id</td><td>strateji</td><td>Ticket</td><td>Symbol</td><td>Trend</td><td>Açılış</td><td>Açılış Tarihi</td><td>Lot</td><td>Kapanan Lot</td><td>SL</td><td>Kapanış</td><td>Kapanış Tarihi</td><td>Kar</td><td>Event</td><td>SL Ticket</td><td>Status</td></tr>
<?php
	while($uye = $q1->fetch_assoc()) {
	
	
	?>
	<tr><td><a href="report.php?run=<?=$uye['id']?>&anahtar=<?=$anahtar?>" target="_blank"><?=$uye['id']?></a></td><td><?=$uye['user_id']?></td><td><?=$uye['api_id']?></td><td><?=$uye['signal_id']?></td><td><?=$uye['strateji']?></td><td><?=$uye['ticket']?></td><td><?=$uye['symbol']?></td><td><?=$uye['trend']?></td><td><?=$uye['open']?></td><td><?=$uye['opentime']?></td><td><?=$uye['volume']?></td><td><?=$uye['closed_volume']?></td><td><?=$uye['sl']?></td><td><?=$uye['close']?></td><td><?=$uye['closetime']?></td><td><?=$uye['profit']?></td><td><?=$uye['event']?></td><td><?=$uye['sticket']?></td><td><?=$uye['status']?></td></tr>
	<?
	
	}
?>
</table>
<?php
	

$q1 = $mysqli->query("SELECT * FROM `bildirimler` where user_id = '$u_id' order by id desc LIMIT 20");
	
?>
<h3>Son 20 Bildirim</h3>
<table border=1 width="100%" margin=0 padding=0>
<tr><td>ID</td><td>User ID</td><td>Msg</td><td>Tarih</td></tr>
<?php
	while($uye = $q1->fetch_assoc()) {
	
	
	?>
	<tr><td><?=$uye['id']?></td><td><?=$uye['user_id']?></td><td><?=$uye['msg']?></td><td><?=date("Y-m-d H:i:s",$uye['gonderim'])?></td></tr>
	<?
	
	}
?>
</table>
<?php


$log_file = "";
foreach(glob("./trade_bot_*.txt") as $ag => $gb) {
	if(!stristr($gb,"bot_log")) {
		$log_file=$gb;
	}
}

$q1 = file_get_contents($log_file);
$lines = explode("\n",$q1);
echo "Total Lines:".count($lines);
?>
<h3>Raw Logs</h3>
<table border=1 width="100%" margin=0 padding=0>
<tr><td>Line</td><td>str</td></tr>
<?php
	foreach($lines as $a => $b) {
	
	if(stristr($b,$u_id)) {
		
		
	if(stristr($b,"BINANCE[u")) {
		
		$bb = array();
		
		for($y=0;$y<300;$y++) {
			if($a-$y<0) break;
			$uline = $lines[$a-$y];
			$bb[]=$uline;
			if(stristr($uline,"orders: [")) break;
			if($y>0 && stristr($uline,"bildirim(") or stristr($uline,"BINANCE[") or stristr($uline,"bildirim_ch(") or stristr($uline,"cmd_user_signal(")) { unset($bb[$y]); break; }
		}
		
		$bz = "";
		for($t=count($bb);$t>=0;$t--) {
			$bz.=$bb[$t]."\n";
		}
		$b = "<pre>".$bz."</pre>";
		
	} else if(stristr($b,"bildirim(") && stristr($b,"UPDATE")) {
		
		$bb = array();
		
		for($y=0;$y<300;$y++) {
			if($a-$y<0) break;
			$uline = $lines[$a-$y];
			$bb[]=$uline;
			if(stristr($uline,"send_json:")) break;
			if($y>0 && stristr($uline,"bildirim(") or stristr($uline,"BINANCE[") or stristr($uline,"bildirim_ch(") or stristr($uline,"cmd_user_signal(")) { unset($bb[$y]); break; }
		}
		
		$bz = "";
		for($t=count($bb);$t>=0;$t--) {
			$bz.=$bb[$t]."\n";
		}
		$b = "<pre>".$bz."</pre>";
		
	} else if(stristr($b,"bildirim(") && stristr($b,"CLOSE")) {
		
		$bb = array();
		
		for($y=0;$y<300;$y++) {
			if($a-$y<0) break;
			$uline = $lines[$a-$y];
			$bb[]=$uline;
			if(stristr($uline,"close order ticket:")) break;
			if($y>0 && stristr($uline,"bildirim(") or stristr($uline,"BINANCE[") or stristr($uline,"bildirim_ch(") or stristr($uline,"cmd_user_signal(")) { unset($bb[$y]); break; }
		}
		
		
		$bz = "";
		for($t=count($bb);$t>=0;$t--) {
			$bz.=$bb[$t]."\n";
		}
		$b = "<pre>".$bz."</pre>";
		
	}
		
	?>
	<tr><td><?=$a?></td><td><?=$b?></td></tr>
	<?
	}
	
	}
?>
</table>
<?php
	
}


?>
</pre>