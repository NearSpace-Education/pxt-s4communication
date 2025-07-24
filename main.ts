/**
 * These should be the blocks required for students to interact with the s4
 * by MakeCode
 */

//% color="#4beb36"
namespace S4comms {
    let default_channel = 7
    let default_group = 23 
    let default_power = 7
    let student_id = 0x00
    let minPayloadInterval = 30000 //so students cant accidently spam any faster than this
    //let packetType = 0
    let intervalTime = input.runningTime()

    /**
     * silly moon names for better parsing
     */
    enum Moons {
        None = 0,

        // Mars
        Phobos = 1,
        Deimos = 2,

        // Jupiter
        Io = 3,
        Europa = 4,
        Ganymede = 5,
        Callisto = 6,
        Amalthea = 7,
        Himalia = 8,
        Elara = 9,

        // Saturn
        Mimas = 10,
        Enceladus = 11,
        Tethys = 12,
        Dione = 13,
        Rhea = 14,
        Titan = 15,
        Hyperion = 16,
        Iapetus = 17,
        Phoebe = 18,
        Janus = 19,

        // Uranus
        Miranda = 20,
        Ariel = 21,
        Umbriel = 22,
        Titania = 23,
        Oberon = 24,

        // Neptune
        Triton = 25,
        Nereid = 26,
        Proteus = 27,
        Larissa = 28,
        Despina = 29,
        Galatea = 30,

        // Pluto
        Charon = 31
    }

    enum PacketType {
        Basic = 0, // int8 , int32, int32
        Float = 6, // int8, float32, float32
        String = 7 // char * 9
    }
    /**
     * convert any number to int32
     * @param value 
     * @returns 32 bit integer
     */
    function clampInt32(value: number): number {
        if (value > 2147483647) return 2147483647;
        if (value < -2147483648) return -2147483648;
        return value | 0;
    }

    /**
     * convert any number to int16
     * @param value 
     * @returns 16 bit integer
     */
    function clampInt16(value: number): number {
        if (value > 32767) return 32767;
        if (value < -32768) return -32768;
        return (value << 16) >> 16; 
    }

    /**
     * convert any number to int8
     * @param value 
     * @returns 8 bit integer (byte)
     */
    function clampInt8(value: number): number {
        if (value > 127) return 127;
        if (value < -128) return -128;
        return (value << 24) >> 24;
    }

    /**
     * Helper function to build the packets we want to send to master micro:bit
     * 
     */
    function constructPacket(id: number, temp: number, data1: number, data2: number): Buffer {
        let packet = pins.createBuffer(8)

        id = createId(0, id) //add type data

        // clamp ranges
        temp = clampInt8(temp)
        data1 - clampInt32(data1)
        data2 - clampInt32(data2)

        //
        packet.setNumber(NumberFormat.UInt8BE, 0, id)
        packet.setNumber(NumberFormat.Int8BE, 1, temp)
        packet.setNumber(NumberFormat.Int32BE, 2, data1)
        packet.setNumber(NumberFormat.Int32BE, 6, data2)

        return packet
    }

    /**
     * bitmask so we can get the id and packettype in the same byte
     * bits 0-2: packetType (0-7)
     * bits 3-7: student_id (0-31)
     */
    function createId(type: PacketType, id: number) : number {
        return ((id << 3) & 0x1F) | (type & 0x7);
    }

    /**
     * This should be placed in the start up section
     * @param id Payload identifier --> Team Name
     */
    //% block="start as Team $id"
    //% weight=90
    //% group="Basic"
    //% inlineInputMode=inline
    export function initTeam(id : Moons) {
        intervalTime = input.runningTime()

        student_id = id

        radio.setTransmitPower(default_power)
        radio.setGroup(default_group)
        radio.setFrequencyBand(default_channel)
        radio.setTransmitSerialNumber(false)
        radio.on()
    }

    /**
     * This should be placed in the start up section
     * @param id Payload identifier (0–31) 5 bits
     */
    //% block="start with id $id (0-31)"
    //% weight=80
    //% group="Advanced"
    //% inlineInputMode=inline
    export function initNumber(id : number) {
        intervalTime = input.runningTime()

        //enforce id limits
        if (id < 0) {id *= -1}
        student_id = id % 32

        radio.setTransmitPower(default_power)
        radio.setGroup(default_group)
        radio.setFrequencyBand(default_channel)
        radio.setTransmitSerialNumber(false)
        radio.on()
    }

    /**
     * sends to master micro:bit buffer
     * @param temp Temperature to include (-128 to 127)
     * @param data1 First data value, signed int32
     * @param data2 Second data value, signed int32
     */
    //% block="request downlink with temp $temp data1 $data1 data2 $data2"
    //% weight=90
    //% group="Basic"
    //% inlineInputMode=inline
    export function downlinkBasic(temp: number, data1: number, data2: number) {

        if (input.runningTime() - intervalTime >= minPayloadInterval) {
            const packet = constructPacket(student_id, temp, data1, data2)
            radio.sendBuffer(packet)

            intervalTime = input.runningTime()
        }
        
    }
}