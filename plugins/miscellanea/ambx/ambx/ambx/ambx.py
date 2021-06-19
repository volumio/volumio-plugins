# Copyright (c) 2009, Martijn de Boer, Gert-Jan de Boer All rights reserved.

# Redistribution and use in source and binary forms, with or without
# modification, are permitted provided that the following conditions are met:

# - Redistributions of source code must retain the above copyright notice, this
#   list of conditions and the following disclaimer.
# - Redistributions in binary form must reproduce the above copyright notice,
#   this list of conditions and the following disclaimer in the documentation
#   and/or other materials provided with the distribution.
# - Neither the name of the copyright holders nor the names of its contributors
#   may be used to endorse or promote products derived from this software
#   without specific prior written permission.

# THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
# AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
# IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
# DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
# FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
# DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
# SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
# CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
# OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
# OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
import usb
import logging

logger = logging.getLogger("AMBX")

# Usb identification
VENDOR  = 0x0471
PRODUCT = 0x083f

# Endpoints
EP_IN = 0x81
EP_OUT = 0x02
EP_PNP = 0x83

# Packet header
PKT_HEADER = 0xA1

# -- Commands --
# Set a single color, for a specific light
# Params 0xRR 0xGG 0xBB
# 0xRR = Red color
# 0xGG = Green color
# 0xBB = Blue color
SET_LIGHT_COLOR = 0x03

# Set a color sequence using delays
# Params 0xMM 0xMM then a repeated sequence of 0xRR 0xGG 0xBB
# 0xMM = milliseconds
# 0xMM = milliseconds
# 0xRR = Red color
# 0xGG = Green color
# 0xBB = Blue color
SET_TIMED_COLOR_SEQUENCE = 0x72

# Set the fan rotation speed
# Params:
# Speed: 0x00-0xFF
SET_FAN_SPEED = 0x01

# Lights
class Lights:
    # LEFT/RIGHT lights. Normally placed adjecent to your screen.
    LEFT = 0x0B
    RIGHT = 0x1B

    # Wallwasher lights. Normally placed behind your screen.
    WWLEFT = 0x2B
    WWCENTER = 0x3B
    WWRIGHT = 0x4B

# Fans
class Fans:
    LEFT = 0x5B
    RIGHT = 0x6B

# Timeouts
TIMEOUT_LIBUSBC = 2500
TIMEOUT_LIBUSBR = 2500
TIMEOUT_LIBUSBW = 2500

def float_to_rgb8(color):
    return [min(max(int(x*256.0),0),255) for x in color]

class AMBX(object):
    def __init__(self, dev=0, usbdev=None):
        self._log = logging.getLogger("AMBX.%i" % dev)
        if usbdev is None:
            devs = devices_by_vendor_product(VENDOR, PRODUCT)
            self._devptr = devs[dev]
        else:
            self._devptr = usbdev
        self.num = dev
        self._init_hw()

    def _init_hw(self):
        self._log.debug("Opening device")
        self._dev = self._devptr.open()
        self._log.debug("Claiming interface 0")
        self._dev.claimInterface(0)
        self._log.debug("Initialisation succesful")

    def write(self, data, timeout=TIMEOUT_LIBUSBW):
        '''Write command data to device'''
        return self._dev.interruptWrite(EP_OUT, data, timeout)

    def set_color_rgb8(self, light, color):
        '''Set light color'''
        self.write(bytes([PKT_HEADER, light, SET_LIGHT_COLOR, color[0], color[1], color[2]]))

    def set_color_float(self, light, color):
        self.set_color_rgb8(light, float_to_rgb8(color))

    def set_sequence_rgb8(self, light, millis, colors):
        '''Set light color sequence'''
        assert(millis >= 0 and millis <= 0xffff)
        assert(len(colors) == 16) # must be 16 colors
        pkt = [PKT_HEADER, light, SET_TIMED_COLOR_SEQUENCE, millis >> 8, millis & 255]
        for color in colors:
            assert(len(color) == 3)
            pkt.extend(color)
        self.write(bytes(pkt))

    def set_sequence_float(self, light, millis, colors):
        self.set_sequence_rgb8(light, millis, [float_to_rgb8(color) for color in colors])

    def set_fan_speed(self, fan, speed):
        self.write(bytes([PKT_HEADER, fan, SET_FAN_SPEED, speed]))


def devices_by_vendor_product(vendor, product):
    '''
    Enumerate all USB devices with the right vendor
    and product ID
    '''
    devs = []
    logger.debug("Enumerating devices")
    for bus in usb.busses():
        for device in bus.devices:
            if device.idVendor==vendor and device.idProduct==product:
                logger.debug("Found device %i on %s:%s", len(devs), bus.dirname, device.filename)
                devs.append(device)
    return devs
