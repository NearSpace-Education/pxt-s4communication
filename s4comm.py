"""
Simple library to allow students to connect to the S4

"""

import struct

from microbit import *
import radio

# Packet Type Enumeration
class PacketType:
    BASIC = 0           # int8, int32, int32
    FLEX_BASIC = 1      # int8, int16, int16, int32
    EXTENDED_BASIC = 2  # int8, int16, int16, int16, int16
    FLOAT = 3           # int8, float32, float32
    BALANCED = 4        # int8, int32, float32
    BETTER_BALANCE = 5  # int8, int16, int16, float32
    SILLY = 6           # float32, char×5
    STRING = 7          # char×9


class s4comm():
    """data members"""
    microbit_id = 0x01  # First byte in every packet
    id = 0xff
    interval = 5000 #mim interval to prevent spamming
    default_group = 23
    default_channel = 7
    default_power = 7
    interval_time = running_time()

    """Public methods"""
    
    #get the class and the radio ready
    def init(self, payloadID, microbitID=None):
        self.id = payloadID
        if microbitID is not None:
            self.microbit_id = microbitID & 0xFF
        self.interval_time = running_time()
        radio.config(channel = self.default_channel, group = self.default_group, power = self.default_power)
        radio.on()

    def setMicrobitID(self, microbitID):
        self.microbit_id = microbitID & 0xFF

    #send a data packet to the master:bit to compile and send to the S4 for downlink
    def sendMaster(self, packType, *args):
        if running_time() - self.interval_time >= self.interval:
            radio.send_bytes(self._constructPacket(packType, *args))
            self.interval_time = running_time()
            display.show(Image.HAPPY)
            sleep(1000)
            display.clear()
    
    # Convenience methods using PacketType enum
    def sendBasic(self, temp, data1, data2):
        """Send Basic packet: int8, int32, int32"""
        self.sendMaster(PacketType.BASIC, temp, data1, data2)
    
    def sendFlexBasic(self, int8_val, short1, short2, int32_val):
        """Send FlexBasic packet: int8, int16, int16, int32"""
        self.sendMaster(PacketType.FLEX_BASIC, int8_val, short1, short2, int32_val)
    
    def sendExtendedBasic(self, int8_val, short1, short2, short3, short4):
        """Send ExtendedBasic packet: int8, int16, int16, int16, int16"""
        self.sendMaster(PacketType.EXTENDED_BASIC, int8_val, short1, short2, short3, short4)
    
    def sendFloat(self, int8_val, float1, float2):
        """Send Float packet: int8, float32, float32"""
        self.sendMaster(PacketType.FLOAT, int8_val, float1, float2)
    
    def sendBalanced(self, int8_val, int32_val, float32_val):
        """Send Balanced packet: int8, int32, float32"""
        self.sendMaster(PacketType.BALANCED, int8_val, int32_val, float32_val)
    
    def sendBetterBalance(self, int8_val, short1, short2, float32_val):
        """Send BetterBalance packet: int8, int16, int16, float32"""
        self.sendMaster(PacketType.BETTER_BALANCE, int8_val, short1, short2, float32_val)
    
    def sendSilly(self, float32_val, text):
        """Send Silly packet: float32, char×5"""
        self.sendMaster(PacketType.SILLY, float32_val, text)
    
    def sendString(self, text):
        """Send String packet: char×9"""
        self.sendMaster(PacketType.STRING, text)

    """private methods"""

    def _constructPacket(self, packType, *args):
            # Constructs the packet to be sent - 11 bytes long
            # Byte 0: microbit ID (byte 1 in human counting)
            # Byte 1: generated ID (team ID + packet type)
            # Bytes 2-10: payload data based on packet type
            packet = bytearray(11)
            packet[0] = self.microbit_id
            packet[1] = self._generateID(packType)

            if packType == PacketType.BASIC:  # int8, int32, int32
                temp = args[0] if len(args) > 0 else 0
                data1 = args[1] if len(args) > 1 else 0
                data2 = args[2] if len(args) > 2 else 0

                packet[2] = temp & 0xFF
                packet[3] = (data1 >> 24) & 0xFF
                packet[4] = (data1 >> 16) & 0xFF
                packet[5] = (data1 >> 8) & 0xFF
                packet[6] = data1 & 0xFF
                packet[7] = (data2 >> 24) & 0xFF
                packet[8] = (data2 >> 16) & 0xFF
                packet[9] = (data2 >> 8) & 0xFF
                packet[10] = data2 & 0xFF

            elif packType == PacketType.FLEX_BASIC:  # FlexBasic: int8, int16, int16, int32
                int8_val = args[0] if len(args) > 0 else 0
                short1 = args[1] if len(args) > 1 else 0
                short2 = args[2] if len(args) > 2 else 0
                int32_val = args[3] if len(args) > 3 else 0
                packet[2] = struct.pack('b', int8_val)[0]
                packet[3:5] = struct.pack('>h', short1)  # big-endian int16
                packet[5:7] = struct.pack('>h', short2)  # big-endian int16
                packet[7:11] = struct.pack('>i', int32_val)  # big-endian int32

            elif packType == PacketType.EXTENDED_BASIC:  # int8, int16, int16, int16, int16
                int8_val = args[0] if len(args) > 0 else 0
                short1 = args[1] if len(args) > 1 else 0
                short2 = args[2] if len(args) > 2 else 0
                short3 = args[3] if len(args) > 3 else 0
                short4 = args[4] if len(args) > 4 else 0
                packet[2] = int8_val & 0xFF
                packet[3] = (short1 >> 8) & 0xFF
                packet[4] = short1 & 0xFF
                packet[5] = (short2 >> 8) & 0xFF
                packet[6] = short2 & 0xFF
                packet[7] = (short3 >> 8) & 0xFF
                packet[8] = short3 & 0xFF
                packet[9] = (short4 >> 8) & 0xFF
                packet[10] = short4 & 0xFF

            elif packType == PacketType.FLOAT:  # Float: int8, float32, float32
                int8_val = args[0] if len(args) > 0 else 0
                float1 = args[1] if len(args) > 1 else 0.0
                float2 = args[2] if len(args) > 2 else 0.0
                packet[2] = struct.pack('b', int8_val)[0]
                packet[3:7] = struct.pack('>f', float1)  # big-endian float32
                packet[7:11] = struct.pack('>f', float2)  # big-endian float32

            elif packType == PacketType.BALANCED:  # Balanced: int8, int32, float32
                int8_val = args[0] if len(args) > 0 else 0
                int32_val = args[1] if len(args) > 1 else 0
                float32_val = args[2] if len(args) > 2 else 0.0
                packet[2] = struct.pack('b', int8_val)[0]
                packet[3:7] = struct.pack('>i', int32_val)  # big-endian int32
                packet[7:11] = struct.pack('>f', float32_val)  # big-endian float32

            elif packType == PacketType.BETTER_BALANCE:  # BetterBalance: int8, int16, int16, float32
                int8_val = args[0] if len(args) > 0 else 0
                short1 = args[1] if len(args) > 1 else 0
                short2 = args[2] if len(args) > 2 else 0
                float32_val = args[3] if len(args) > 3 else 0.0
                packet[2] = struct.pack('b', int8_val)[0]
                packet[3:5] = struct.pack('>h', short1)  # big-endian int16
                packet[5:7] = struct.pack('>h', short2)  # big-endian int16
                packet[7:11] = struct.pack('>f', float32_val)  # big-endian float32

            elif packType == PacketType.SILLY:  # Silly: float32, charx5
                float32_val = args[0] if len(args) > 0 else 0.0
                text = str(args[1]) if len(args) > 1 else ""
                packet[2:6] = struct.pack('>f', float32_val)  # big-endian float32
                # Convert text to bytes and pad/truncate to 5 characters
                text_bytes = text.encode('ascii', errors='ignore')[:5]
                packet[6:6+len(text_bytes)] = text_bytes

            elif packType == PacketType.STRING:  # String: charx9
                text = str(args[0]) if len(args) > 0 else ""
                # Convert text to bytes and pad/truncate to 9 characters
                text_bytes = text.encode('ascii', errors='ignore')[:9]
                packet[2:2+len(text_bytes)] = text_bytes

            return packet
    
    def _generateID(self, pacType):
        # Bits 0-4: Team ID (5 bits)
        # Bits 5-7: Packet type (3 bits)
        new_id = ((self.id & 0x1f)) | ((pacType & 0x07) << 5)
        return new_id

comm = s4comm()
comm.init(3)

comm.interval = 5000 # 5 seconds

while True:
    l1 = display.read_light_level()
    sleep(10)
    l2 = display.read_light_level()
    sleep(10)
    l3 = display.read_light_level()
    sleep(10)
    l4 = display.read_light_level()
    sleep(10)
    l5 = display.read_light_level()

    comm.sendExtendedBasic(l1, l2, l3, l4, l5)
    sleep(100)

