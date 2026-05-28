# Levi Morris 5/28/2025
# This code is for the master microbit to act as a bridge between the S4 emulator and the payload microbits

#6/6/25
# tested and working on the s4 emmulator

#7/15/25
# this code has been tested with the S4 EM and is ready for live testing

#7/23/25
# updated to be non-blocking. this means that requesting to downlink does not lock the proccessor into waiting for the S4.
# tested on the emulator--> needs EM testing and maybe a deep code review

# updated to use pull-based radio communication:
# master discovers slaves on boot, then polls them one by one on a cycle.
# slaves must respond to DISCOVER and POLL control packets (see s4comm.py).

"""
Notes

-this code is working under the idea that it is sending 0xf5 downlinks
--> that may not be the case based on how Jeff configures it
--> health and saftey integration will probably look a lot different

-non-blocking means that the proceessor can do other things will it sits around waiting on the S4
--> allows new messages to be loaded into the buffer while waiting
--> easy additions to the code (if we want the master to control or poll other things)
--> makes the code harder to read (sorry future ppl)

"""

#NOTES ABT S4 --> BUS CONNECTOR
"""
3V3 - 1, 3*
GND - 6,7,8,13,14
CTS PIN - 9
RTS PIN - 10
BUS RX - 11
BUS TX - 12

*only if switch two is active
"""

#NOTES ABT S4 --> DIRECT WIRING
"""
3V3 - N/A *
GND - JP3.14
CTS PIN - TBD -- JP3.9-11
RTS PIN - TBD -- JP3.9-11
BUS RX - JP5.1
BUS TX - JP5.2

*no active 3V3 supply
"""

from microbit import *
from microbit import uart
import radio
import os

#allows certain pins to be used for serial communication
display.off()

#MICROBIT RADIO
MB_CHANNEL = 7
MB_GROUP = 23
radio.config(channel=MB_CHANNEL,group=MB_GROUP)
radio.config(queue=64) #large queue so HERE responses from any number of slaves are buffered
radio.on()

#serial stuff
BW = 38400
PACKETSIZE = 205
PAYLOADSIZE = 11

#pins
PIN_TX = pin13
PIN_RX = pin14
PIN_CTS = pin5
PIN_RTS = pin8

#states/flags
debug = True #sends debug messages to the console
communicatingS4 = False #is the MMB in the proccess of communicating
waitingCTS = False #is the MMB waiting for CTS to go high
waitingACK = False #is the MMB weiting for a response from the s4
waitingPASS = False #is the MMB waiting for pass/fail on transmission
stageTime = 0 #timer for each stage

#buffer
MAX_DOWNLINK_TIME = 60000
MIN_DOWNLINK_TIME = 15000 #lowerd a little for testing
PAYLOAD_COUNT = 18 #max payloads per downlink packet (floor(200/11) = 18, Eyestar 200-byte limit)
DOWNLINK_BUFFER_SIZE = PAYLOADSIZE * PAYLOAD_COUNT #must be <= 200 for Eyestar payload limit

downlinkBuffer = bytearray(DOWNLINK_BUFFER_SIZE)
packet = bytearray(PACKETSIZE)
downlinkBufferIndex = 0

# Pull protocol - control packet bytes shared with s4comm.py slaves
CTRL_MAGIC = 0xAA   # marks a control (non-data) radio packet
CMD_DISCOVER = 0xD0 # master -> all slaves: announce yourself
CMD_HERE = 0xD1     # slave -> master: I exist at this microbit_id
CMD_POLL = 0xD2     # master -> one slave: send me your data now

# Slave registry
known_slaves = []   # validated slave IDs; only ever grows
miss_counts = {}    # {slave_id: consecutive_miss_count}
MAX_MISSES = 3      # consecutive timeouts before a slave is marked inactive

# Poll state
pollingActive = False
pollingSlave = 0        # microbit_id of the slave currently being polled
pollSentTime = 0
poll_index = 0          # position in known_slaves for the next poll
lastDiscoverySend = 0   # last time a DISCOVER beacon was sent
cycleComplete = False   # set when poll_index wraps; triggers partial-buffer downlink

POLL_RESPONSE_TIMEOUT = 500  # ms to wait for a slave to reply before moving on
DISCOVER_IDLE_INTERVAL = 1000  # ms between beacons when no slaves are known yet


#sends an intial message to show that microbit is working
uart.init(115200)
PIN_RTS.write_digital(0) #ensure RTS is pulled low at start
print("micro:bit is alive...") #runs regardless of debug state

#sets the microbits serial output to the TX/RX
uart.init(baudrate=BW, bits=8, parity=None, stop=1, tx=PIN_TX, rx=PIN_RX)


#helper functions

"""
Log important events

"""

PIN_RTS.write_digital(1)
sleep(2000)
PIN_RTS.write_digital(0)

def log(event):
    #have to do this mess bc no append mode in micro:bits
    try:
        existing = ""
        if "log.txt" in os.listdir():
            with open('log.txt', 'r') as f:
                existing = f.read()

            #Append new data
            new_log = existing + (str(running_time()) + ': ' + event + '\n') + '\n'

            #Write everything back
            with open('log.txt', 'w') as f:
                f.write(new_log)
        else:
            with open('log.txt', 'w') as f:
                f.write(str(running_time()) + ': ' + event + '\n' + '\n')

    except Exception as e:
        print("Log error:", e)

def dumpLog():
    if "log.txt" in os.listdir():
        with open('log.txt', 'r') as logf:
            contents = logf.read()
            contents = contents.split('\n')
        return contents
    else:
        return ""


#init log
log("mirco:bit started.")

"""
returns true if the message was recieved (ACK)
"""
def checkInitialResponse(buf):
    if len(buf) < 3:
        return False

    if buf[0] == 0xAA and buf[1] == 0x05:
        if buf[2] == 0X00:
            return True
        elif buf[2] == 0xFF:
            return False
    else:
        return False

"""
verifies response packets from the S4
"""
def checkResponsePacket(packet):
    if len(packet) == 1:
        return packet[0] == 0xf5

    if len(packet) == 2:
        outputConsole("ResponsePacket: " + str(packet))
        return packet[0] == 0xf5 and packet[1] != 0xff

    #potential to build more functionality to this

    if len(packet) > 205:
        return 0

    if packet[0] == packet[1] == packet[2] == 0x50:
        return 0


    return 0


"""
outputs to the console when in debug mode
switches the serial from pin to usb and then back to pin
"""
def outputConsole(message):
    if not debug:
        return

    #return to console for debugging
    uart.init(115200)

    sleep(10)

    print(message)

    #go back to serial via pins
    uart.init(baudrate=BW, bits=8, parity=None, stop=1, tx=PIN_TX, rx=PIN_RX)
    sleep(10)

"""
constructs a packet to send to the s4

"""
def constructDownlinkPacket(contents, functionByte = 0xf5):
    if not isinstance(contents, bytes) and not isinstance(contents, bytearray):
        outputConsole("Packet contents are not in byte-form")
        outputConsole(str(type(contents)))
        return 0
    #use the eyestar protocol, 205 bytes
    length = len(contents)
    if length < 8 or length > 200:
        outputConsole("too much packet yo")
        return 0

    #add the initial bytes for the protocal and size of the message (bytes)
    packet= bytearray([0x50, 0x50, 0x50, functionByte])
    packet.append(length)

    for i in contents:
        packet.append(i)

    #fill in the remaining bytes
    while len(packet) < PACKETSIZE:
        packet.append(0)
    return packet

"""
Send Payload Data to Ground
Function Byte: 0xf5
200 bytes max
"""
def requestDownlink(packet):
    global communicatingS4, stageTime, waitingCTS, waitingACK, waitingPASS

    if waitingCTS:
        #wait for CTS high from emulator #45s timeout
        if running_time() - stageTime >= 45000:
            outputConsole("S4 timed out")
            PIN_RTS.write_digital(0)
            waitingCTS = False
            communicatingS4 = False

        if PIN_CTS.read_digital() == 1:
            waitingCTS = False

            #payload set RTS to low
            PIN_RTS.write_digital(0)

            #sleep in accordance with the protocol
            sleep(1)

            #writes data to tx line
            uart.write(packet)

            waitingACK = True
            stageTime = running_time()
            sleep(10)  # Give the receiver time to process


    #check whether the S4 recieved the request correctly
    if waitingACK == True:
        if running_time() - stageTime > 5000: #should recieve ACK or NAK in 5 seconds
            waitingACK = False
            communicatingS4 = False
            outputConsole("S4 did not respond")


        if uart.any():
            msgBytes = uart.read()

            outputConsole(msgBytes)

            if checkInitialResponse(msgBytes):
                outputConsole("ACK")
                waitingACK = False
                waitingPASS = True
                outputConsole("waiting for Pass/Fail")
            else:
                outputConsole("NAK")
                waitingACK = False
                communicatingS4 = False


            stageTime = running_time()

    if waitingPASS:
        #test if downlink was successful
        if running_time() - stageTime > 35000: #S4 should send PASS or FAIL under 35 seconds
            communicatingS4 = False
            waitingPASS = False
            outputConsole("S4 (PASS/FAIL) response timeout")

        if uart.any():
            msgBytes = uart.read()
            if checkResponsePacket(msgBytes):
                outputConsole("pass")
            else:
                outputConsole("fail")

            waitingPASS = False
            communicatingS4 = False

"""
Downlink Buffer

"""
def addPayloadData(data, downlinkBuffer, downlinkBufferIndex):
    #payload sends PAYLOADSIZE bytes
    if len(data) == PAYLOADSIZE:

        #optional formating
        formatedData = bytearray(PAYLOADSIZE)
        for i in range(0,PAYLOADSIZE):
            formatedData[i] = data[i]

        if downlinkBufferIndex < PAYLOAD_COUNT:
            start = downlinkBufferIndex * PAYLOADSIZE
            for i in range(0,PAYLOADSIZE):
                downlinkBuffer[start+i] = formatedData[i]
            return downlinkBufferIndex + 1  #Return updated index
        else:
            outputConsole("Buffer is full")
            return downlinkBufferIndex

    if len(data) == 32: #handle 32 byte payloads (locked buffersize in js radio lib)
        return addPayloadData(data[13:(13 + PAYLOADSIZE)], downlinkBuffer, downlinkBufferIndex) #actaual packet starts at index 13 when sending packets with the js lib
    else:
        outputConsole("Attempted to add invalid data -> length: " + str(len(data)))
        return downlinkBufferIndex

def resetBuffer():
    return bytearray(DOWNLINK_BUFFER_SIZE), 0  # Return new buffer and index


"""
Pull Polling

managePoll    -- non-blocking state machine: cycles through known_slaves in sorted
                 order, polling one at a time; fires a DISCOVER beacon at the end
                 of each full cycle to pick up new or returning slaves
handleRadioMsg -- processes one radio message per tick; handles HERE responses
                  (discovery) and data responses (poll replies)
"""

def managePoll():
    global pollingActive, pollingSlave, pollSentTime, poll_index, lastDiscoverySend

    now = running_time()

    # No slaves known yet - broadcast beacons until one responds
    if len(known_slaves) == 0:
        if now - lastDiscoverySend >= DISCOVER_IDLE_INTERVAL:
            radio.send_bytes(bytearray([CTRL_MAGIC, CMD_DISCOVER, 0xFF]))
            lastDiscoverySend = now
        return

    if not pollingActive:
        # Completed a full cycle - fire a discover beacon (throttled) for new/returning slaves
        if poll_index >= len(known_slaves):
            poll_index = 0
            cycleComplete = True  # signal main loop to downlink any partial buffer
            if now - lastDiscoverySend >= DISCOVER_IDLE_INTERVAL:
                radio.send_bytes(bytearray([CTRL_MAGIC, CMD_DISCOVER, 0xFF]))
                lastDiscoverySend = now

        # Find next active slave, skipping offline ones
        attempts = 0
        while attempts < len(known_slaves):
            if poll_index >= len(known_slaves):
                break  # ran off the end; cycle-end check handles reset on next call
            candidate = known_slaves[poll_index]
            poll_index += 1
            attempts += 1
            if miss_counts.get(candidate, 0) < MAX_MISSES:
                pollingSlave = candidate
                radio.send_bytes(bytearray([CTRL_MAGIC, CMD_POLL, pollingSlave]))
                pollingActive = True
                pollSentTime = now
                break
    else:
        # Give up waiting and move on
        if now - pollSentTime >= POLL_RESPONSE_TIMEOUT:
            pollingActive = False
            prev = miss_counts.get(pollingSlave, 0)
            miss_counts[pollingSlave] = prev + 1
            if miss_counts[pollingSlave] == MAX_MISSES:
                outputConsole("Slave offline: " + hex(pollingSlave))
                log("Slave offline: " + hex(pollingSlave))

def handleRadioMsg():
    global downlinkBufferIndex, pollingActive

    msg = radio.receive_bytes()
    if msg is None:
        return

    # --- Control packet: exactly 3 bytes starting with CTRL_MAGIC ---
    if len(msg) == 3 and msg[0] == CTRL_MAGIC:
        if msg[1] == CMD_HERE:
            slave_id = msg[2]
            if slave_id not in known_slaves:
                known_slaves.append(slave_id)
                known_slaves.sort()
                log("Slave found: " + hex(slave_id))
                outputConsole("Slave found: " + hex(slave_id))
            elif miss_counts.get(slave_id, 0) >= MAX_MISSES:
                # Previously offline slave is back
                outputConsole("Slave back online: " + hex(slave_id))
                log("Slave back online: " + hex(slave_id))
            miss_counts[slave_id] = 0  # reset whether new or returning
        return  # control packets never go into the data buffer

    # --- Data packet: only accepted while we're waiting on a specific slave ---
    if not pollingActive:
        return

    if isinstance(msg, str):
        content = bytearray(msg, 'utf-8')
    elif isinstance(msg, (bytes, bytearray)):
        content = bytearray(msg)
    else:
        outputConsole("invalid radio type: " + str(type(msg)))
        return

    # Confirm the packet came from the slave we polled (byte 0 = microbit_id)
    if len(content) == PAYLOADSIZE and content[0] == pollingSlave:
        outputConsole("Poll resp " + hex(pollingSlave) + ": " + str(content))
    elif len(content) == 32 and content[13] == pollingSlave:  # js radio lib compat
        outputConsole("Poll resp (js) " + hex(pollingSlave) + ": " + str(content[13:13+PAYLOADSIZE]))
    else:
        return  # not from the slave we polled, discard

    if downlinkBufferIndex >= PAYLOAD_COUNT:
        log("buffer was full!")
        outputConsole("buffer is full, dropping data")
    else:
        downlinkBufferIndex = addPayloadData(content, downlinkBuffer, downlinkBufferIndex)

    miss_counts[pollingSlave] = 0  # successful response, slave is alive
    pollingActive = False  # move to next slave on next tick


"""
Main loop
Polls known slaves one-by-one. Fires a DISCOVER beacon at the end of each
full poll cycle so new/returning slaves are picked up without any dead time.
"""
time0 = running_time()

while True:
    #send the buffer to the s4 after a certain time or the buffer is full
    timer = running_time() - time0
    if ((timer > MAX_DOWNLINK_TIME) or
            (downlinkBufferIndex >= PAYLOAD_COUNT) or
            (cycleComplete and downlinkBufferIndex > 0)) and not communicatingS4:
        cycleComplete = False
        outputConsole("attempting to request downlink")
        communicatingS4 = True

        #clear serial
        if uart.any():
            uart.read()

        #build packet for emulator -- use eyestar protocal
        packet = constructDownlinkPacket(downlinkBuffer, 0xF5)

        #check if this creates a valid packet
        if packet:
            #payload sets RTS high
            PIN_RTS.write_digital(1)
            waitingCTS = True
            stageTime = running_time()
            outputConsole("valid packet created")
        else:
            outputConsole("invalid packet created")
            communicatingS4 = False

        #reset the buffer
        downlinkBuffer, downlinkBufferIndex = resetBuffer()

        time0 = running_time() #reset timer


    if communicatingS4 == True:
        requestDownlink(packet) #non-blocking implementation

    if not communicatingS4:
        managePoll()     # pause polling during S4 downlink so buffer can't overflow
    handleRadioMsg() # always run so HERE responses (discovery) are never missed

    #dump the contents of the log to serial (usb)
    if button_b.is_pressed():
        with open('log.txt', 'r') as f:
            outputConsole(f.read())

    #give some time for the microbit to chill
    sleep(10)
