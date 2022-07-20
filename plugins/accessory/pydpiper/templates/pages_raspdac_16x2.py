
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
	'raspdac':  { 'type':'text', 'format':"RASPDAC", 'font':'large', 'varwidth':True, 'size':(80,16), 'just':'center' },
	'artist': { 'type':'text', 'format':'{0}', 'variables':['artist'], 'font':'small','varwidth':True,'effect':('scroll','left',5,5,20,'onloop',3,80)},
	'samplerate': { 'type':'text', 'format':'{0}', 'variables':['samplerate'], 'font':'small','varwidth':True, 'just':'right', 'size':(50,8) },
	'bitdepth': { 'type':'text', 'format':'{0}', 'variables':['bitdepth'], 'font':'small','varwidth':True}, 
	'ip': { 'type':'text', 'format':'IP :\n{0}', 'variables':['ip'], 'font':'small', 'varwidth':True, 'just':'center', 'size':(65,16) },
	'elapsed_formatted': { 'type':'text', 'format':'{0}', 'variables':['elapsed_formatted'], 'font':'small', 'varwidth':True, },
	'time_formatted': { 'type':'text', 'format':'{0}', 'variables':['time_formatted'], 'font':'large', 'just':'right', 'varwidth':True, 'size':(50,16) },
	'radioAP': { 'type':'text', 'format':"WEB RADIO", 'font':'small', 'varwidth':True, 'size':(45,8), 'just':'left' },
	'position': { 'type':'text', 'format':'{0}', 'variables':['position'], 'font':'small', 'varwidth':True, },
	'nowplaying': { 'type':'text', 'format':'{0}', 'variables':['actPlayer|upper'], 'font':'tiny', 'varwidth':True},
	'nowplayingdata': { 'type':'text', 'format':'{0}/{1}', 'variables':['playlist_position', 'playlist_length'], 'font':'tiny', 'just':'right','size':(35,5),'varwidth':True},
	'title': { 'type':'text', 'format':'{0}', 'variables':['title'], 'font':'small','varwidth':True,'effect':('scroll','left',5,5,20,'onloop',3,80) },
	'album': { 'type':'text', 'format':'{0}', 'variables':['album'], 'font':'small','varwidth':True,'effect':('scroll','left',5,5,20,'onloop',3,80)},
	'playlist_display': { 'type':'text', 'format':'{0}', 'variables':['playlist_display'], 'font':'small', 'varwidth':True },
	'elapsed': { 'type':'text', 'format':'{0}', 'variables':['elapsed_formatted'], 'font':'small', 'just':'right', 'size':(50,8), 'varwidth':True },
	'time': { 'type':'text', 'format':'{0}', 'variables':['localtime|strftime+%-I:%M'], 'font':'large', 'just':'right', 'varwidth':True, 'size':(50,16) },
	'ampm': { 'type':'text', 'format':'{0}', 'variables':['localtime|strftime+%p'], 'font':'tiny', 'varwidth':True },
	'tempsmall': { 'type':'text', 'format':'\n{0}', 'variables':['outside_temp_formatted'], 'font':'small', 'just':'right', 'size':(20,16) },
	'temphilow': { 'type':'text', 'format':'H {0}\nL {1}', 'variables':['outside_temp_max|int', 'outside_temp_min|int'], 'font':'small', 'just':'right', 'size':(25,16) },
	'temp': { 'type':'text', 'format':'{0}', 'variables':['outside_temp_formatted'], 'font':'large', 'just':'center', 'size':(80,16) },
	'weather': { 'type':'text', 'format':'{0}', 'variables':['outside_conditions|capitalize'], 'font':'large','varwidth':True, 'size':(55,16), 'effect':('scroll','left',5,5,20,'onloop',3,80)},
	'radio': { 'type':'text', 'format':"RADIO", 'font':'tiny', 'varwidth':True, 'size':(40,5), 'just':'right' },
	'volume': { 'type':'text', 'format':'VOLUME ({0})', 'variables':['volume'], 'font':'tiny', 'varwidth':True, 'just':'left', 'size':(60,8)},
	'volumebar': { 'type':'progressimagebar', 'image':'progbar','value':'volume', 'rangeval':(0,100) },
	'songprogress': { 'type':'progressbar', 'value':'elapsed', 'rangeval':(0,'length'), 'size':(80,1) },
	'showplay': { 'type':'text', 'format':'\ue000 PLAY', 'font':'large', 'varwidth':True, 'just':'center', 'size':(80,16) },
	'showstop': { 'type':'text', 'format':'\ue001 STOP', 'font':'large', 'varwidth':True, 'just':'center', 'size':(80,16) },
        'showpause': { 'type':'text', 'format':'|| PAUSE', 'font':'large', 'varwidth':True, 'just':'center', 'size':(80,16) },
	'randomsymbol': { 'type':'text', 'format':'\ue002 ', 'font':'large', 'varwidth':True, 'size':(10,16) },
	'random': { 'type':'text', 'format':'Random\n{0}', 'variables':['random|onoff|Capitalize'], 'font':'small', 'varwidth':True, 'size':(65,16) },
	'repeatoncesymbol': { 'type':'text', 'format':'\ue003 ', 'font':'large', 'varwidth':True, 'size':(10,16) },
	'repeatonce': { 'type':'text', 'format':'Repeat Once\n{0}', 'variables':['single|onoff|Capitalize'], 'font':'small', 'varwidth':True, 'just':'center', 'size':(65,16) },
	'repeatallsymbol': { 'type':'text', 'format':'\ue004 ', 'font':'large', 'varwidth':True, 'size':(10,16) },
	'repeatall': { 'type':'text', 'format':'Repeat All\n{0}', 'variables':['repeat|onoff|Capitalize'], 'font':'small', 'varwidth':True, 'size':(65,16) },
	'temptoohigh': { 'type':'text', 'format':'\ue005 Warning System Too Hot ({0})', 'variables':['system_temp_formatted'], 'font':'large', 'varwidth':True, 'effect':('scroll','left',5,5,20,'onstart',3,80),
	}
}

# Assemble the widgets into canvases.  Only needed if you need to combine multiple widgets together so you can produce effects on them as a group.
CANVASES = {
	'playartist': { 'widgets': [ ('artist',0,7), ('nowplayingdata',40,0), ('songprogress',0,15) ], 'size':(80,16) },
	'playalbum': { 'widgets': [ ('album',0,7), ('nowplaying',0,0), ('nowplayingdata',40,0), ('songprogress',0,15) ], 'size':(80,16) },
	'playtitle': { 'widgets':  [ ('title',0,7), ('nowplaying',0,0), ('nowplayingdata',40,0), ('songprogress',0,15) ], 'size':(80,16) },
	'playartist_radio': { 'widgets': [ ('artist',0,7), ('nowplaying',0,0), ('radio',40,0), ('songprogress', 0,15) ], 'size':(80,16) },
	'playalbum_radio': { 'widgets':  [ ('album',0,7), ('nowplaying',0,0), ('radio',40,0), ('songprogress', 0,15) ], 'size':(80,16) },
	'playtitle_radio': { 'widgets':  [ ('title',0,7), ('nowplaying',0,0), ('radio',40,0), ('songprogress',0,15) ], 'size':(80,16) },
	'showrandom': { 'widgets': [ ('randomsymbol',0,0), ('random', 15,0) ], 'size':(80,16) },
	'showrepeatonce': { 'widgets': [ ('repeatoncesymbol',0,0), ('repeatonce', 15,0) ], 'size':(80,16) },
	'showrepeatall': { 'widgets': [ ('repeatallsymbol',0,0), ('repeatall', 15,0) ], 'size':(80,16) },
	'blank': { 'widgets': [], 'size':(100,16) },
	'stoptime': { 'widgets': [ ('time',10,2), ('ampm',60,2) ], 'size':(80,16) },
	'stoptimetemp_popup': { 'widgets': [ ('time',0,2), ('ampm',50,2), ('tempsmall',60,0), ('weather',0,17), ('temphilow',55,16) ], 'size':(80,32), 'effect': ('popup',16,15,10 ) },
	'volume_changed': { 'widgets': [ ('volume',5,0), ('volumebar',0,8) ], 'size':(80,16) },
	'stoptime24': { 'widgets': [ ('time_formatted',10,2) ], 'size':(80,16) },
	'playAP1': { 'widgets': [ ('artist',0,-1), ('album',0,8) ], 'size':(80,16) },
	'playAP2': { 'widgets': [ ('title',0,8), ('elapsed_formatted',15,0) ],  'size':(80,16) },
        'playAP3': { 'widgets': [ ('nowplaying',0,8), ('nowplayingdata',45,8),  ('bitdepth',0,-1), ('samplerate',30,-1), ('songprogress',0,15) ], 'size':(80,16) },
	'radioAP1': { 'widgets': [ ('radioAP',20,-1), ('title',0,8) ], 'size':(80,16) },
        'radioAP2': { 'widgets': [ ('artist',0,-1), ('position',30,8) ], 'size':(80,16) },

}

# Place the canvases into sequences to display when their condition is met
# More than one sequence can be active at the same time to allow for alert messages
# You are allowed to include a widget in the sequence without placing it on a canvas

# Note about Conditionals
# Conditionals must evaluate to a True or False resulting
# To access system variables, refer to them within the db dictionary (e.g. db['title'])
# To access the most recent previous state of a variable, refer to them within the dbp dictionary (e.g. dbp['title'])
SEQUENCES = [
	{	'name': 'seqSplash', 'canvases': [
			 { 'name':'raspdac', 'duration':3 },
			 { 'name':'ip', 'duration':4 }
	     ], 'conditional': "db['state']=='starting'" },

	{
		'name': 'seqPlay',
		'canvases': [
			{ 'name':'playAP1', 'duration':10, 'conditional':"not db['stream']=='webradio'" },
			{ 'name':'playAP2', 'duration':15, 'conditional':"not db['stream']=='webradio'" },
                        { 'name':'playAP3', 'duration':6, 'conditional':"not db['stream']=='webradio'" },
                        { 'name':'radioAP1', 'duration':10, 'conditional':"db['stream']=='webradio'" },
                        { 'name':'radioAP2', 'duration':10, 'conditional':"db['stream']=='webradio'" },

		],
		'conditional': "db['state']=='play'"
	},
	{
		'name': 'seqStop',
		'canvases': [
			{ 'name':'stoptimetemp_popup', 'duration':9999, 'conditional':"not db['outside_conditions']=='No data'" },
			{ 'name':'stoptime24', 'duration':9999, 'conditional':"db['outside_conditions']=='No data'" }
		],
		'conditional': "db['state']=='stop' or db['state']=='pause'"
	},
	{
		'name':'seqVolume',
		'coordinates':(0,0),
		'canvases': [ { 'name':'volume_changed', 'duration':5 } ],
		'conditional': "db['volume'] != dbp['volume']",
		'minimum':5,
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
                'name': 'seqAnnouncePause',
                'canvases': [ { 'name':'showpause', 'duration':8 } ],
                'conditional': "db['state'] != dbp['state'] and db['state']=='pause'",
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
