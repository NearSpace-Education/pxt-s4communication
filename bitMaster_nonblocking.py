# Levi Morris 5/28/2025
# This code is for the master microbit to act as a bridge between the S4 emulator and the payload microbits

#6/6/25
# tested and working on the s4 emmulator

#7/15/25
# this code has been tested with the S4 EM and is ready for live testing

#7/23/25
# updated to be non-blocking. this means that requesting to downlink does not lock the proccessor into waiting for the S4.
# tested on the emulator--> needs EM testing and maybe a deep code review

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
radio.config(queue=10) #max number of messages left on the builtin queue
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
PAYLOAD_COUNT = 10 #number of payloads #leave at 10 unless u got something specific to do
DOWNLINK_BUFFER_SIZE = PAYLOADSIZE * PAYLOAD_COUNT #must be <= 200 for Eyestar payload limit

downlinkBuffer = bytearray(DOWNLINK_BUFFER_SIZE)
packet = bytearray(PACKETSIZE)
downlinkBufferIndex = 0

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
Main loop
constantly listening for payload messages 
and sending after an interval or the buffer is filled
"""
time0 = running_time()
while True:
    #send the buffer to the s4 after a certain time or the buffer is full
    timer = running_time() - time0
    if ((timer > MAX_DOWNLINK_TIME) or (timer > MIN_DOWNLINK_TIME and downlinkBufferIndex >= PAYLOAD_COUNT)) and not communicatingS4:
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


    #listen on the radio
    payloadMsg = radio.receive_bytes()
    if payloadMsg is not None:  
        if isinstance(payloadMsg, str):
            content = bytearray(payloadMsg, 'utf-8')
        elif isinstance(payloadMsg, bytes):
            content = payloadMsg
        else:
            outputConsole("invalid data! - " + str(type(payloadMsg)))
            continue

        if len(content) == PAYLOADSIZE:
            outputConsole("Data recieved: " + str(content) + " i: " + str(downlinkBufferIndex))
        if len(content) == 32: #js lib compatibility
            outputConsole("Data recieved: " + str(content[13:(13+PAYLOADSIZE)]) + " i: " + str(downlinkBufferIndex))
        if downlinkBufferIndex >= PAYLOAD_COUNT:
            log("buffer was full!")
            outputConsole("buffer is full, dropping data")
        else:     
            downlinkBufferIndex = addPayloadData(content, downlinkBuffer, downlinkBufferIndex)


    #dump the contents of the log to serial (usb)
    if button_b.is_pressed():
        with open('log.txt', 'r') as f:
            outputConsole(f.read())
    
    #give some time for the microbit to chill
    sleep(10)
