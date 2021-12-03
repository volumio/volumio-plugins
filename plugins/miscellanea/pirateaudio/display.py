#!/usr/bin/env python

import time
from PIL import ImageFont, Image, ImageDraw, ImageStat, ImageFilter
from PIL import ImageFilter  # v0.0.4
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
from signal import *
from time import strftime, gmtime  # v.0.0.4
import time  # v.0.0.4
# import logging
# logging.getLogger('socketIO-client').setLevel(logging.DEBUG)
# logging.basicConfig()


# get the path of the script
script_path = os.path.dirname(os.path.abspath(__file__))
# set script path as current directory
os.chdir(script_path)

# socketIO = SocketIO('localhost', 3000)

# Create ST7789 LCD display class.
disp = ST7789.ST7789(
    rotation=90,  # Needed to display the right way up on Pirate Audio
    port=0,       # SPI port
    cs=1,         # SPI port Chip-select channel
    dc=9,         # BCM pin used for data/command
    backlight=13,
    spi_speed_hz=80 * 1000 * 1000
)


# read json file (plugin values)
with open('/data/configuration/miscellanea/pirateaudio/config.json', 'r') as myfile:
    data = myfile.read()
obj = json.loads(data)  # parse file

# read json file (volumio language)
with open('/data/configuration/miscellanea/appearance/config.json', 'r') as mylangfile:
    data_lang = mylangfile.read()
obj_lang = json.loads(data_lang)  # parse file
langcode = obj_lang['language_code']['value']
langpath = '/data/plugins/miscellanea/pirateaudio/i18n/strings_' + langcode + '.json'
if os.path.exists(langpath) is False:  # change to en as default language
    langpath = '/data/plugins/miscellanea/pirateaudio/i18n/strings_en.json'

# read json file (language file for translation)
with open(langpath, 'r') as mytransfile:
    data_trans = mytransfile.read()
obj_trans = json.loads(data_trans)  # parse file

WIDTH = 240
HEIGHT = 240
font_s = ImageFont.truetype(script_path + '/fonts/Roboto-Medium.ttf', 20)
font_m = ImageFont.truetype(script_path + '/fonts/Roboto-Medium.ttf', 24)
font_l = ImageFont.truetype(script_path + '/fonts/Roboto-Medium.ttf', 30)
font_fas = ImageFont.truetype(script_path + '/fonts/FontAwesome5-Free-Solid.otf', 28)
bg_default = Image.open('images/default.jpg').resize((240, 240))

albumart, artist, album, title, img_check = '', '', '', '', ''
mode = 'player'
title_queue, len_queue = [], 0  # v.0.0.4
position = ''  # v.0.0.4
nav_array_name, nav_array_uri, nav_array_type, nav_array_service = [], [], [], []
marker, listmax, liststart, listresult = 0, int(obj['listmax']['value']), 0, 0


BUTTONS = [5, 6, 16, obj['gpio_ybutton']['value']]
# LABELS = ['A', 'B', 'X', 'Y']
GPIO.setmode(GPIO.BCM)  # Set up RPi.GPIO with the "BCM" numbering scheme


# exit function (even is service is stopped)
def clean(*args):
    disp.set_backlight(False)
    GPIO.cleanup(BUTTONS)  # v0.0.4
    sys.exit(0)

for sig in (SIGABRT, SIGILL, SIGINT, SIGSEGV, SIGTERM):
    signal(sig, clean)
# exit function (even is service is stopped)


def on_connect():
    # print('connect')
    start_time = time.time()  # debug, time of code execution
    socketIO.on('pushState', on_push_state)
    socketIO.emit('getState', '', on_push_state)
    socketIO.on('pushBrowseSources', on_push_browsesources)
    socketIO.on('pushBrowseLibrary', on_push_browselibrary)
    socketIO.on('pushQueue', on_push_queue)
    socketIO.emit('getQueue', on_push_queue)
    # print("on_connect--- %s seconds ---" % (time.time() - start_time))  # debug, time of code execution


def on_disconnect():
    display_stuff('bg_default', obj_trans['DISPLAY']['LOSTCONNECTION'], 0, 0, 'info')


def navigation_handler():
    # start_time = time.time()  # debug, time of code execution
    global mode, nav_array_name, nav_array_uri, nav_array_type, marker, liststart, listresult
    if mode == 'player':
        mode = 'menu'
        emit_action = ['setSleep', {'enabled': 'true', 'time': strftime("%H:%M", gmtime(obj['sleeptimer']['value']*60))}]
        nav_array_name = [obj_trans['DISPLAY']['MUSICSELECTION'], obj_trans['DISPLAY']['SEEK'], obj_trans['DISPLAY']['PREVNEXT'], 'Sleeptimer ' + str(obj['sleeptimer']['value']) + 'M', obj_trans['DISPLAY']['SHUTDOWN'], obj_trans['DISPLAY']['REBOOT']]
        nav_array_uri = ['', 'seek', 'prevnext', emit_action, 'shutdown', 'reboot']
        nav_array_type = ['', 'seek', 'prevnext', 'emit', 'emit', 'emit']
        listresult = 6
        display_stuff('bg_default', nav_array_name, marker, liststart)
    else:
        print('else navigation_handler() eingetreten')
    # print("navigation_handler--- %s seconds ---" % (time.time() - start_time))  # debug, time of code execution


def on_push_browsesources(*args):
    # start_time = time.time()  # debug, time of code execution
    global listresult  # v.0.0.4 removed some globals, as thex not needed here
    if mode == 'navigation':  # v.0.0.4 added, to make sure this getting not displayed on_connect
        listresult = len(args[0])
        i = 0
        append_n = nav_array_name.append  # to avoid dots in for loop
        append_u = nav_array_uri.append
        for i in range(listresult):
            append_n(args[0][i]['name'])
            append_u(args[0][i]['uri'])
        display_stuff('bg_default', nav_array_name, marker, 0)
    # print("on_push_browsesources--- %s seconds ---" % (time.time() - start_time))  # debug, time of code execution


def on_push_browselibrary(*args):
    # start_time = time.time()  # debug, time of code execution
    global listresult  # v.0.0.4 removed some globals, as thex not needed here
    reset_variable('navigation')
    listresult = len(args[0]['navigation']['lists'][0]['items'])  # v.0.0.4 code cleaning
    i = 0
    if listresult > 0:  # we have item entries
        append_s = nav_array_service.append  # to avoid dots in for loop
        append_t = nav_array_type.append
        append_n = nav_array_name.append
        append_u = nav_array_uri.append
        for i in range(listresult):
            if 'service' in args[0]['navigation']['lists'][0]['items'][i]:  # v.0.0.4
                append_s(args[0]['navigation']['lists'][0]['items'][i]['service'])  # v.0.0.4
            if 'title' in args[0]['navigation']['lists'][0]['items'][i]:  # v.0.0.4
                append_n(args[0]['navigation']['lists'][0]['items'][i]['title'])
            append_t(args[0]['navigation']['lists'][0]['items'][i]['type'])
            if 'uri' in args[0]['navigation']['lists'][0]['items'][i]:  # v.0.0.4 spotify check
                append_u(args[0]['navigation']['lists'][0]['items'][i]['uri'])  # v.0.04
        display_stuff('bg_default', nav_array_name, marker, liststart)
    elif listresult == 0:  # we have no item entries
        display_stuff('bg_default', obj_trans['DISPLAY']['EMPTY'], marker, liststart)
    # print("on_push_browselibrary--- %s seconds ---" % (time.time() - start_time))  # debug, time of code execution


def reset_variable(varmode):
    # start_time = time.time()  # debug, time of code execution
    global mode, nav_array_service, nav_array_name, nav_array_uri, nav_array_type, marker, liststart, img_check, albumart
    mode = varmode
    del nav_array_name[:]  # v.0.0.4 del is cleaner than = []
    del nav_array_uri[:]
    del nav_array_type[:]
    del nav_array_service[:]
    marker, liststart = 0, 0
    img_check, albumart = '', ''  # reset albumart so display gets refreshed
    # print("reset_variable--- %s seconds ---" % (time.time() - start_time))  # debug, time of code execution


def sendtodisplay(img):
    # start_time = time.time()  # debug, time of code execution
    disp.display(img)
    # time.sleep(0.1)  # ohne sleep 82% CPU, sleep: 0.5 = 40%, 0.25 = 53%, 0.1 = 70%
    # print("sendtodisplay--- %s seconds ---" % (time.time() - start_time))  # debug, time of code execution


def display_stuff(picture, text, marked, start, icons='nav'):  # v.0.0.4 test for better performance
    # start_time = time.time()  # debug, time of code execution
    global img3, listmax  # v.0.0.4
    i = 0
    if picture == 'bg_default':
        img3 = bg_default.copy()
    else:
        img3 = Image.open(picture).convert('RGBA')  # v.0.0.4
    draw3 = ImageDraw.Draw(img3, 'RGBA')

    if isinstance(text, list):  # check if text is array
        result = len(text)  # count items of list/array
        totaltextheight = 0
        # Loop for finding out the sum of textheight for positioning, only text to display
        listbis = start + listmax
        if listbis > result:
            listbis = result
        for i in range(start, listbis):  # v.0.0.4 range max werteliste
            len1, hei1 = draw3.textsize(text[0+i], font=font_m)
            totaltextheight += hei1
        i = 0
        y = (HEIGHT // 2) - (totaltextheight // 2)

        # Loop for creating text to display
        for i in range(start, listbis):  # v.0.0.4
            len1, hei1 = draw3.textsize(text[0+i], font=font_m)
            x2 = (WIDTH - len1)//2
            if x2 < 0:  # v.0.0.4 dont center text if to long
                x2 = 0
            if i == marked:
                draw3.rectangle((x2, y + 2, x2 + len1, y + hei1), (255, 255, 255))
                draw3.text((x2, y), text[0+i], font=font_m, fill=(0, 0, 0))
            else:
                draw3.text((x2 + 3, y + 3), text[0+i], font=font_m, fill=(15, 15, 15))  # shadow v.0.0.4
                draw3.text((x2, y), text[0+i], font=font_m, fill=(255, 255, 255))
            y += hei1
    else:
        result = 1  # needed for right pageindex
        len1, hei1 = draw3.textsize(text, font=font_m)
        x2 = (WIDTH - len1)//2
        y2 = (HEIGHT - hei1)//2
        draw3.rectangle((x2, y2, x2 + len1, y2 + hei1), (255, 255, 255))
        draw3.text((x2, y2), text, font=font_m, fill=(0, 0, 0))

    # draw symbols
    if icons == 'nav':  # v.0.0.4
        draw3.text((0, 50), u"\uf14a", font=font_fas, fill=(255, 255, 255))  # Fontawesome symbols ok
        draw3.text((210, 50), u"\uf151", font=font_fas, fill=(255, 255, 255))  # Fontawesome symbols up
        draw3.text((0, 170), u"\uf0e2", font=font_fas, fill=(255, 255, 255))  # Fontawesome symbols back
        draw3.text((210, 170), u"\uf150", font=font_fas, fill=(255, 255, 255))  # Fontawesome symbols down
    elif icons == 'info':
        draw3.text((10, 10), u"\uf05a", font=font_fas, fill=(255, 255, 255))  # Fontawesome symbols info
    elif icons == 'seek':
        draw3.text((210, 50), u"\uf04e", font=font_fas, fill=(255, 255, 255))  # Fontawesome symbols forward
        draw3.text((0, 170), u"\uf0e2", font=font_fas, fill=(255, 255, 255))  # Fontawesome symbols back
        draw3.text((210, 170), u"\uf04a", font=font_fas, fill=(255, 255, 255))  # Fontawesome symbols backward

    page = int(math.ceil((float(marked) + 1)/float(listmax)))
    pages = int(math.ceil(float(result)/float(listmax)))
    if pages != 1:  # only show index if more than one site
        pagestring = str(page) + '/' + str(pages)
        len1, hei1 = draw3.textsize(pagestring, font=font_m)
        x2 = (WIDTH - len1)//2
        draw3.text((x2, HEIGHT - hei1), pagestring, font=font_m, fill=(255, 255, 255))
    sendtodisplay(img3)
    # print("displaystuff--- %s seconds ---" % (time.time() - start_time))  # debug, time of code execution


# position in code is important, so display_stuff works v.0.0.4
display_stuff('bg_default', obj_trans['DISPLAY']['WAIT'], 0, 0, 'info')
socketIO = SocketIO('localhost', 3000)


def seeking(direction):
    # start_time = time.time()  # debug, time of code execution
    global seek, duration
    step = 60000  # 60 seconds
    if direction == '+':
        if int(float((seek + step)/1000)) < duration:
            seek += step
            socketIO.emit('seek', int(float(seek/1000)))
            display_stuff('bg_default', [obj_trans['DISPLAY']['SEEK'], strftime("%M:%S", gmtime(int(float(seek/1000)))) + ' / ' + strftime("%M:%S", gmtime(duration))], 0, 0, 'seek')
    else:
        if int(float((seek - step)/1000)) > 0:
            seek -= step
            socketIO.emit('seek', int(float(seek/1000)))
            display_stuff('bg_default', [obj_trans['DISPLAY']['SEEK'], strftime("%M:%S", gmtime(int(float(seek/1000)))) + ' / ' + strftime("%M:%S", gmtime(duration))], 0, 0, 'seek')
    # print("seeking--- %s seconds ---" % (time.time() - start_time))  # debug, time of code execution


def prevnext(direction):
    # start_time = time.time()  # debug, time of code execution
    global position
    if direction == 'prev':
        position -= 1
    else:
        position += 1
    if position > len_queue - 1:  # set position to first entry to loop through playlist infinite
        position = 0
    elif position < 0:  # set position to last entry to loop through playlist infinite
        position = len_queue - 1
    display_stuff('bg_default', [str(position + 1) + '/' + str(len_queue), obj_trans['DISPLAY']['PREVNEXT'], title_queue[position]], 1, 0, 'seek')
    socketIO.emit('stop')
    socketIO.emit('play', {"value": position})
    # print("prevnext--- %s seconds ---" % (time.time() - start_time))  # debug, time of code execution


def on_push_queue(*args):
    global title_queue, len_queue
    # reset variables first
    del title_queue[:]
    len_queue = 0
    if len(args[0]) != 0:
        len_queue = len(args[0])
        append_t = title_queue.append  # to avoid dots in for loop
        for i in range(len_queue):
            append_t(args[0][i]['name'])


def on_push_state(*args):
    # start_time = time.time()  # debug, time of code execution
    global img, img2, dark, txt_col, str_col, bar_bgcol, bar_col, status, service, volume, albumart, img_check, mode, seek, duration, position

    def f_textsize(text, fontsize):
        w1, y1 = draw.textsize(text, fontsize)
        return w1

    def f_drawtext(x, y, text, fontstring, fillstring):
        draw.text((x, y), text, font=fontstring, fill=fillstring)

    def f_x1(textwidth):
        if textwidth <= WIDTH:
            x1 = (WIDTH - textwidth)//2
        else:
            x1 = 0
        return x1

    def f_content(field, fontsize, top, shadowoffset=1):
        if field in args[0]:
            if args[0][field] is not None:
                w1 = f_textsize(args[0][field], fontsize)
                x1 = f_x1(w1)
                f_drawtext(x1 + shadowoffset, top + shadowoffset, args[0][field], fontsize, str_col)  # shadow
                f_drawtext(x1, top, args[0][field], fontsize, txt_col)
                # return args[0][field]

    volume = int(args[0]['volume'])
    position = args[0]['position']  # v.0.0.4
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
            # img = Image.open(BytesIO(response.content)) # v.0.04 gab bei spotify probleme
            img = Image.open(BytesIO(response.content)).convert('RGBA')  # v.0.04 gab bei spotify probleme
            img = img.resize((WIDTH, HEIGHT))
            img = img.filter(ImageFilter.BLUR)  # Blur
            draw = ImageDraw.Draw(img, 'RGBA')
            # draw = ImageDraw.Draw(img)  # v.0.04 gab bei spotify probleme
            img2 = img.copy()

            # Light / Dark Symbols and bars, depending on background
            im_stat = ImageStat.Stat(img)
            im_mean = im_stat.mean
            mn = mean(im_mean)

            txt_col = (255, 255, 255)
            str_col = (15, 15, 15)  # v0.0.4 needed for shadow
            bar_bgcol = (200, 200, 200)
            bar_col = (255, 255, 255)
            dark = False
            if mn > 175:
                txt_col = (55, 55, 55)
                str_col = (200, 200, 200)  # v0.0.4 needed for shadow
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
            # draw.text((4, 53), u"\uf04C", font=font_fas, fill=txt_col)  # Fontawesome symbol pause
            f_drawtext(4, 53, u"\uf04C", font_fas, txt_col)
        else:
            # draw.text((4, 53), u"\uf04b", font=font_fas, fill=txt_col)  # Fontawesome symbol play
            f_drawtext(4, 53, u"\uf04b", font_fas, txt_col)
        # draw.text((210, 53), u"\uf0c9", font=font_fas, fill=txt_col)  # Fontawesome symbol menu
        f_drawtext(210, 53, u"\uf0c9", font_fas, txt_col)
        # draw.text((210, 174), u"\uf028", font=font_fas, fill=txt_col)  # Fontawesome symbol speaker
        f_drawtext(210, 174, u"\uf028", font_fas, txt_col)

        f_content('artist', font_m, 7, 2)  # 'artist', font_m
        f_content('album', font_m, 35, 2)
        f_content('title', font_l, 105, 2)  # falscher top wert

        # volume bar
        vol_x = int((float(args[0]['volume'])/100)*(WIDTH - 33))
        draw.rectangle((5, 184, WIDTH-34, 184 + 8), bar_bgcol)  # background
        draw.rectangle((5, 184, vol_x, 184 + 8), bar_col)

        # time bar
        if 'duration' in args[0]:
            duration = args[0]['duration']  # seconds
            if duration != 0:
                # if 'seek' in args[0]:
                if 'seek' in args[0] and args[0]['seek'] is not None:  # v0.0.4 sometime seek = null or None
                    seek = args[0]['seek']  # time elapsed seconds
                    # if seek != 0:  # v0.0.4 seek=0 is ok to show
                    el_time = int(float(args[0]['seek'])/1000)
                    du_time = int(float(args[0]['duration']))
                    dur_x = int((float(el_time)/float(du_time))*(WIDTH-10))
                    draw.rectangle((5, 230, WIDTH-5, 230 + 8), bar_bgcol)  # background
                    draw.rectangle((5, 230, dur_x, 230 + 8), bar_col)

                    # v0.0.4 show remaining time of track
                    remaining = '-' + strftime("%M:%S", gmtime(duration - int(float(seek)/1000)))
                    # w4, y4 = draw.textsize(remaining, font_m)
                    w4 = f_textsize(remaining, font_m)
                    # draw.text((WIDTH - w4 - 2 + 2, 206 - 2 + 2), remaining, font=font_m, fill=str_col)  # shadow, fill by mean
                    f_drawtext(WIDTH - w4 - 2 + 2, 206 - 2 + 2, remaining, font_m, str_col)  # shadow, fill by mean)
                    # draw.text((WIDTH - w4 - 2, 206 - 2), remaining, font=font_m, fill=txt_col)  # fill by mean
                    f_drawtext(WIDTH - w4 - 2, 206 - 2, remaining, font_m, txt_col)  # fill by mean)

        # display only if img changed
        if img_check != img:
            img_check = img
            sendtodisplay(img)
    # print("on_push_state--- %s seconds ---" % (time.time() - start_time))  # debug, time of code execution


img = Image.new('RGBA', (240, 240), color=(0, 0, 0, 25))
draw = ImageDraw.Draw(img, 'RGBA')
socketIO.once('connect', on_connect)
socketIO.on('disconnect', on_disconnect)


def handle_button(pin):
    # start_time = time.time()  # debug, time of code execution
    global mode, marker, liststart  # v.0.0.4
    browselibrary = False

    if pin == 5:  # Button A, only needs single press function
        if mode == 'player':
            if (status == 'play') and (service == 'webradio'):
                socketIO.emit('stop')
            elif (status == 'play'):
                socketIO.emit('pause')
            else:
                socketIO.emit('play')
        elif mode == 'navigation':
            if len(nav_array_uri) != 0:
                if len(nav_array_type) == 0:
                    browselibrary = True
                else:
                    if nav_array_type[marker] == 'song' or nav_array_type[marker] == 'webradio' or nav_array_type[marker] == 'mywebradio':  # v.0.0.4 fix for mywebradio
                        socketIO.emit('replaceAndPlay', {"service": nav_array_service[marker], "type": nav_array_type[marker], "title": nav_array_name[marker], "uri": nav_array_uri[marker]})
                        reset_variable('player')
                    elif nav_array_type[marker] == 'playlist' and nav_array_service[marker] == 'mpd':  # v.0.0.4 modified because of spotifiy
                        socketIO.emit('playPlaylist', {'name': nav_array_name[marker]})
                        reset_variable('player')
                    elif nav_array_type[marker] == 'playlist' and nav_array_service[marker] == 'spop':  # v.0.0.4 condition added because of spotifiy
                        socketIO.emit('stop')  # v.0.0.4 fix otherwise change from any playing source to spotify dont work
                        time.sleep(2)  # v.0.0.4 fix otherwise change from any playing source to spotify dont work
                        socketIO.emit('replaceAndPlay', {"service": nav_array_service[marker], "type": nav_array_type[marker], "title": nav_array_name[marker], "uri": nav_array_uri[marker]})
                        reset_variable('player')
                    elif 'folder' in nav_array_type[marker]:
                        if nav_array_service[marker] == 'podcast':
                            display_stuff('bg_default', obj_trans['DISPLAY']['WAIT'], marker, liststart)  # note, please wait
                        browselibrary = True
                    elif 'radio-' in nav_array_type[marker]:  # the minus (-) is important, otherwise i cant decide between 'radiofolder' and 'webradiostream'
                        browselibrary = True
                    elif 'streaming-' in nav_array_type[marker]:
                        browselibrary = True
                    else:
                        display_stuff('bg_default', obj_trans['DISPLAY']['NOTSUPPORTED'], marker, liststart)

                if browselibrary is True:
                    # replace "mnt/" in uri through "music-library/", otherwise calling them dont work (at least in favourites)
                    uri = nav_array_uri[marker]
                    uri = uri.replace('mnt/', 'music-library/')
                    socketIO.emit('browseLibrary', {'uri': uri})
                    browselibrary = False
            else:
                reset_variable('player')
                socketIO.emit('getState', '', on_push_state)
        elif mode == 'menu':
            # socketIO.emit('getQueue', on_push_queue)  # refresh variables of queue
            if nav_array_type[marker] == 'emit':
                if 'setSleep' in nav_array_uri[marker][0]:
                    socketIO.emit(nav_array_uri[marker][0], nav_array_uri[marker][1])
                    display_stuff('bg_default', obj_trans['DISPLAY']['SETSLEEPTIMER'], 0, 0, 'info')
                    disp.set_backlight(False)
                else:
                    socketIO.emit(nav_array_uri[marker])
                    display_stuff('bg_default', ['executing:', nav_array_uri[marker]], 0, 0, 'info')
            elif nav_array_type[marker] == 'seek':  # v.0.0.4
                mode = 'seek'
                display_stuff('bg_default', obj_trans['DISPLAY']['SEEK'], 0, 0, 'seek')
            elif nav_array_type[marker] == 'prevnext':  # v.0.0.4
                socketIO.emit('getQueue', on_push_queue)  # refresh variables of queue
                mode = 'prevnext'
                display_stuff('bg_default', [str(position + 1) + '/' + str(len_queue), obj_trans['DISPLAY']['PREVNEXT'], title_queue[position]], 1, 0, 'seek')
            else:  # browsesource
                reset_variable('navigation')
                socketIO.emit('getBrowseSources', '', on_push_browsesources)
        else:
            reset_variable('player')
            socketIO.emit('getState', '', on_push_state)

    if pin == 6:  # Button B, needs a pressed function in player mode
        if mode == 'player':
            while not GPIO.input(6) and volume > 0:  # limit/exit at volume 0 so amixer dont go crazy
                socketIO.emit('volume', '-')
                time.sleep(0.5)
        elif mode == 'navigation' or mode == 'menu' or mode == 'seek' or mode == 'prevnext':
            reset_variable('player')
            socketIO.emit('getState', '', on_push_state)

    if pin == 16:  # Button X, needs a pressed function in navigation and menu mode
        if mode == 'player':
            navigation_handler()
            disp.set_backlight(True)  # v.0.0.4
        elif mode == 'navigation' or mode == 'menu':
            while not GPIO.input(16):
                marker -= 1  # count minus 1
                if marker < 0:  # blaettere nach oben durch
                    marker = listresult - 1
                    if listresult > listmax - 1:  # dann aendere auch noch den liststart
                        liststart = int(liststart + (math.floor(listresult/listmax)*listmax))
                liststart = int(math.floor(marker/listmax)*listmax)  # definiert das blaettern zur naechsten Seite
                display_stuff('bg_default', nav_array_name, marker, liststart)
        elif mode == 'seek':  # v.0.0.4
            seeking('+')
        elif mode == 'prevnext':  # v.0.0.4
            prevnext('next')

    if pin == BUTTONS[3]:  # Button Y, needs a pressed function in  all modes
        if mode == 'seek':
            seeking('-')
        elif mode == 'prevnext':
            prevnext('prev')
        else:
            while not GPIO.input(BUTTONS[3]):
                if mode == 'player' and volume < 100:  # limit/exit at volume 100 so amixer dont go crazy:
                    socketIO.emit('volume', '+')
                    time.sleep(0.5)
                elif mode == 'navigation' or mode == 'menu':
                    marker += 1  # count plus 1
                    liststart = int(math.floor(marker/listmax)*listmax)  # definiert das blaettern zur naechsten Seite
                    if marker > listresult - 1:  # blaettere nach unten durch
                        marker = 0
                        liststart = 0
                    display_stuff('bg_default', nav_array_name, marker, liststart)
    # print("handle_button--- %s seconds ---" % (time.time() - start_time))  # debug, time of code execution


def setup_channel(channel):
    # start_time = time.time()  # debug, time of code execution
    try:
        print('register %d') % channel
        GPIO.setup(channel, GPIO.IN, GPIO.PUD_UP)
        GPIO.add_event_detect(channel, GPIO.FALLING, handle_button, bouncetime=250)
        print('success')
    except (ValueError, RuntimeError) as e:
        print('ERROR:', e)
    # print("setup_channel--- %s seconds ---" % (time.time() - start_time))  # debug, time of code execution


for x in BUTTONS:
    setup_channel(x)


def main():
    socketIO.wait()
    time.sleep(0.5)


try:
    main()
except KeyboardInterrupt:
    clean()
    pass
