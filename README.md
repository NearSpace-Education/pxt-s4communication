Skip to content
Chat history

You said:
r /**
 * These should be the blocks required for students to interact with the s4
 * by MakeCode
 */

//% color="#4beb36"
namespace S4comms {
    let default_channel = 7
    let default_group = 23 
    let default_power = 7
    let student_id = 0xFF
    let payloadInterval = 10000
    let intervalTime = input.runningTime()

    /**
     * Helper function to build the packets we want to send to master micro:bit
     * 
     */
    function constructPacket(id: number, temp: number, data1: number, data2: number, data3: number): Buffer {
        let packet = pins.createBuffer(8)

        // clamp ranges
        temp = Math.max(-128, Math.min(127, temp))
        data1 = Math.max(-32768, Math.min(32767, data1))
        data2 = Math.max(-32768, Math.min(32767, data2))
        data3 = Math.max(-32768, Math.min(32767, data3))

        //
        packet.setNumber(NumberFormat.UInt8BE, 0, id)
        packet.setNumber(NumberFormat.Int8BE, 1, temp)
        packet.setNumber(NumberFormat.Int16BE, 2, data1)
        packet.setNumber(NumberFormat.Int16BE, 4, data2)
        packet.setNumber(NumberFormat.Int16BE, 6, data3)

        return packet
    }


    /**
     * This should be placed in the start up section
     * @param id Payload identifier (0–255)
     * @param frequency The number of milliseconds to wait before sending next packet
     */
    //% block="init with id $id sending every $frequency ms"
    //% weight=90
    //% group="Radio"
    //% inlineInputMode=inline
    export function init(id : number, frequency : number) {
        payloadInterval = frequency
        intervalTime = input.runningTime()
        student_id = Math.max(0, Math.min(255, id))
        radio.setTransmitPower(default_power)
        radio.setGroup(default_group)
        radio.setFrequencyBand(default_channel)
        radio.setTransmitSerialNumber(false)
        radio.on()
    }

    /**
     * Sends a downlink packet if enough time has passed
     * @param temp Temperature to include (-128 to 127)
     * @param data1 First data value, signed short
     * @param data2 Second data value, signed short
     * @param data3 Third data value, signed short
     */
    //% block="request downlink with temp $temp data1 $data1 data2 $data2 data3 $data3"
    //% weight=90
    //% group="Radio"
    //% inlineInputMode=inline
    export function downlink(temp: number, data1: number, data2: number, data3: number) {

        if (input.runningTime() - intervalTime >= payloadInterval) {
            const packet = constructPacket(student_id, temp, data1, data2, data3)
            radio.sendBuffer(packet)

            intervalTime = input.runningTime()
        }
        
    }
}

    /**
     * This is an event handler block
     */
    
    //% block="on data sent"
    //% weight=90
    //% group="Radio"
    //% inlineInputMode=inline
    export function onEvent(handler: () => void) {

    }how would i make an on data sent event handle
ChatGPT said:
Great question! In MakeCode (for micro:bit radio), an "on data sent" event means you want to run some code right after a radio packet is successfully sent.

Unfortunately, the micro:bit radio API itself does not have a built-in "on data sent" event callback. The radio.sendBuffer() call is synchronous — it just sends the packet and returns immediately. There is no direct event triggered after the packet finishes sending.

How to simulate an "on data sent" event in your code?
The best you can do is to call the handler function immediately after sending the packet inside your downlink() function.

Here’s how you could modify your code to support this:

namespace S4comms {
    // ... your existing code ...

    let onDataSentHandler: () => void = null

    export function downlink(temp: number, data1: number, data2: number, data3: number) {
        if (input.runningTime() - intervalTime >= payloadInterval) {
            const packet = constructPacket(student_id, temp, data1, data2, data3)
            radio.sendBuffer(packet)
            intervalTime = input.runningTime()

            // Call the handler if set
            if (onDataSentHandler) {
                onDataSentHandler()
            }
        }
    }

    // This function sets the handler callback
    export function onEvent(handler: () => void) {
        onDataSentHandler = handler
    }
}
How to use it in your MakeCode blocks?
You would then do:

S4comms.onEvent(() => {
    // Code you want to run after a packet is sent
    basic.showIcon(IconNames.Happy)
})

S4comms.init(1, 1000)
Every time the downlink() sends data, your event handler will run.

Summary
There’s no hardware-level "on data sent" event in micro:bit radio.

You can manually trigger your handler right after calling radio.sendBuffer().

Store the handler function in a variable and call it after sending.

If you want, I can help you generate a fully working MakeCode extension with this! Would you like that?

You said:
make a simple readme.md by compliing this information "# S4 communication

This is makeCode library designed to interface with the EyeStar 4 radio on a balloon/sattilite. This is for students to use inorder to send a payload to master micro:bit, which handles communication with the S4." and then use the main code to explain the functionaliyu and how to use the blocks
 being "/**
 * These should be the blocks required for students to interact with the s4
 * by MakeCode
 */

//% color="#4beb36"
namespace S4comms {
    let default_channel = 7
    let default_group = 23 
    let default_power = 7
    let student_id = 0xFF
    let payloadInterval = 10000
    let intervalTime = input.runningTime()

    /**
     * Helper function to build the packets we want to send to master micro:bit
     * 
     */
    function constructPacket(id: number, temp: number, data1: number, data2: number, data3: number): Buffer {
        let packet = pins.createBuffer(8)

        // clamp ranges
        temp = Math.max(-128, Math.min(127, temp))
        data1 = Math.max(-32768, Math.min(32767, data1))
        data2 = Math.max(-32768, Math.min(32767, data2))
        data3 = Math.max(-32768, Math.min(32767, data3))

        //
        packet.setNumber(NumberFormat.UInt8BE, 0, id)
        packet.setNumber(NumberFormat.Int8BE, 1, temp)
        packet.setNumber(NumberFormat.Int16BE, 2, data1)
        packet.setNumber(NumberFormat.Int16BE, 4, data2)
        packet.setNumber(NumberFormat.Int16BE, 6, data3)

        return packet
    }


    /**
     * This should be placed in the start up section
     * @param id Payload identifier (0–255)
     * @param frequency The number of milliseconds to wait before sending next packet
     */
    //% block="init with id $id sending every $frequency ms"
    //% weight=90
    //% group="Radio"
    //% inlineInputMode=inline
    export function init(id : number, frequency : number) {
        payloadInterval = frequency
        intervalTime = input.runningTime()
        student_id = Math.max(0, Math.min(255, id))
        radio.setTransmitPower(default_power)
        radio.setGroup(default_group)
        radio.setFrequencyBand(default_channel)
        radio.setTransmitSerialNumber(false)
        radio.on()
    }

    /**
     * Sends a downlink packet if enough time has passed
     * @param temp Temperature to include (-128 to 127)
     * @param data1 First data value, signed short
     * @param data2 Second data value, signed short
     * @param data3 Third data value, signed short
     */
    //% block="request downlink with temp $temp data1 $data1 data2 $data2 data3 $data3"
    //% weight=90
    //% group="Radio"
    //% inlineInputMode=inline
    export function downlink(temp: number, data1: number, data2: number, data3: number) {

        if (input.runningTime() - intervalTime >= payloadInterval) {
            const packet = constructPacket(student_id, temp, data1, data2, data3)
            radio.sendBuffer(packet)

            intervalTime = input.runningTime()
        }
        
    }
}"
ChatGPT said:
Sure! Here's a clean, simple README.md file based on your description and the provided code, explaining the library purpose, functionality, and usage of the blocks:

# S4 Communication

This is a MakeCode library designed to interface with the EyeStar 4 radio module on a balloon or satellite. It is intended for students to send payload data to a master micro:bit, which handles communication with the EyeStar 4 (S4) radio.

---

## Overview

The `S4comms` namespace provides blocks to initialize the radio and send data packets containing sensor or payload information. These packets are sent as radio buffers to a master micro:bit for processing.

---

## Blocks and Functions

### `init(id: number, frequency: number)`

- **Purpose:** Initializes the radio settings.
- **Parameters:**
  - `id`: Payload identifier (0–255), used to identify the sending device.
  - `frequency`: Interval in milliseconds between each payload transmission.
- **Usage:** Place this block in the start-up section of your program to set up the radio and transmission timing.

### `downlink(temp: number, data1: number, data2: number, data3: number)`

- **Purpose:** Sends a downlink packet if enough time has passed since the last transmission.
- **Parameters:**
  - `temp`: Temperature value included in the packet (range: -128 to 127).
  - `data1`, `data2`, `data3`: Additional signed short data values to include in the payload.
- **Usage:** Call this block repeatedly; it will only send the data if the configured time interval has elapsed.

---

## Packet Format

Each packet sent contains 8 bytes structured as follows:

| Byte(s) | Description            | Format               |
|---------|------------------------|----------------------|
| 0       | Student ID             | Unsigned 8-bit       |
| 1       | Temperature            | Signed 8-bit         |
| 2 - 3   | Data 1                 | Signed 16-bit (big-endian) |
| 4 - 5   | Data 2                 | Signed 16-bit (big-endian) |
| 6 - 7   | Data 3                 | Signed 16-bit (big-endian) |

Values are clamped to valid ranges to ensure packet integrity.

---

## Example Usage

![make code blocks](example.png)
