#!/usr/bin/python.pydPiper
# coding: UTF-8

from __future__ import unicode_literals


# Page Definitions
# See Page Format.txt for instructions and examples on how to modify your display settings

# Load the fonts needed for this system
FONTS = {
	'small': { 'default':True, 'file':'latin1_5x8_fixed.fnt','size':(5,8) },
#	'large': { 'file':'BigFont_10x16_fixed.fnt', 'size':(10,16) },
	'large': { 'file':'Vintl01_10x16_fixed.fnt', 'size':(10,16) },
	'tiny': { 'file':'upperasciiwide_3x5_fixed.fnt', 'size':(5,5) },
}

IMAGES = {
	'progbar': {'file':'progressbar_80x8.png' },
	'splash': {'file':'pydPiper_fixed_splash.png' }
}

# Load the Widgets that will be used to produce the display pages
WIDGETS = {
	'splash': { 'type':'image', 'image':'splash' },
	'nowplaying': { 'type':'text', 'format':'{0}', 'variables':['actPlayer|upper'], 'font':'tiny', 'just':'center', 'varwidth':True},
	'filetype': { 'type':'text', 'format':'{0}', 'variables':['tracktype|upper'], 'font':'tiny', 'varwidth':True},
	'fixed_stream': { 'type':'text', 'format':'STRM', 'variables':[], 'font':'tiny', 'varwidth':True},
	'stream': { 'type':'text', 'format':'{0}', 'variables':['actPlayer'], 'font':'small', 'just':'center', 'varwidth':True},
	'service_info': { 'type':'text', 'format':'SERVICE: {0}', 'variables':['actPlayer|upper'], 'font':'tiny', 'varwidth':True, 'effect':('scroll','left',5,5,20,'onloop',3,80) },
	'nowplayingdata': { 'type':'text', 'format':'{0} OF {1}', 'variables':['playlist_position', 'playlist_length'], 'font':'tiny', 'just':'right','size':(40,5),'varwidth':True},
	'artisttitle': { 'type':'text', 'format':'{0} - {1}', 'variables':['artist', 'title'], 'font':'small','varwidth':True, 'effect':('scroll','left',5,5,20,'onloop',3,80) },
	'title': { 'type':'text', 'format':'{0}', 'variables':['title'], 'font':'small','varwidth':True,'effect':('scroll','left',5,5,20,'onloop',3,80) },
	'artist': { 'type':'text', 'format':'{0}', 'variables':['artist'], 'font':'small','varwidth':True,'effect':('scroll','left',5,5,20,'onloop',3,80)},
	'album': { 'type':'text', 'format':'{0}', 'variables':['album'], 'font':'small','varwidth':True,'effect':('scroll','left',5,5,20,'onloop',3,80)},
	'playlist_display': { 'type':'text', 'format':'{0}', 'variables':['playlist_display'], 'font':'small', 'varwidth':True },
	'quality': { 'type':'text', 'format':'{0} | {1}', 'variables':['samplerate', 'bitdepth'], 'font':'small','varwidth':True, 'effect':('scroll','left',5,5,20,'onloop',2,80) },
	'bitdepth': { 'type':'text', 'format':'{0}', 'variables':['bitdepth'], 'font':'small','varwidth':True},
	'bitdepth_tiny': { 'type':'text', 'format':'{0}', 'variables':['bitdepth|upper'], 'font':'tiny','varwidth':True},
	'bitrate': { 'type':'text', 'format':'{0} kbps', 'variables':['bitrate'], 'font':'small','varwidth':True},
	'samplerate': { 'type':'text', 'format':'{0}', 'variables':['samplerate'], 'font':'small','varwidth':True},
	'samplerate_tiny': { 'type':'text', 'format':'{0}', 'variables':['samplerate|upper'], 'font':'tiny','varwidth':True},
	'elapsed': { 'type':'text', 'format':'{0}', 'variables':['elapsed_formatted'], 'font':'small', 'just':'right', 'size':(50,8), 'varwidth':True },
	'elapsed_tiny': { 'type':'text', 'format':'{0}', 'variables':['elapsed_formatted'], 'font':'tiny', 'just':'right', 'size':(50,8), 'varwidth':True },
	'elapsed_simple': { 'type':'text', 'format':'{0}', 'variables':['elapsed_simple'], 'font':'tiny', 'just':'left', 'varwidth':True },
	'total_time': { 'type':'text', 'format':'{0}', 'variables':['total_time'], 'font':'tiny', 'just':'right', 'specifiedsize':(30,5), 'varwidth':True },
	'time': { 'type':'text', 'format':'{0}', 'variables':['localtime|strftime+%-I:%M'], 'font':'large', 'just':'right', 'varwidth':True, 'size':(50,16) },
	'time24': { 'type':'text', 'format':'{0}', 'variables':['localtime|strftime+%H:%M'], 'font':'large', 'just':'right', 'varwidth':True, 'size':(50,16) },
	'ampm': { 'type':'text', 'format':'{0}', 'variables':['localtime|strftime+%p'], 'font':'tiny', 'varwidth':True },
	'tempsmall': { 'type':'text', 'format':'\n{0}', 'variables':['outside_temp_formatted'], 'font':'small', 'just':'right', 'size':(20,16) },
	'temphilow': { 'type':'text', 'format':'H {0}\nL {1}', 'variables':['outside_temp_max|int', 'outside_temp_min|int'], 'font':'small', 'just':'right', 'size':(25,16) },
	'temp': { 'type':'text', 'format':'{0}', 'variables':['outside_temp_formatted'], 'font':'large', 'just':'center', 'size':(80,16) },
	'weather': { 'type':'text', 'format':'{0}', 'variables':['outside_conditions|capitalize'], 'font':'large','varwidth':True, 'size':(55,16), 'effect':('scroll','left',5,5,20,'onloop',3,80)},
	'radio': { 'type':'text', 'format':"RADIO", 'font':'tiny', 'varwidth':True, 'size':(40,5), 'just':'right' },
	'volume': { 'type':'text', 'format':'VOLUME ({0})', 'variables':['volume'], 'font':'tiny', 'varwidth':True, 'just':'left', 'size':(60,8)},
	'volumebar': { 'type':'progressimagebar', 'image':'progbar','value':'volume', 'rangeval':(0,100) },
	'songprogress': { 'type':'progressbar', 'value':'elapsed', 'rangeval':(0,'length'), 'size':(80,3) },
	'songprogressbig': { 'type':'progressbar', 'value':'elapsed', 'rangeval':(0,'length'), 'size':(80,4) },
	'showplay': { 'type':'text', 'format':'\ue000 PLAY', 'font':'large', 'varwidth':True, 'just':'center', 'size':(80,16) },
	'showstop': { 'type':'text', 'format':'\ue001 STOP', 'font':'large', 'varwidth':True, 'just':'center', 'size':(80,16) },
	'randomsymbol': { 'type':'text', 'format':'\ue002 ', 'font':'large', 'varwidth':True, 'size':(10,16) },
	'random': { 'type':'text', 'format':'Random\n{0}', 'variables':['random|onoff|Capitalize'], 'font':'small', 'varwidth':True, 'size':(65,16) },
	'repeatoncesymbol': { 'type':'text', 'format':'\ue003 ', 'font':'large', 'varwidth':True, 'size':(10,16) },
	'repeatonce': { 'type':'text', 'format':'Repeat Once\n{0}', 'variables':['single|onoff|Capitalize'], 'font':'small', 'varwidth':True, 'just':'center', 'size':(65,16) },
	'repeatallsymbol': { 'type':'text', 'format':'\ue004 ', 'font':'large', 'varwidth':True, 'size':(10,16) },
	'repeatall': { 'type':'text', 'format':'Repeat All\n{0}', 'variables':['repeat|onoff|Capitalize'], 'font':'small', 'varwidth':True, 'size':(65,16) },
	'temptoohigh': { 'type':'text', 'format':'\ue005 Warning System Too Hot ({0})', 'variables':['system_temp_formatted'], 'font':'large', 'varwidth':True, 'effect':('scroll','left',5,5,20,'onstart',3,80) }
}

# Assemble the widgets into canvases.  Only needed if you need to combine multiple widgets together so you can produce effects on them as a group.
CANVASES = {
	'volumio': { 'widgets': [ ('artisttitle',0,0), ('elapsed_simple',0,8), ('filetype',30,8), ('total_time',55,8), ('songprogress',0,13) ], 'size':(80,16) },	
	#'volumio_quality': { 'widgets': [ ('artisttitle',0,0), ('samplerate_tiny',0,8), ('bitdepth_tiny',50,8), ('songprogress',0,13) ], 'size':(80,16) },
	'volumio_info': { 'widgets': [ ('quality',0,0), ('service_info',0,8), ('songprogress',0,13) ], 'size':(80,16) },
	'volumio_stream': { 'widgets': [ ('artisttitle',0,0), ('elapsed_simple',0,8), ('fixed_stream',30,8), ('total_time',55,8), ('songprogress',0,13) ], 'size':(80,16) },
	'playartist_radio': { 'widgets': [ ('artist',0,7), ('nowplaying',0,0) ], 'size':(80,16) },
	'playalbum_radio': { 'widgets':  [ ('album',0,7), ('nowplaying',0,0) ], 'size':(80,16) },
	'playtitle_radio': { 'widgets':  [ ('title',0,7), ('nowplaying',0,0) ], 'size':(80,16) },
	'showrandom': { 'widgets': [ ('randomsymbol',0,0), ('random', 15,0) ], 'size':(80,16) },
	'showrepeatonce': { 'widgets': [ ('repeatoncesymbol',0,0), ('repeatonce', 15,0) ], 'size':(80,16) },
	'showrepeatall': { 'widgets': [ ('repeatallsymbol',0,0), ('repeatall', 15,0) ], 'size':(80,16) },
	'blank': { 'widgets': [], 'size':(100,16) },
	'stoptime': { 'widgets': [ ('time24',10,2)], 'size':(80,16) },
	'stoptimetemp_popup': { 'widgets': [ ('time',0,2), ('ampm',50,2), ('tempsmall',60,0), ('weather',0,17), ('temphilow',55,16) ], 'size':(80,32), 'effect': ('popup',16,15,10 ) },
	'volume_changed': { 'widgets': [ ('volume',5,0), ('volumebar',0,8) ], 'size':(80,16) },
}

# Place the canvases into sequences to display when their condition is met
# More than one sequence can be active at the same time to allow for alert messages
# You are allowed to include a widget in the sequence without placing it on a canvas

# Note about Conditionals
# Conditionals must evaluate to a True or False resulting
# To access system variables, refer to them within the db dictionary (e.g. db['title'])
# To access the most recent previous state of a variable, refer to them within the dbp dictionary (e.g. dbp['title'])
SEQUENCES = [
	{	'name': 'seqSplash', 'canvases': [ { 'name':'splash', 'duration':4 } ], 'conditional': "db['state']=='starting'" },
	{
		'name': 'seqPlay',
		'canvases': [
			{ 'name':'volumio', 'duration':20, 'conditional':"not db['stream']=='webradio' and not db['actPlayer']=='airplay' and not db['actPlayer']=='Volspotconnect'" },
			#{ 'name':'volumio_quality', 'duration':5, 'conditional':"not db['stream']=='webradio' and not db['actPlayer']=='airplay' and not db['actPlayer']=='Volspotconnect'" },
			{ 'name':'volumio_info', 'duration':5, 'conditional':"not db['stream']=='webradio' and not db['actPlayer']=='airplay' and not db['actPlayer']=='Volspotconnect'" },
			{ 'name':'volumio_stream', 'duration':9999, 'conditional':"not db['stream']=='webradio' and (db['actPlayer']=='Volspotconnect' or db['actPlayer']=='airplay')" },
			{ 'name':'playartist_radio', 'duration':15, 'conditional':"db['stream']=='webradio'" },
			{ 'name':'playalbum_radio', 'duration':15, 'conditional':"db['stream']=='webradio' and db['album']" },
			{ 'name':'playtitle_radio', 'duration':15, 'conditional':"db['stream']=='webradio'" },
		],
		'conditional': "db['state']=='play'"
	},
	{
		'name': 'seqStop',
		'canvases': [
			{ 'name':'stoptime', 'duration':9999 }, # unconditional
			#{ 'name':'stoptimetemp_popup', 'duration':9999, 'conditional':"not db['outside_conditions']=='No data'" },
			#{ 'name':'stoptime', 'duration':9999, 'conditional':"db['outside_conditions']=='No data'" },			
		],
		'conditional': "db['state']=='stop'"
	},
	{
		'name':'seqVolume',
		'coordinates':(0,0),
		'canvases': [ { 'name':'volume_changed', 'duration':2 } ],
		'conditional': "db['volume'] != dbp['volume']",
		'minimum':2,
	},
	{
		'name': 'seqAnnouncePlay',
		'canvases': [ { 'name':'showplay', 'duration':2 } ],
		'conditional': "db['state'] != dbp['state'] and db['state']=='play'",
		'minimum':2,
	},
	{
		'name': 'seqAnnounceStop',
		'canvases': [ { 'name':'showstop', 'duration':2 } ],
		'conditional': "db['state'] != dbp['state'] and db['state']=='stop'",
		'minimum':2,
	},
	{
		'name':'seqAnnounceRandom',
		'canvases': [ { 'name':'showrandom', 'duration':2 } ],
		'conditional': "db['random'] != dbp['random']",
		'minimum':2,
	},
	{
		'name':'seqAnnounceSingle',
		'canvases': [ { 'name':'showrepeatonce', 'duration':2 } ],
		'conditional': "db['single'] != dbp['single']",
		'minimum':2,
	},
	{
		'name':'seqAnnounceRepeat',
		'canvases': [ { 'name':'showrepeatall', 'duration':2 } ],
		'conditional': "db['repeat'] != dbp['repeat']",
		'minimum':2,
	},
	{
		'name':'seqAnnounceTooHot',
		'canvases': [ { 'name':'temptoohigh', 'duration':5 } ],
		'conditional': "db['system_tempc'] > 85",
		'minimum':5,
		'coolingperiod':30
	}
]
