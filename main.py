"""

These should be the blocks required for students to interact with the s4
by MakeCode

"""
# % color="#4beb36"
@namespace
class S4comms:
    default_channel = 23
    default_power = 7
    student_id = 0xFF
    payloadInterval = 10000
    intervalTime = input.running_time()
    """
    
    Helper function to build the packets we want to send to master micro:bit
    
    
    """
    def constructPacket(id: number, temp: number, data1: number, data2: number, data3: number):
        packet = bytearray(8)
        # single byte id and temp
        packet.set_number(NumberFormat.UINT8_LE, 0, id)
        # Byte 0
        packet.set_number(NumberFormat.INT8_LE, 1, temp)
        # Byte 1
        # 3 2 byte shorts
        packet.set_number(NumberFormat.INT16_LE, 2, data1)
        # Byte 2-3
        packet.set_number(NumberFormat.INT16_LE, 4, data2)
        # Byte 4-5
        packet.set_number(NumberFormat.INT16_LE, 6, data3)
        # Byte 6-7
        return packet
    """
    
    This should be placed in the start up section
    @param id Payload identifier (0–255)
    @param frequency The number of milliseconds to wait before sending next packet
    
    """
    # % block="init with id $id sending every $frequency ms"
    # % weight=90
    # % group="Radio"
    # % inlineInputMode=inline
    def init(id: number, frequency: number):
        global payloadInterval, student_id
        payloadInterval = frequency
        student_id = id
        radio.set_transmit_power(default_power)
        radio.set_frequency_band(default_channel)
        radio.on()
    """
    
    Sends a downlink packet if enough time has passed
    @param id Payload identifier (0–255)
    @param temp Temperature to include (-128 to 127)
    @param data1 First data value, signed short
    @param data2 Second data value, signed short
    @param data3 Third data value, signed short
    
    """
    # % block="request downlink with id $id temp $temp data1 $data1 data2 $data2 data3 $data3"
    # % weight=90
    # % group="Radio"
    # % inlineInputMode=inline
    def downlink(id: number, temp2: number, data1: number, data2: number, data3: number):
        global intervalTime
        if input.running_time() - intervalTime >= payloadInterval:
            packet2 = constructPacket(id, temp2, data1, data2, data3)
            radio.send_buffer(packet2)
            intervalTime = input.running_time()