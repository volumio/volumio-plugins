#!/usr/bin/env python

import time
from PIL import ImageFont, Image, ImageDraw, ImageStat
import os
import os.path
import ST7789 as ST7789
from socketIO_client import SocketIO
import requests
from io import BytesIO
from numpy import mean
import sys
import signal
import RPi.GPIO as GPIO
import math
import json
# import logging
# logging.getLogger('socketIO-client').setLevel(logging.DEBUG)
# logging.basicConfig()


# get the path of the script
script_path = os.path.dirname(os.path.abspath(__file__))
# set script path as current directory
os.chdir(script_path)

socketIO = SocketIO('localhost', 3000)

# Create ST7789 LCD display class.
disp = ST7789.ST7789(
    rotation=90,  # Needed to display the right way up on Pirate Audio
    port=0,       # SPI port
    cs=1,         # SPI port Chip-select channel
    dc=9,         # BCM pin used for data/command
    backlight=13,
    spi_speed_hz=80 * 1000 * 1000
)


# read json file
with open('/data/configuration/miscellanea/pirateaudio/config.json', 'r') as myfile:
    data=myfile.read()

# parse file
obj = json.loads(data)
print('listmax:', int(obj['listmax']['value']))

WIDTH = 240
HEIGHT = 240
font_s = ImageFont.truetype(script_path + '/fonts/Roboto-Medium.ttf', 20)
font_m = ImageFont.truetype(script_path + '/fonts/Roboto-Medium.ttf', 24)
font_l = ImageFont.truetype(script_path + '/fonts/Roboto-Medium.ttf', 30)
font_fas = ImageFont.truetype(script_path + '/fonts/FontAwesome5-Free-Solid.otf', 28)
bg_default = Image.open('images/default.jpg').resize((240, 240))  # default background image

albumart = ''
artist, album, title, img_check = '', '', '', ''
mode = 'player'
nav_array_name = []
nav_array_uri = []
nav_array_type = []
marker = 0
# listmax = 5
listmax = int(obj['listmax']['value'])  # get the value from config.json
liststart = 0
listresult = 0


BUTTONS = [5, 6, 16, 20]
LABELS = ['A', 'B', 'X', 'Y']
GPIO.setmode(GPIO.BCM)  # Set up RPi.GPIO with the "BCM" numbering scheme


def on_connect():
    print('connect')
    socketIO.on('pushState', on_push_state)
    socketIO.emit('getState', '', on_push_state)
    socketIO.on('pushBrowseSources', on_push_browsesources)
    socketIO.on('pushBrowseLibrary', on_push_browselibrary)


def on_disconnect():
    print('disconnect')
    display_stuff('bg_default', 'Verbindung verloren', 0, 0)


def navigation_handler(action):
    global mode, nav_array_name, nav_array_uri, nav_array_type, marker, liststart, listresult
    if mode == 'player':
        mode = 'menu'
        nav_array_name = ['Musikauswahl', 'Herunterfahren ?', 'Neustart Pi?']
        nav_array_uri = ['', 'sudo shutdown -h now', 'sudo shutdown -r now']
        nav_array_type = ['', 'os', 'os']
        listresult = 3
        display_stuff('bg_default', nav_array_name, marker, liststart)
    else:
        print('else navigation_handler() eingetreten')


def on_push_browsesources(*args):
    global mode, nav_array_name, nav_array_uri, nav_array_type, marker, listresult
    result = len(args[0])
    listresult = result
    i = 0
    while i < result:
        listitem_name = args[0][i]['name']
        listitem_uri = args[0][i]['uri']
        nav_array_name.append(listitem_name)
        nav_array_uri.append(listitem_uri)
        i += 1
    display_stuff('bg_default', nav_array_name, marker, 0)


def on_push_browselibrary(*args):
    global mode, nav_array_name, nav_array_uri, nav_array_type, marker, listmax, liststart, listresult
    reset_variable('navigation')
    head = len(args[0]['navigation'])
    result = len(args[0]['navigation']['lists'][0]['items'])
    listresult = result
    i = 0
    createlines = False

    # check header
    if head == 1:  # playlists / Wiedergabelisten
        if len(args[0]['navigation']['lists'][0]['items']) == 0:
            display_stuff('bg_default', 'leer', marker, liststart)
        else:
            createlines = True
    elif head == 2:
        if result == 1 and args[0]['navigation']['lists'][0]['items'][0]['type'] == 'song':  # plays songs and podcasts
            socketIO.emit('replaceAndPlay', {"service": args[0]['navigation']['lists'][0]['items'][0]['service'], "uri": args[0]['navigation']['lists'][0]['items'][0]['uri']})  # wrong, only play mpd and songs
            reset_variable('player')
        else:
            createlines = True
    elif head == 3:
        if 'name' in args[0]['navigation']['info']:
            if args[0]['navigation']['info']['name'] == 'favourites':  # favourites / Favoriten
                createlines = True
            else:  # playlist / Wiedergabeliste
                socketIO.emit('playPlaylist', {'name': args[0]['navigation']['info']['title']})
                reset_variable('player')
        else:
            createlines = True
    else:
        print('head <> 3', head)

    # create lines to display
    if result > 0 and createlines is True:  # we have item entries
        while i < result:
            listitem_name = args[0]['navigation']['lists'][0]['items'][i]['title']
            listitem_uri = args[0]['navigation']['lists'][0]['items'][i]['uri']
            listitem_type = args[0]['navigation']['lists'][0]['items'][i]['type']
            nav_array_name.append(listitem_name)
            nav_array_uri.append(listitem_uri)
            nav_array_type.append(listitem_type)
            i += 1

        display_stuff('bg_default', nav_array_name, marker, liststart)
    elif result == 0:  # we have no item entries
        display_stuff('bg_default', 'leer', marker, liststart)


def reset_variable(varmode):
    global mode, nav_array_name, nav_array_uri, nav_array_type, marker, liststart, img_check, albumart
    mode = varmode
    nav_array_name, nav_array_uri, nav_array_type, marker, liststart = [], [], [], 0, 0
    img_check, albumart = '', ''  # reset albumart so display gets refreshed


def display_stuff(picture, text, marked, start):
    global img3, mode, nav_array_name, nav_array_uri, marker, listmax, liststart
    marker = marked
    liststart = start
    i = 0
    img3 = Image.new('RGBA', (240, 240), color=(0, 0, 0, 25))  # get img from global defination
    if picture == 'bg_default':
        img3 = bg_default.copy()
    else:
        img3 = Image.open(picture)
    draw3 = ImageDraw.Draw(img3, 'RGBA')
    # y = 15
    result = len(text)
    if isinstance(text, list):  # check if text is array
        # Loop for finding out the sum of textheight for positioning
        totaltextheight = 0
        for arrayitem in text:
            if i >= liststart and i <= (liststart + listmax - 1):
                len1, hei1 = draw3.textsize(arrayitem, font=font_m)
                totaltextheight = totaltextheight + hei1
            i += 1
        i = 0
        y = (HEIGHT // 2) - (totaltextheight // 2)

        # Loop for creating text to display
        for arrayitem in text:
            if i >= liststart and i <= (liststart + listmax - 1):
                len1, hei1 = draw3.textsize(arrayitem, font=font_m)
                x2 = (WIDTH - len1)//2
                if i == marked:
                    draw3.text((x2, y), arrayitem, font=font_m, fill=(255, 0, 0))
                else:
                    draw3.text((x2, y), arrayitem, font=font_m, fill=(255, 255, 255))
                y = y + hei1
            i += 1
    else:
        len1, hei1 = draw3.textsize(text, font=font_m)
        x2 = (WIDTH - len1)//2
        y2 = (HEIGHT - hei1)//2
        draw3.text((x2, y2), text, font=font_m, fill=(255, 0, 0))
    draw3.text((0, 50), u"\uf14a", font=font_fas, fill=(255, 255, 255))  # Fontawesome symbols ok
    draw3.text((210, 50), u"\uf151", font=font_fas, fill=(255, 255, 255))  # Fontawesome symbols up
    draw3.text((0, 170), u"\uf0e2", font=font_fas, fill=(255, 255, 255))  # Fontawesome symbols back
    draw3.text((210, 170), u"\uf150", font=font_fas, fill=(255, 255, 255))  # Fontawesome symbols down
    disp.display(img3)
    time.sleep(0.2)


def on_push_state(*args):
    global img, img2, dark, txt_col, bar_bgcol, bar_col, status, service, albumart, img_check, mode
    if mode == 'player':
        status = args[0]['status'].encode('ascii', 'ignore')
        service = args[0]['service'].encode('ascii', 'ignore')

        if args[0]['albumart'].encode('ascii', 'ignore') != albumart:  # Load albumcover or radio cover (and only if changes)
            albumart = args[0]['albumart'].encode('ascii', 'ignore')

            albumart2 = albumart
            if len(albumart2) == 0:  # to catch a empty field on start
                albumart2 = 'http://localhost:3000/albumart'
            if 'http' not in albumart2:
                albumart2 = 'http://localhost:3000'+args[0]['albumart']

            response = requests.get(albumart2)
            img = Image.open(BytesIO(response.content))
            img = img.resize((WIDTH, HEIGHT))
            draw = ImageDraw.Draw(img, 'RGBA')
            img2 = img.copy()

            # Light / Dark Symbols and bars, depending on background
            im_stat = ImageStat.Stat(img)
            im_mean = im_stat.mean
            mn = mean(im_mean)

            txt_col = (255, 255, 255)
            bar_bgcol = (200, 200, 200)
            bar_col = (255, 255, 255)
            dark = False
            if mn > 175:
                txt_col = (55, 55, 55)
                dark = True
                bar_bgcol = (255, 255, 255)
                bar_col = (100, 100, 100)
            if mn < 80:
                txt_col = (200, 200, 200)
        else:  # if albumart didnt change, copy the last unpasted version
            img = img2.copy()
            draw = ImageDraw.Draw(img, 'RGBA')

        # paste button symbol overlay in light/dark mode
        if status == 'play':
            draw.text((4, 53), u"\uf04C", font=font_fas, fill=txt_col)  # Fontawesome symbol pause
        else:
            draw.text((4, 53), u"\uf04b", font=font_fas, fill=txt_col)  # Fontawesome symbol play
        draw.text((210, 53), u"\uf0c9", font=font_fas, fill=txt_col)  # Fontawesome symbol menu
        draw.text((210, 174), u"\uf028", font=font_fas, fill=txt_col)  # Fontawesome symbol speaker

        top = 7
        if 'artist' in args[0]:
            x1 = 20
            w1, y1 = draw.textsize(args[0]['artist'], font_m)
            x1 = x1-20
            if x1 < (WIDTH - w1 - 20):
                x1 = 0
            if w1 <= WIDTH:
                x1 = (WIDTH - w1)//2
            draw.text((x1, top), args[0]['artist'], font=font_m, fill=txt_col)

        top = 35
        if 'album' in args[0]:
            if args[0]['album'] is not None:
                x2 = 20
                w2, y2 = draw.textsize(args[0]['album'], font_s)
                x2 = x2-20
                if x2 < (WIDTH - w2 - 20):
                    x2 = 0
                if w2 <= WIDTH:
                    x2 = (WIDTH - w2)//2
                draw.text((x2, top), args[0]['album'], font=font_s, fill=txt_col)

        if 'title' in args[0]:
            x3 = 20
            w3, y3 = draw.textsize(args[0]['title'], font_l)
            x3 = x3-20
            if x3 < (WIDTH - w3 - 20):
                x3 = 0
            if w3 <= WIDTH:
                x3 = (WIDTH - w3)//2
            draw.text((x3, 105), args[0]['title'], font=font_l, fill=txt_col)  # fill by mean

        # volume bar
        vol_x = int((float(args[0]['volume'])/100)*(WIDTH - 33))
        draw.rectangle((5, 184, WIDTH-34, 184+8), bar_bgcol)  # background
        draw.rectangle((5, 184, vol_x, 184+8), bar_col)

        # time bar
        if 'duration' in args[0]:
            duration = args[0]['duration']  # seconds
            if duration != 0:
                if 'seek' in args[0]:
                    seek = args[0]['seek']  # time elapsed seconds
                    if seek != 0:
                        el_time = int(float(args[0]['seek'])/1000)
                        du_time = int(float(args[0]['duration']))
                        dur_x = int((float(el_time)/float(du_time))*(WIDTH-10))
                        draw.rectangle((5, 222, WIDTH-5, 222 + 12), bar_bgcol)  # background
                        draw.rectangle((5, 222, dur_x, 222 + 12), bar_col)

        # do disp. only if img changed
        if img_check != img:
            img_check = img
            disp.display(img)
            time.sleep(0.2)
        else:
            print('img gleich, daher nicht neu gezeichnet')
    else:
        print('verlasse Funktion on_push_state, da mode != player', mode)


img = Image.new('RGBA', (240, 240), color=(0, 0, 0, 25))
draw = ImageDraw.Draw(img, 'RGBA')
socketIO.once('connect', on_connect)
socketIO.on('disconnect', on_disconnect)


def handle_button(pin):
    label = LABELS[BUTTONS.index(pin)]
    global mode, nav_array_name, nav_array_uri, marker, liststart, listresult
    if pin == 5:  # Button A
        if mode == 'player':
            if (status == 'play') and (service == 'webradio'):
                socketIO.emit('stop')
            elif (status == 'play'):
                socketIO.emit('pause')
            else:
                socketIO.emit('play')
        elif mode == 'navigation':
            if len(nav_array_uri) != 0:
                if 'http' in nav_array_uri[marker]:  # catch webradio
                    socketIO.emit('replaceAndPlay', {"service": "webradio", "type": "webradio", "title": nav_array_name[marker], "uri": nav_array_uri[marker]})
                    reset_variable('player')
                else:
                    # replace "mnt/" in uri through "music-library/", otherwise calling them dont work (at least in favourites)
                    uri = nav_array_uri[marker]
                    uri = uri.replace('mnt/', 'music-library/')
                    socketIO.emit('browseLibrary', {'uri': uri})
            else:
                reset_variable('player')
                socketIO.emit('getState', '', on_push_state)
        elif mode == 'menu':
            if nav_array_type[marker] == 'os':
                command = nav_array_uri[marker]
                display_stuff('bg_default', ['executing:', command, 'shuting down ...'], 0, 0)
                socketIO.disconnect()
                os.system(command)
                sys.exit()
            else:  # browsesource
                reset_variable('navigation')  # reset values first
                socketIO.emit('getBrowseSources', '', on_push_browsesources)
        else:
            print('handle_button2 else eingetreten, schalte auf player um')
            reset_variable('player')
            socketIO.emit('getState', '', on_push_state)

    if pin == 6:  # Button B
        if mode == 'player':
            socketIO.emit('volume', '-')
        elif mode == 'navigation' or mode == 'menu':
            reset_variable('player')
            socketIO.emit('getState', '', on_push_state)

    if pin == 16:  # Button X
        if mode == 'player':
            navigation_handler('')
        elif mode == 'navigation' or mode == 'menu':
            marker -= 1  # count minus 1
            if marker < 0:  # blaettere nach oben durch
                marker = listresult-1
                if listresult > listmax - 1:  # dann aendere auch noch den liststart
                    liststart = int(liststart + (math.floor(listresult/listmax)*listmax))
            liststart = int(math.floor(marker/listmax)*listmax)  # definiert das blaettern zur naechsten Seite
            display_stuff('bg_default', nav_array_name, marker, liststart)

    if pin == 20:  # Button Y
        if mode == 'player':
            socketIO.emit('volume', '+')
        elif mode == 'navigation' or mode == 'menu':
            marker += 1  # count plus 1
            liststart = int(math.floor(marker/listmax)*listmax)  # definiert das blaettern zur naechsten Seite
            if marker > listresult-1:  # blaettere nach unten durch
                marker = 0
                liststart = 0
            display_stuff('bg_default', nav_array_name, marker, liststart)


def setup_channel(channel):
    try:
        print "register %d" %channel
        GPIO.setup(channel, GPIO.IN, GPIO.PUD_UP)
        GPIO.add_event_detect(channel, GPIO.FALLING, handle_button, bouncetime=400)
        print 'success'
    except (ValueError, RuntimeError) as e:
        print 'ERROR:', e


for x in [5, 6, 16, 20]:
    setup_channel(x)


def main():
    socketIO.wait()
    time.sleep(0.5)


try:
    main()

except KeyboardInterrupt:
    img = Image.new('RGB', (240, 240), color=(0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 0, 240, 240), (0, 0, 0))
    disp.display(img)
    disp.set_backlight(False)
    pass

finally:
    GPIO.cleanup()  # this ensures a clean exit
