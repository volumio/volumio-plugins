#!/usr/bin/python.pydPiper
# coding: UTF-8

# pydPiper service to display music data to LCD and OLED character displays
# Written by: Ron Ritchey

from __future__ import unicode_literals
import json, threading, logging, Queue, time, sys, getopt, moment, signal, commands, os, copy, imp, urllib2
import pages
import displays
import sources
import pydPiper_config

#try:
#	import pyowm
#except ImportError:
#	pass


exitapp = [ False ]

class music_controller(threading.Thread):
	# Receives updates from music services
	# Determines what page to displays
	# Sends relevant updates to display_controller

	# musicdata variables.
	# Includes all from musicdata class plus environmentals
	musicdata_init = {
		'state':u"stop",
		'musicdatasource':u"",
		'actPlayer':u"",
		'artist':u"",
		'title':u"",
		'album':u"",
		'uri':u"",
		'current':-1,
		'elapsed':-1,
		'remaining':u"",
		'total_time':u"",
		'duration':-1,
		'length':-1,
		'position':u"",
		'elapsed_formatted':u"",
		'elapsed_simple':u"",
		'volume':-1,
		'repeat': 0,
		'single': 0,
		'random': 0,
		'channels':0,
		'bitdepth':u"",
		'bitrate':u"",
		'samplerate':u"",
		'type':u"",
		'tracktype':u"",
		'repeat_onoff': u"Off",
		'single_onoff': u"Off",
		'random_onoff': u"Off",
		'playlist_display':u"",
		'playlist_position':-1,
		'playlist_count':-1,
		'playlist_length':-1,
		'current_tempc':0,
		'current_tempf':0,
		'disk_avail':0,
		'disk_availp':0,
		'current_time':u"",
		'utc':moment.utcnow(),
		'localtime':moment.utcnow().timezone(pydPiper_config.TIMEZONE),
		'current_time_sec':u"",
		'current_time_formatted':u"",
		'current_ip':u"",
		'outside_conditions':'No Data',
		'outside_temp_min':0,
		'outside_temp_max':0,
		'outside_temp_formatted':'',
		'system_temp_formatted':''
	}


	def __init__(self, servicelist, display_controller, showupdates=False):
		threading.Thread.__init__(self)

		self.daemon = True
		self.musicqueue = Queue.Queue()
		self.image = None
		self.showupdates = showupdates
		self.display_controller = display_controller

		self.musicdata = copy.deepcopy(self.musicdata_init)
		self.musicdata_prev = copy.deepcopy(self.musicdata)
		self.servicelist = servicelist
		self.services = { }

		# Attempt to initialize services
		self.initservices()

		# Lock used to prevent simultaneous update of the musicdata dictionary
		self.musicdata_lock = threading.Lock()


	def initservices(self):

		# Make sure that if rune is selected that is is the only service that is selected
		if u"rune" in self.servicelist and len(self.servicelist) > 1:
			logging.critical(u"Rune service can only be used alone")
			raise RuntimeError(u"Rune service can only be used alone")
		if u"volumio" in self.servicelist and len(self.servicelist) > 1:
			logging.critical(u"Volumio service can only be used alone")
			raise RuntimeError(u"Volumio service can only be used alone")

		musicservice = None
		for s in self.servicelist:
			s = s.lower()
			try:
				if s == u"mpd":
					musicservice = sources.musicdata_mpd.musicdata_mpd(self.musicqueue, pydPiper_config.MPD_SERVER, pydPiper_config.MPD_PORT, pydPiper_config.MPD_PASSWORD)
				elif s == u"spop":
					musicservice = sources.musicdata_spop.musicdata_spop(self.musicqueue, pydPiper_config.SPOP_SERVER, pydPiper_config.SPOP_PORT, pydPiper_config.SPOP_PASSWORD)
				elif s == u"lms":
					musicservice = sources.musicdata_lms.musicdata_lms(self.musicqueue, pydPiper_config.LMS_SERVER, pydPiper_config.LMS_PORT, pydPiper_config.LMS_USER, pydPiper_config.LMS_PASSWORD, pydPiper_config.LMS_PLAYER)
				elif s == u"rune":
					musicservice = sources.musicdata_rune.musicdata_rune(self.musicqueue, pydPiper_config.RUNE_SERVER, pydPiper_config.RUNE_PORT, pydPiper_config.RUNE_PASSWORD)
				elif s == u"volumio":
					musicservice = sources.musicdata_volumio2.musicdata_volumio2(self.musicqueue, pydPiper_config.VOLUMIO_SERVER, pydPiper_config.VOLUMIO_PORT, exitapp )
				else:
					logging.debug(u"Unsupported music service {0} requested".format(s))
					continue
			except NameError:
				# Missing dependency for requested servicelist
				logging.warning(u"Request for {0} failed due to missing dependencies".format(s))
				pass
			if musicservice != None:
				self.services[s] = musicservice

		if len(self.services) == 0:
			logging.critical(u"No music services succeeded in initializing")
			raise RuntimeError(u"No music services succeeded in initializing")

	def run(self):

		logging.debug(u"Music Controller Starting")

		# Start the thread that updates the system variables
		sv_t = threading.Thread(target=self.updatesystemvars)
		sv_t.daemon = True
		sv_t.start()
		timesongstarted = 0


		# Inform the system that we are starting up
		with self.musicdata_lock:
			self.musicdata_prev[u'state'] = ''
			self.musicdata[u'state'] = 'starting'
		self.starttime = time.time()

		lastupdate = 0 # Initialize variable to be used to force updates every second regardless of the receipt of a source update
		while not exitapp[0]:

			updates = { }

			# Check if we are starting up.  If yes, update pages to display any start message.
			if self.starttime + pydPiper_config.STARTUP_MSG_DURATION > time.time():
				time.sleep(pydPiper_config.STARTUP_MSG_DURATION)
				with self.musicdata_lock:
					self.musicdata['state'] = 'stop'
				continue

			# Attempt to get an update from the queue
			try:
				updates = self.musicqueue.get_nowait()
				self.musicqueue.task_done()
			except Queue.Empty:
				pass

			# Get current time
			try:
				utc = moment.utcnow()
				localtime = moment.utcnow().timezone(pydPiper_config.TIMEZONE)
				current_time_ampm = moment.utcnow().timezone(pydPiper_config.TIMEZONE).strftime(u"%p").strip().decode()
				if pydPiper_config.TIME24HOUR == True:
					current_time = moment.utcnow().timezone(pydPiper_config.TIMEZONE).strftime(u"%H:%M").strip().decode()
					current_time_sec = moment.utcnow().timezone(pydPiper_config.TIMEZONE).strftime(u"%H:%M:%S").strip().decode()
				else:
					current_time = moment.utcnow().timezone(pydPiper_config.TIMEZONE).strftime(u"%-I:%M %p").strip().decode()
					current_time_sec = moment.utcnow().timezone(pydPiper_config.TIMEZONE).strftime(u"%-I:%M:%S %p").strip().decode()
			except ValueError:
				# Don't know why but on exit, the moment code is occasionally throwing a ValueError
				current_time = u"00:00"
				current_time_sec = u"00:00:00"
				current_time_ampm = u''
				utc = None
				localtime = None

			with self.musicdata_lock:
				# Update musicdata based upon received message
				for item, value in updates.iteritems():
					self.musicdata[item] = value

				# Update song timing variables
				if u'elapsed' in updates:
					self.musicdata[u'elapsed'] = self.musicdata[u'current'] = updates[u'elapsed']
					timesongstarted = time.time() - self.musicdata[u'elapsed']

				if self.musicdata[u'state'] == u'play':
					if u'elapsed' not in updates:
						if timesongstarted > 0:
							self.musicdata[u'elapsed'] = int(time.time() - timesongstarted)
						else:
							# We got here without timesongstarted being set which is a problem...
							logging.debug(u"Trying to update current song position with an uninitialized start time")

				# If the value of current has changed then update the other related timing variables
				if self.musicdata[u'elapsed'] != self.musicdata_prev[u'elapsed']:
					timepos = time.strftime("%-M:%S", time.gmtime(self.musicdata[u'elapsed']))
					timepos_advanced = timepos
					total_time = "00:00"
					if self.musicdata[u'length'] > 0:						
						timepos_advanced = time.strftime("%-M:%S", time.gmtime(self.musicdata[u'elapsed'])) + "/" + time.strftime("%-M:%S", time.gmtime(self.musicdata[u'length']))
						remaining = time.strftime("%-M:%S", time.gmtime(self.musicdata[u'length'] - self.musicdata[u'elapsed']))
						total_time = time.strftime("%-M:%S", time.gmtime(self.musicdata[u'length']))
					else:						
						remaining = timepos

					self.musicdata[u'elapsed_formatted'] = timepos_advanced.decode()
					self.musicdata[u'remaining'] = remaining.decode()
					self.musicdata[u'elapsed_simple'] = self.musicdata[u'position'] = timepos.decode()
					self.musicdata[u'total_time'] = total_time.decode()

				# Update onoff variables (random, single, repeat)
				self.musicdata[u'random_onoff'] = u"On" if self.musicdata[u'random'] else u"Off"
				self.musicdata[u'single_onoff'] = u"On" if self.musicdata[u'single'] else u"Off"
				self.musicdata[u'repeat_onoff'] = u"On" if self.musicdata[u'repeat'] else u"Off"

				# update time variables
				self.musicdata[u'utc'] = utc
				self.musicdata[u'localtime'] = localtime
				self.musicdata[u'time'] = current_time
				self.musicdata[u'time_ampm'] = current_time_ampm
				# note: 'time_formatted' is computed during page processing as it needs the value of the strftime key contained on the line being displayed

				# For backwards compatibility
				self.musicdata[u'current_time'] = current_time
				self.musicdata[u'current_time_sec'] = current_time


			# If anything has changed, update pages ### probably unnecessary to check this now that time is being updated in this section
			if self.musicdata != self.musicdata_prev or lastupdate < time.time():

				# Set lastupdate time to 1 second in the future
				lastupdate = time.time()+1

				self.musicdata[u'time_formatted'] = moment.utcnow().timezone(pydPiper_config.TIMEZONE).strftime('%H:%M').strip().decode()
				# To support previous key used for this purpose
				self.musicdata[u'current_time_formatted'] = self.musicdata[u'time_formatted']

				# Update display controller
				# The primary call to this routine is in main but this call is needed to catch variable changes before musicdata_prev is updated.
				self.display_controller.next()

				# Print the current contents of musicdata if showupdates is True
				if self.showupdates:

					# Check to see if a variable has changed (except time variables)
					shouldshowupdate = False
					for item, value in self.musicdata.iteritems():
						try:
							if item in ['utc', 'localtime', 'time', 'time_ampm', 'current_time', 'current_time_sec']:
								continue
							if self.musicdata_prev[item] != value:
								shouldshowupdate = True
								break
						except KeyError:
							shouldshowupdate = True
							break


					if shouldshowupdate:
						ctime = localtime.strftime("%-I:%M:%S %p").strip()
						print u"Status at time {0}".format(ctime)

						with self.musicdata_lock:
							for item,value in self.musicdata.iteritems():
								try:
									print u"    [{0}]={1} {2}".format(item,repr(value), type(value))
								except:
									print u"err"
									print u"[{0}] =".format(item)
									print type(value)
									print repr(value)
							print u"\n"

				# Update musicdata_prev
				with self.musicdata_lock:
					for item, value in self.musicdata.iteritems():
						try:
							if self.musicdata_prev[item] != value:
								self.musicdata_prev[item] = value
						except KeyError:
							self.musicdata_prev[item] = value

			# Update display data every 1/4 second
			time.sleep(.25)


	def updatesystemvars(self):
		while True:

			current_ip = commands.getoutput(u"ip -4 route get 1 | head -1 | cut -d' ' -f8 | tr -d '\n'").strip()

			outside_tempf = 0.0
			outside_tempc = 0.0
			outside_temp = 0.0
			outside_temp_max = 0.0
			outside_temp_min = 0.0
			outside_conditions = u'No data'
			outside_temp_formatted = u'0'
			outside_temp_max_formatted = u'0'
			outside_temp_min_formatted = u'0'

#

			try:
				wq = 'http://api.wunderground.com/api/' + pydPiper_config.WUNDER_API + '/geolookup/conditions/forecast/q/' + pydPiper_config.WUNDER_LOCATION + '.json'
				response = urllib2.urlopen(wq)
				json_result = response.read()

				try:
					parsed_json = json.loads(json_result)

					location = parsed_json['location']['city']
					outside_tempf = parsed_json['current_observation']['temp_f']
					outside_tempc = parsed_json['current_observation']['temp_c']
					outside_temp_maxf = float(parsed_json['forecast']['simpleforecast']['forecastday'][0]['high']['fahrenheit'])
					outside_temp_maxc = float(parsed_json['forecast']['simpleforecast']['forecastday'][0]['high']['celsius'])
					outside_temp_minf = float(parsed_json['forecast']['simpleforecast']['forecastday'][0]['low']['fahrenheit'])
					outside_temp_minc = float(parsed_json['forecast']['simpleforecast']['forecastday'][0]['low']['celsius'])
					outside_conditions = parsed_json['current_observation']['weather']

					if pydPiper_config.TEMPERATURE.lower() == u'celsius':
						outside_temp = outside_tempc
						outside_temp_max = int(outside_temp_maxc)
						outside_temp_min = int(outside_temp_minc)
						outside_temp_formatted = u"{0}°C".format(int(outside_temp))
						outside_temp_max_formatted = u"{0}°C".format(int(outside_temp_max))
						outside_temp_min_formatted = u"{0}°C".format(int(outside_temp_min))
					else:
						outside_temp = outside_tempf
						outside_temp_max = int(outside_temp_maxf)
						outside_temp_min = int(outside_temp_minf)
						outside_temp_formatted = u"{0}°F".format(int(outside_temp))
						outside_temp_max_formatted = u"{0}°F".format(int(outside_temp_max))
						outside_temp_min_formatted = u"{0}°F".format(int(outside_temp_min))

				except ValueError:
					logging.warning('Failed to decode result from Weather Underground Query.  Query string was {0}.  Response was {1}'.format(wq,json_result))

			except urllib2.HTTPError as e:
				logging.warning('The Weather Underground server couldn\'t fulfill the request and responded with error code {0}'.format(e.code))
			except urllib2.URLError as e:
				logging.warning('Could not reach the Weather Underground server.  Reason provided was {0}'.format(e.reason))
			except (AttributeError, KeyError):
				logging.warning('Weather Underground API key or location are missing from configuration file')




			# try:
				# owm = pyowm.OWM(pydPiper_config.OWM_API)
				# obs = owm.weather_at_coords(pydPiper_config.OWM_LAT, pydPiper_config.OWM_LON)
				# fc = owm.daily_forecast_at_coords(pydPiper_config.OWM_LAT, pydPiper_config.OWM_LON)
				# f = fc.get_forecast()
				# dailyfc = f.get_weathers()
				# wea = obs.get_weather()
				#
				# outside_tempf = wea.get_temperature(u'fahrenheit')[u'temp']
				# outside_temp_maxf = dailyfc[0].get_temperature(u'fahrenheit')[u'max']
				# outside_temp_minf = dailyfc[0].get_temperature(u'fahrenheit')[u'min']
				#
				# outside_tempc = wea.get_temperature(u'celsius')[u'temp']
				# outside_temp_maxc = dailyfc[0].get_temperature(u'celsius')[u'max']
				# outside_temp_minc = dailyfc[0].get_temperature(u'celsius')[u'min']
				#
				# # Localize temperature value
				# if pydPiper_config.TEMPERATURE.lower() == u'celsius':
				# 	outside_temp = outside_tempc
				# 	outside_temp_max = int(outside_temp_maxc)
				# 	outside_temp_min = int(outside_temp_minc)
				# 	outside_temp_formatted = u"{0}°C".format(int(outside_temp))
				# 	outside_temp_max_formatted = u"{0}°C".format(int(outside_temp_max))
				# 	outside_temp_min_formatted = u"{0}°C".format(int(outside_temp_min))
				# else:
				# 	outside_temp = outside_tempf
				# 	outside_temp_max = int(outside_temp_maxf)
				# 	outside_temp_min = int(outside_temp_minf)
				# 	outside_temp_formatted = u"{0}°F".format(int(outside_temp))
				# 	outside_temp_max_formatted = u"{0}°F".format(int(outside_temp_max))
				# 	outside_temp_min_formatted = u"{0}°F".format(int(outside_temp_min))
				#
				# outside_conditions = wea.get_detailed_status()
			# except:
			# 	logging.debug(u"Failed to get weather data.  Check OWM_API key.")
			# 	pass


			try:
				with open(u"/sys/class/thermal/thermal_zone0/temp") as file:
					system_tempc = int(file.read())

				# Convert value to float and correct decimal place
				system_tempc = round(float(system_tempc) / 1000,1)

				# convert to fahrenheit
				system_tempf = round(system_tempc*9/5+32,1)

			except AttributeError:
				system_tempc = 0.0
				system_tempf = 0.0

			try:
				if pydPiper_config.TEMPERATURE.lower() == u'celsius':
					system_temp = system_tempc
					system_temp_formatted = u"{0}°c".format(int(system_temp))
				else:
					system_temp = system_tempf
					system_temp_formatted = u"{0}°f".format(int(system_temp))
			except:
				system_temp = system_tempf
				system_temp_formatted = u"{0}°f".format(int(system_temp))

			try:
				# Check if running on OSX.  If yes, adjust df command
				if sys.platform == u"darwin":
					with os.popen(u"df /") as p:
						p = os.popen(u"df /")
						line = p.readline()
						line = p.readline()

					va = line.split()
					line = "{0} {1}".format(va[3], va[4])
				else:
					# assume running on Raspberry linux
					with os.popen(u"df -B 1 /") as p:
						line = p.readline()
						line = p.readline().strip()

				va = line.split()
				avail = int(va[3])
				usedp = int(va[4][:-1]) # Remove trailing % and convert to int
				used = int(va[2])
				availp = 100-usedp

			except AttributeError:
				avail = 0
				availp = 0
				usedp = 0
				used = 0

			with self.musicdata_lock:
				self.musicdata[u'system_temp'] = system_temp
				self.musicdata[u'system_temp_formatted'] = system_temp_formatted

				self.musicdata[u'system_tempc'] = system_tempc
				self.musicdata[u'system_tempf'] = system_tempf

				# For backward compatibility
				self.musicdata[u'current_tempc'] = self.musicdata[u'system_tempc']
				self.musicdata[u'current_tempf'] = self.musicdata[u'system_tempf']

				self.musicdata[u'disk_avail'] = avail
				self.musicdata[u'disk_availp'] = availp
				self.musicdata[u'disk_used'] = used
				self.musicdata[u'disk_usedp'] = usedp


				self.musicdata[u'ip'] = current_ip.decode()

				# For backwards compatibility
				self.musicdata[u'current_ip'] = current_ip.decode()

				self.musicdata[u'outside_temp'] = outside_temp
				self.musicdata[u'outside_temp_max'] = outside_temp_max
				self.musicdata[u'outside_temp_min'] = outside_temp_min
				self.musicdata[u'outside_temp_formatted'] = outside_temp_formatted
				self.musicdata[u'outside_temp_max_formatted'] = outside_temp_max_formatted
				self.musicdata[u'outside_temp_min_formatted'] = outside_temp_min_formatted
				self.musicdata[u'outside_conditions'] = outside_conditions

			# Read environmentals every 5 minutes
			time.sleep(300)

def sigterm_handler(_signo, _stack_frame):
        sys.exit(0)

if __name__ == u'__main__':
	import math
	signal.signal(signal.SIGTERM, sigterm_handler)

	# Changing the system encoding should no longer be needed
#	if sys.stdout.encoding != u'UTF-8':
#    		sys.stdout = codecs.getwriter(u'utf-8')(sys.stdout, u'strict')

	logging.basicConfig(format=u'%(asctime)s:%(levelname)s:%(message)s', filename=pydPiper_config.LOGFILE, level=pydPiper_config.LOGLEVEL)
	logging.getLogger().addHandler(logging.StreamHandler())
	logging.getLogger(u'socketIO-client').setLevel(logging.WARNING)

	# Move unhandled exception messages to log file
	def handleuncaughtexceptions(exc_type, exc_value, exc_traceback):
		if issubclass(exc_type, KeyboardInterrupt):
			sys.__excepthook__(exc_type, exc_value, exc_traceback)
			return

		logging.error(u"Uncaught exception", exc_info=(exc_type, exc_value, exc_traceback))
		try:
			if len(mc.musicdata) > 0:
				logging.error(u"Player status at exception")
				logging.error(unicode(mc.musicdata))
		except NameError:
			# If this gets called before the music controller is instantiated, ignore it
			pass

		sys.__excepthook__(exc_type, exc_value, exc_traceback)


	sys.excepthook = handleuncaughtexceptions

	# Suppress MPD libraries INFO messages
	loggingMPD = logging.getLogger(u"mpd")
	loggingMPD.setLevel( logging.WARN )
	loggingPIL = logging.getLogger(u'PIL')
	loggingPIL.setLevel( logging.WARN )

	try:
		opts, args = getopt.getopt(sys.argv[1:],u"d:",[u"driver=",u"devicetype=",u"width=",u"height=","rs=","e=","d4=","d5=","d6=","d7=","i2caddress=","i2cport=" ,u"wapi=", u"wlocale=", u"timezone=", u"time24hour", u"temperature=", u"lms",u"mpd",u"spop",u"rune",u"volumio",u"pages=", u"lmsplayer=", u"showupdates"])
	except getopt.GetoptError:
		print u'pydPiper.py -d <driver> --devicetype <devicetype (for LUMA devices)> --width <width in pixels> --height <height in pixels> --rs <rs> --e <e> --d4 <d4> --d5 <d5> --d6 <d6> --d7 <d7> --i2caddress <i2c address> --i2cport <i2c port> --wapi <weather underground api key> --wlocale <weather location> --timezone <timezone> --time24hour --temperature <fahrenheit or celcius> --mpd --spop --lms --rune --volumio --pages <pagefile> --lmsplayer <mac address of lms player> --showupdates'
		sys.exit(2)

	services_list = [ ]
	driver = ''
	devicetype = ''
	showupdates = False
	pagefile = 'pages.py'

	pin_rs = pydPiper_config.DISPLAY_PIN_RS
	pin_e = pydPiper_config.DISPLAY_PIN_E
	[pin_d4, pin_d5, pin_d6, pin_d7] = pydPiper_config.DISPLAY_PINS_DATA
	rows = pydPiper_config.DISPLAY_HEIGHT
	cols = pydPiper_config.DISPLAY_WIDTH
	i2c_address = pydPiper_config.DISPLAY_I2C_ADDRESS
	i2c_port = pydPiper_config.DISPLAY_I2C_PORT

	for opt, arg in opts:
		if opt == u'-h':
			print u'pydPiper.py -d <driver> --devicetype <devicetype e.g. ssd1306, sh1106> --width <width in pixels> --height <height in pixels> --rs <rs> --e <e> --d4 <d4> --d5 <d5> --d6 <d6> --d7 <d7> --i2caddress <i2c address> --i2cport <i2c port> --wapi <weather underground api key> --wlocale <weather location> --timezone <timezone> --time24hour --temperature <fahrenheit or celcius> --mpd --spop --lms --rune --volumio --pages <pagefile> --lmsplayer <mac address of lms player> --showupdates'
			sys.exit()
		elif opt in (u"-d", u"--driver"):
			driver = arg
		elif opt in (u"--devicetype"):
			devicetype = arg
		elif opt in ("--rs"):
			pin_rs  = int(arg)
		elif opt in ("--e"):
			pin_e  = int(arg)
		elif opt in ("--d4"):
			pin_d4  = int(arg)
		elif opt in ("--d5"):
			pin_d5  = int(arg)
		elif opt in ("--d6"):
			pin_d6  = int(arg)
		elif opt in ("--d7"):
			pin_d7  = int(arg)
		elif opt in ("--i2caddress"):
			i2c_address = int(arg,0)
		elif opt in ("--i2cport"):
			i2c_port = int(arg,0)
		elif opt in ("--width"):
			cols = int(arg,0)
		elif opt in ("--height"):
			rows = int(arg,0)
		elif opt in (u"--wapi"):
			pydPiper_config.WUNDER_API = arg
		elif opt in (u"--wlocale"):
			pydPiper_config.WUNDER_LOCATION = arg
		elif opt in (u"--timezone"):
			pydPiper_config.TIMEZONE = arg
		elif opt in (u"--time24hour"):
			pydPiper_config.TIME24HOUR = True
		elif opt in (u"--temperature"):
			pydPiper_config.TEMPERATURE = arg
		elif opt in (u"--mpd"):
			services_list.append(u'mpd')
		elif opt in (u"--spop"):
			services_list.append(u'spop')
		elif opt in (u"--lms"):
			services_list.append(u'lms')
		elif opt in (u"--lmsplayer"):
			pydPiper_config.LMS_PLAYER = arg
		elif opt in (u"--rune"):
			services_list.append(u'rune')
		elif opt in (u"--volumio"):
			services_list.append(u'volumio')
		elif opt in (u"--pages"):
			pagefile = arg
			# print u"Loading {0} as page file".format(arg)
			# If page file provided, try to load provided file on top of default pages file
			# try:
			# 	newpages = imp.load_source(u'pages', arg)
			# 	if validpages(newpages):
			# 		pages = newpages
			# 	else:
			# 		print u"Invalid page file provided.  Using default pages."
			# except IOError:
			# 	# Page file not found
			# 	print u"Page file {0} not found.  Using default pages".format(arg)

		elif opt in (u"--showupdates"):
			showupdates = True

	pydPiper_config.DISPLAY_SIZE = (cols, rows)

	pins_data = [pin_d4, pin_d5, pin_d6, pin_d7]

	if len(services_list) == 0:
		logging.critical(u"Must have at least one music service to monitor")
		sys.exit()

	logging.info(pydPiper_config.STARTUP_LOGMSG)

	dq = Queue.Queue()



	# Choose display

	if not driver:
		try:
			driver = pydPiper_config.DISPLAY_DRIVER
		except:
			drvier = u''

	if not devicetype:
		try:
			devicetype = pydPiper_config.DISPLAY_DEVICETYPE
		except:
			devicetype = u''


	if driver == u"winstar_weg":
		lcd = displays.winstar_weg.winstar_weg(rows, cols, pin_rs, pin_e, pins_data)
	elif driver == u"hd44780":
		lcd = displays.hd44780.hd44780(rows, cols, pin_rs, pin_e, pins_data)
	elif driver == u"hd44780_i2c":
		lcd = displays.hd44780_i2c.hd44780_i2c(rows, cols, i2c_address, i2c_port)
	elif driver == u"ssd1306_i2c":
		lcd = displays.ssd1306_i2c.ssd1306_i2c(rows, cols, i2c_address, i2c_port)
	elif driver == u"luma_i2c":
		lcd = displays.luma_i2c.luma_i2c(rows, cols, i2c_address, i2c_port, devicetype)
	elif driver == u"curses":
		lcd = displays.curses.curses(rows, cols)
	else:
		logging.critical(u"No valid display found")
		sys.exit()

	lcd.clear()
	dc = displays.display.display_controller(pydPiper_config.DISPLAY_SIZE)
	mc = music_controller(services_list, dc, showupdates)
	time.sleep(2)
	mc.start()
	dc.load(pagefile, mc.musicdata,mc.musicdata_prev )

	try:
		while True:
			# Get next image and send it to the display every .1 seconds
			with mc.musicdata_lock:
				img = dc.next()
#			displays.graphics.update(img)
			lcd.update(img)
			time.sleep(pydPiper_config.ANIMATION_SMOOTHING)


	except KeyboardInterrupt:
		pass

	finally:
		print u"Shutting down threads"
		exitapp[0] = True
		try:
			lcd.clear()
			lcd.message(u"Exiting...")
			time.sleep(3)
			lcd.clear()
			lcd.cleanup()
		except:
			pass
		mc.join()
		logging.info(u"Exiting...")
