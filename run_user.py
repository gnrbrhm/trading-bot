#!/usr/bin/python

# This is a simple echo bot using the decorator mechanism.
# It echoes any incoming text messages.

import pymysql

import pandas as pd
import numpy as np

from binance.client import Client
from binance.enums import *
from binance.exceptions import BinanceAPIException, BinanceOrderException
import config


mysql_host = config.mysql_host
mysql_user = config.mysql_user
mysql_pass = config.mysql_pass
mysql_name = config.mysql_name


try:

    conn = pymysql.connect(db=mysql_name, user=mysql_user, passwd=mysql_pass,host=mysql_host,port=3306,autocommit=True)
   
    #conn = mysql.connector.connect(host=mysql_host,port=3306,user=mysql_user,password=mysql_pass,database=mysql_name)
    
    def new_cursor():
        cursor = conn.cursor()
       
        return cursor


    def my_query(sql):
        
        try:
            
            kes = sql.lower().split(" ")
            
            if kes[0]=="select" or kes[0]=="show":
                cursor = conn.cursor(pymysql.cursors.DictCursor)
                fetch = cursor.execute(sql)
                fetch = cursor.fetchall()
                cursor.close()
                return fetch
            elif kes[0] == "create":
                cursor = conn.cursor(pymysql.cursors.DictCursor)
                cursor.execute(sql)
             
                fetch = cursor.rowcount
                cursor.close()
                return fetch
            elif kes[0] == "insert":
                cursor = conn.cursor(pymysql.cursors.DictCursor)
                cursor.execute(sql)
             
                fetch = conn.insert_id()
                cursor.close()
                return fetch
            else:
                cursor = conn.cursor(pymysql.cursors.DictCursor)
                fetch = cursor.execute(sql)
              
                cursor.close()
                return fetch    
        except Exception as ee:
            print("mysql_query(err) = ",sql,"\nError:",ee)
            return ee
        
    
except Exception as ee:
    print("mysql connect error : ",ee)
    
import sys     
argv = sys.argv 


print("argv:",argv)

sid=0
channel=""

if len(argv)>1: sid = argv[1]
if len(argv)>2: channel = argv[2]


rsi = my_query("SELECT * FROM `user_signals` WHERE id='"+sid+"'");
us = rsi[0]

print("user_signal detail:");
print(us)


rsi1 = my_query("SELECT * FROM `signals` WHERE id='"+str(us['signal_id'])+"'");
sg = rsi1[0]

print("signal detail:")
print(sg)


api1 = my_query("SELECT * FROM `apikeys` WHERE id='"+str(us['api_id'])+"'");
api = api1[0]
print("api:",api)

user_id = api['user_id'];
s_id = sg['id'];
us_id = us['id'];

sym1 = my_query("SELECT * FROM `symboldata` WHERE symbol='"+str(us['symbol'])+"'");
us = sym1[0]


symbol = us["symbol"];

print("sym1:",sym1)

api_key=api['api_key'];
api_secret=api['api_secret'];
margin_type = api['margin']
if margin_type==0:
    margin_type="ISOLATED"
else:
    margin_type="CROSSED"
    
leverage = api['leverage']

import os 


from binance.enums import *
from binance import AsyncClient, DepthCacheManager, BinanceSocketManager, Client


binance = Client(api_key, api_secret)



exchange_info = binance.futures_exchange_info()


def binance_poz_risk():
    global binance 
    pozlar={}
    poz_risk = binance.futures_account()['positions']
    for pp in poz_risk:
        pozlar[pp['symbol']]=pp['positionAmt']
    return pozlar 


max_lots={}

max_lots[symbol] = 0;

for s2 in exchange_info['symbols']:
    for f2 in s2['filters']:
        
        if f2['filterType'] == "MARKET_LOT_SIZE":
            max_lot = f2['maxQty']
            max_lots[s2['symbol']] = max_lot 

print(max_lots)


def to_unixtime(time):
    date_format = datetime.strptime(time,"%Y-%m-%d %H:%M:%S")
    unix_time = datetime.timestamp(date_format)    
    return round(unix_time)

def to_datetime(time):
    time=int(round(float(time),0))
    rakam = datetime.utcfromtimestamp(time).strftime("%Y-%m-%d %H:%M:%S")
    return rakam

try:
    u_leverage = client.futures_change_leverage(symbol=symbol,leverage=leverage)
    print(symbol," - leverage:",u_leverage)
except Exception as ee:
    print(symbol," - leverage err:",ee)

try:
    u_margin_type = client.futures_change_margin_type(symbol=symbol,marginType=margin_type)
    print(symbol," - margin_type:",u_margin_type)
except Exception as ee:
    print(symbol," - margin_type err:",ee)


import subprocess

pid = os.getpid()

p = subprocess.run('ps aux | grep \'run_user.py\'', shell=True, check=True, capture_output=True, encoding='utf-8')

# 'p' is instance of 'CompletedProcess(args='ls -la', returncode=0)'
print(f'Command {p.args} exited with {p.returncode} code, output: \n{p.stdout}')


psx = str(p.stdout).split("\n")

for a1 in psx:
    
    try:
        
        prc = str(a1).split(" ")
        find_pid = prc[5]

        if(a1.find("run_user.py $signal_id $channel")>-1 and find_pid != pid and find_pid>0):
            print(to_datetime(round(time.time()))+" - [s:"+str(s_id)+"|u:"+str(user_id)+"|us:"+str(us_id)+"] kill old pid #"+str(find_pid)+" run_user.php "+str(sid)+" "+str(channel)+"")
            os.system("kill -9 "+str(find_pid));
    
    except:
        pass
         
    


def bildirim_ekle(user_id,msg,durum=0):
	global bildirim_gonder, my,s_id,us_id
	#return
	
	if(msg==""): return;
	msg = msg.strip()
	msg1 = msg.replace("\n"," ")
	print(to_datetime(round(time.time()))+" - [s:"+str(s_id)+"|u:"+str(user_id)+"|us:"+str(us_id)+"] bildirim = "+msg1+"\n")
	if(bildirim_gonder==1): my_query("insert into bildirimler values('','"+str(user_id)+"','"+str(msg)+"','"+str(durum)+"')");
	
    

def create_order(sid):
	global my,binance,api_exchange,max_lots,user_id,s_id,us_id
	

	rsi = my_query("SELECT * FROM `user_signals` WHERE id='"+str(sid)+"'");
	us=rsi[0]
	
	if(us['close']>0 or us['open']>0): return;

	rsi1 = my_query("SELECT * FROM `signals` WHERE id='"+us['signal_id']+"'");
	sg=rsi1[0]

	api1 = my_query("SELECT * FROM `apikeys` WHERE id='"+us['api_id']+"'");
	api=api1[0]
	user_id = api['user_id']


	sym1 = my_query("SELECT * FROM `symboldata` WHERE symbol='"+us['symbol']+"'")
	sym=sym1[0]
	symbol = us["symbol"];
	
	price = 0;
	volume=round(api['lot'],sym['vdigits'])
	sprice=round(sg['sl'],sym['digits'])
	tprice=round(sg['tp5'],sym['digits'])
    
	p_risk = binance_poz_risk()

	emir_adet = 0;
    
    for b in p_risk:
        if p_risk[b]!=0:
            emir_adet+=1
            
	
	if(p_risk[symbol]!=0):
		
		orders={}
		orders['code'] = -101;
		orders['code'] = "zaten elinizde açık $symbol pozisyonu olduğu için pozisyon açılamadı.";
		
	elif (emir_adet>=api['maxemir']):
		
		orders={}
		orders['code'] = -102;
		orders['code'] = "maksimum $api[maxemir] adet emir açmaya izin verdiğiniz için bu emir açılamadı. Şuan açık emir sayınız $emir_adet";
		
	else:
		
		max_lot = max_lots[symbol];
		
		b_orders=[]
		
		if(sg['trend']=="LONG"):
			price = sym['ask'];
			volume=round(api['lot']/price,sym['vdigits']);
			if(max_lot>0 && volume>max_lot) volume = round(max_lot,sym['vdigits']);
            trade0 = binance.futures_create_order(symbol=symbol,side=SIDE_BUY,type="MARKET",quantity=volume) 
			b_orders.append(trade0)
            
			if(api['stoploss'] == 0 and api['sltpemir']==1):
                orders_sl =client.futures_create_order(symbol=symbol,side=SIDE_SELL,type='STOP_MARKET',stopPrice=sprice,timeInForce='GTE_GTC',closePosition=True)
				b_orders.append(orders_sl)
			elif(api['stoploss']>0 and api['sltpemir']==1):
				sprice = number_format($sym['ask']*((100-$api['stoploss'])/100),$sym['digits'],".","");
                orders_sl =client.futures_create_order(symbol=symbol,side=SIDE_SELL,type='STOP_MARKET',stopPrice=sprice,timeInForce='GTE_GTC',closePosition=True)
				b_orders.append(orders_sl)
			else:
				b_orders.append({'orderId':0})
			
			if(api['takeprofit'] == 0 and api['sltpemir']==1):
				tprice = sg['tp5'];
                orders_tp =client.futures_create_order(symbol=symbol,side=SIDE_SELL,type='TAKE_PROFIT_MARKET',stopPrice=tprice,timeInForce='GTE_GTC',closePosition=True)                            
				b_orders.append(orders_tp)
                
			elif(api['takeprofit'] == -1 and api['sltpemir']==1):
				$tprice = sg['tp1'];
                orders_tp =client.futures_create_order(symbol=symbol,side=SIDE_SELL,type='TAKE_PROFIT_MARKET',stopPrice=tprice,timeInForce='GTE_GTC',closePosition=True)                            
				b_orders.append(orders_tp)
			elif(api['takeprofit'] == -2 && api['sltpemir']==1):
				$tprice = sg['tp2'];
                orders_tp =client.futures_create_order(symbol=symbol,side=SIDE_SELL,type='TAKE_PROFIT_MARKET',stopPrice=tprice,timeInForce='GTE_GTC',closePosition=True)                            
				b_orders.append(orders_tp)
			elif(api['takeprofit'] == -3 and api['sltpemir']==1):
				$tprice = sg['tp3'];
                orders_tp =client.futures_create_order(symbol=symbol,side=SIDE_SELL,type='TAKE_PROFIT_MARKET',stopPrice=tprice,timeInForce='GTE_GTC',closePosition=True)                            
				b_orders.append(orders_tp)
			elif(api['takeprofit'] == -4 && api['sltpemir']==1):
				$tprice = sg['tp4'];
                orders_tp =client.futures_create_order(symbol=symbol,side=SIDE_SELL,type='TAKE_PROFIT_MARKET',stopPrice=tprice,timeInForce='GTE_GTC',closePosition=True)                            
				b_orders.append(orders_tp)
			elif(api['takeprofit'] == -5 && api['sltpemir']==1):
				$tprice = sg['tp5'];
                orders_tp =client.futures_create_order(symbol=symbol,side=SIDE_SELL,type='TAKE_PROFIT_MARKET',stopPrice=tprice,timeInForce='GTE_GTC',closePosition=True)                            
				b_orders.append(orders_tp)
			elif(api['takeprofit']>0 && api['sltpemir']==1):
				$tprice = round($sym['ask']*((100+$api['takeprofit'])/100),sym['digits']);
                orders_tp =client.futures_create_order(symbol=symbol,side=SIDE_SELL,type='TAKE_PROFIT_MARKET',stopPrice=tprice,timeInForce='GTE_GTC',closePosition=True)                            
				b_orders.append(orders_tp)
			elif ($api['sltpemir']==1):
				$tprice = sg['tp5'];
                orders_tp =client.futures_create_order(symbol=symbol,side=SIDE_SELL,type='TAKE_PROFIT_MARKET',stopPrice=tprice,timeInForce='GTE_GTC',closePosition=True)                            
				b_orders.append(orders_tp)
			
			
		elif(sg['trend']=="SHORT"):
			price = sym['bid'];
			volume=round(api['lot']/price,sym['vdigits']);
			if(max_lot>0 && volume>max_lot) volume = round(max_lot,sym['vdigits']);
            trade0 = binance.futures_create_order(symbol=symbol,side=SIDE_SELL,type="MARKET",quantity=volume) 
			b_orders.append(trade0)
            
			if(api['stoploss'] == 0 and api['sltpemir']==1):
                orders_sl =client.futures_create_order(symbol=symbol,side=SIDE_BUY,type='STOP_MARKET',stopPrice=sprice,timeInForce='GTE_GTC',closePosition=True)
				b_orders.append(orders_sl)
			elif(api['stoploss']>0 and api['sltpemir']==1):
				sprice = number_format($sym['ask']*((100-$api['stoploss'])/100),$sym['digits'],".","");
                orders_sl =client.futures_create_order(symbol=symbol,side=SIDE_BUY,type='STOP_MARKET',stopPrice=sprice,timeInForce='GTE_GTC',closePosition=True)
				b_orders.append(orders_sl)
			else:
				b_orders.append({'orderId':0})
			
			if(api['takeprofit'] == 0 and api['sltpemir']==1):
				tprice = sg['tp5'];
                orders_tp =client.futures_create_order(symbol=symbol,side=SIDE_BUY,type='TAKE_PROFIT_MARKET',stopPrice=tprice,timeInForce='GTE_GTC',closePosition=True)                            
				b_orders.append(orders_tp)
                
			elif(api['takeprofit'] == -1 and api['sltpemir']==1):
				$tprice = sg['tp1'];
                orders_tp =client.futures_create_order(symbol=symbol,side=SIDE_BUY,type='TAKE_PROFIT_MARKET',stopPrice=tprice,timeInForce='GTE_GTC',closePosition=True)                            
				b_orders.append(orders_tp)
			elif(api['takeprofit'] == -2 && api['sltpemir']==1):
				$tprice = sg['tp2'];
                orders_tp =client.futures_create_order(symbol=symbol,side=SIDE_BUY,type='TAKE_PROFIT_MARKET',stopPrice=tprice,timeInForce='GTE_GTC',closePosition=True)                            
				b_orders.append(orders_tp)
			elif(api['takeprofit'] == -3 and api['sltpemir']==1):
				$tprice = sg['tp3'];
                orders_tp =client.futures_create_order(symbol=symbol,side=SIDE_BUY,type='TAKE_PROFIT_MARKET',stopPrice=tprice,timeInForce='GTE_GTC',closePosition=True)                            
				b_orders.append(orders_tp)
			elif(api['takeprofit'] == -4 && api['sltpemir']==1):
				$tprice = sg['tp4'];
                orders_tp =client.futures_create_order(symbol=symbol,side=SIDE_BUY,type='TAKE_PROFIT_MARKET',stopPrice=tprice,timeInForce='GTE_GTC',closePosition=True)                            
				b_orders.append(orders_tp)
			elif(api['takeprofit'] == -5 && api['sltpemir']==1):
				$tprice = sg['tp5'];
                orders_tp =client.futures_create_order(symbol=symbol,side=SIDE_BUY,type='TAKE_PROFIT_MARKET',stopPrice=tprice,timeInForce='GTE_GTC',closePosition=True)                            
				b_orders.append(orders_tp)
			elif(api['takeprofit']>0 && api['sltpemir']==1):
				$tprice = round($sym['ask']*((100+$api['takeprofit'])/100),sym['digits']);
                orders_tp =client.futures_create_order(symbol=symbol,side=SIDE_BUY,type='TAKE_PROFIT_MARKET',stopPrice=tprice,timeInForce='GTE_GTC',closePosition=True)                            
				b_orders.append(orders_tp)
			elif ($api['sltpemir']==1):
				$tprice = sg['tp5'];
                orders_tp =client.futures_create_order(symbol=symbol,side=SIDE_BUY,type='TAKE_PROFIT_MARKET',stopPrice=tprice,timeInForce='GTE_GTC',closePosition=True)                            
				b_orders.append(orders_tp)
			
			
			
	
	$order_ticket = borders[0]['orderId'];
	$order_status = borders[0]['status'];
	$sl_ticket = borders[1]['orderId'];
	$tp_ticket = borders[2]['orderId'];
	
	
	api_exchange="binance";
	
	
	
	if(len(borders)>0 and order_ticket>0):
		
		results = "#"+str(order_ticket)+" "+symbol+" "+str(volume)+" "+us['trend']+" "+str(price)+" #"+order_ticket+" "+str(price)+" "+to_datetime(round(time.time()))+" "+order_status
		#echo($api['exchange']."[u".$user_id."] [s".$us['signal_id']."] [".$api['id']."] ->".$symbol."->".$us['trend']." results : ".$results."\n");
		
		signal_str = api_exchange+" OPEN #"+str(order_ticket)+"  "+us['symbol']+" "+us['trend']+" price:"+str(price)+" sl:"+str(sprice)+" volume:"+str(volume);
		bildirim_ekle($user_id,$signal_str,0);
		
		my_query("update user_signals set open='"+str(price)+"',ticket='"+str(order_ticket)+"',sl='"+str(sprice)+"',sticket='"+str(sl_ticket)+"',tticket='"+str(tp_ticket)+"',opentime='"+str(to_datetime(round(time.time())))+"',volume='"+str(volume)+"',status=1 where id ='"+str(us['id'])+"'");
		print(to_datetime(round(time.time()))+" - [s:"+str(s_id)+"|u:"+str(user_id)+"|us:"+str(us_id)+"] "+results+"\n")

		if(sl_ticket>0):
			sltre=1
		else:

			sl_error_msg = borders[1]['msg'].replace("\\\\","\\");
			sl_error_msg = sl_error_msg.replace("'","")
			sl_error_msg = sl_error_msg.replace('"','')
			if(sl_error_msg.find("direction is existing")>-1):
				sl_ticket=-1;
			}
			
			
		}
		if(tp_ticket>0):
			
		else:

			tp_error_msg = borders[2]['msg'].replace("\\\\","\\");
			tp_error_msg = tp_error_msg.replace("'","")
			tp_error_msg = tp_error_msg.replace('"','')
			
			if(tp_error_msg.find("direction is existing")>-1):
				tp_ticket=-1;
		
			
	

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