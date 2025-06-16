/**
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
