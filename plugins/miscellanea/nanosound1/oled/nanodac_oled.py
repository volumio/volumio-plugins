#!/usr/bin/python
from __future__ import unicode_literals

from luma.core.interface.serial import i2c
from luma.core.render import canvas
from luma.oled.device import ssd1306, ssd1325, ssd1331, sh1106
import socket
import mpd
import time
import os
import  RPi.GPIO as GPIO
import json
import urllib2
from PIL import ImageFont

time.sleep(1)
serial = i2c(port=1, address=0x3C)

#device = ssd1306(serial, rotate=0)
device = sh1106(serial, rotate=0)
client = mpd.MPDClient(use_unicode=True)
client.connect("localhost", 6600)


def make_font(name, size):
    font_path = os.path.abspath(os.path.join(
        os.path.dirname(__file__), 'fonts', name))
    return ImageFont.truetype(font_path, size)

ampon=True;

def toggleAmp(value):
    global ampon
    if(ampon==True):
	GPIO.output(27,GPIO.LOW)
	ampon=False
    elif(ampon==False):
	GPIO.output(27,GPIO.HIGH)
	ampon=True


font1 = make_font("code2000.ttf",12)
awesomefont = make_font("fontawesome-webfont.ttf",12)

webradio="\uf1be"
musicfile="\uf1c7"
headphone="\uf001"

check=0;

GPIO.setmode(GPIO.BCM)
GPIO.setwarnings(False)
GPIO.setup(27,GPIO.OUT)
GPIO.setup(16, GPIO.IN,pull_up_down=GPIO.PUD_DOWN)
GPIO.add_event_detect(16, GPIO.RISING, callback=toggleAmp, bouncetime=200)
spotConRunning = False
spotConActive = False

while(True):

   try:        	
	for x in range(-10,80):

	   	try:
        		status = json.load(urllib2.urlopen('http://localhost:4000/api/info/status'))
        		#print(status)

        		if(status["logged_in"]):
                		spotConRunning = True
        		else:
                		spotConRunning = False

        		if(status["playing"]):
                		spotConActive = True
        		else:
                		spotConActive = False

   	   	except Exception as inst:
        		print(inst)
        		spotConRunning = False
        		spotConActive = False




		currentsong = client.currentsong()
		status = client.status()
						

		if('title' in currentsong):
			title = currentsong['title']
		else:
			if('name' in currentsong):
				title = currentsong['name']
			else:
				if('file' in currentsong):
					
					title = currentsong['file'].split('/')[-1:][0]
				else:
					title = ''

		if('artist' in currentsong):
			artist = currentsong['artist']
		else:
			artist=''

		if('file' in currentsong):
			file = currentsong['file']
			if "http://" in file:
				filetype=webradio
			elif "://" in file:
				filetype=webradio
			else:
				filetype=musicfile
		else:
			filetype=''

		if('bitrate' in status):
			bitrate = status['bitrate'] + "kbps"	
		else:
			bitrate = ''

		if(bitrate == "0kbps"):
			bitrate = ''

		if('elapsed' in status):
			elapsed = time.strftime('%H:%M:%S', time.gmtime(float(status['elapsed'])))
		else:
			elapsed = ''
		volume = status['volume']
		state = status['state']
		


		if (state=="pause" or state=="stop") and spotConRunning and (not spotConActive):
				title = "Spotify Connect Ready"
				artist = socket.gethostname()
				check = 3		
				filetype = '\uf1bc'
				bitrate = ''
				elapsed = ''
                if spotConRunning and spotConActive:
				spotconmeta = json.load(urllib2.urlopen('http://localhost:4000/api/info/metadata'))
                                title = spotconmeta["track_name"]
                                artist = spotconmeta["artist_name"]
                                check = 3
                                filetype = '\uf1bc'
                                bitrate = ''
				elapsed = ''


		with canvas(device) as draw:
			draw.rectangle(device.bounding_box, outline="white", fill="black")
			draw.text((x, 2), title,font=font1, fill="white")
			w3, h3 = draw.textsize(text="\uf177", font=awesomefont)			
			w, h = draw.textsize(text=artist,font=font1)
			w2,h2 = draw.textsize(text=bitrate)
			left = (device.width - w) / 2
			left2 = (device.width - w2) / 2
			draw.text((left, 18), artist,font=font1, fill="white")
			draw.text((10,36), filetype, font=awesomefont,fill="white")
			if(ampon):
				draw.text((device.width - 20,36), headphone, font=awesomefont,fill="white")
			else:
				draw.text((device.width - 20,36), " ", font=awesomefont,fill="white")
			draw.text((left2, 36), bitrate, fill="white")
			draw.text((10, 50), elapsed, fill="white")
			draw.text((87, 50), text="\uf028", font=awesomefont,fill="white")
			draw.text((100, 50), volume, fill="white")
   finally:		
		time.sleep(0.1)	

