/**
 * These should be the blocks required for students to interact with the s4
 * by MakeCode
 */

/**
 * Silly moon names for better parsing
 */
//% blockCombine
//% blockNamespace="S4comms"
enum Moons {
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
}

//% color="#4beb36"
namespace S4comms {
    let default_channel = 7
    let default_group = 23 
    let default_power = 7
    let student_id = 0x00
    let minPayloadInterval = 30000 //so students can't accidently spam any faster than this
    //let packetType = 0
    let intervalTime = input.runningTime()

    enum PacketType {
        Basic = 0, // int8 , int32, int32
        FlexBasic = 1, //int8, int16, int16, int32
        ExtendedBasic = 2, //int8, int16, int16, in16, int16
        Float = 3, // int8, float32, float32
        Balanced = 4, // int8, int32, float32
        BetterBalance = 5, //int8, int16, int16, float32
        Silly = 6, //float32, char * 5
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
     * bitmask so we can get the id and packettype in the same byte
     * bits 0-2: packetType (0-7)
     * bits 3-7: student_id (0-31)
     */
    function createId(type: PacketType, id: number) : number {
        return (id & 0x1F) | ((type & 0x7) << 5);
    }

    /**
     * Helper function to build the packets we want to send to master micro:bit
     * 
     */
    function constructPacket(type: PacketType, id: number, data: number[]): Buffer {
        let packet = pins.createBuffer(10);

        id = createId(type, id); // combine packetType and student_id
        packet.setNumber(NumberFormat.UInt8BE, 0, id);

        switch (type) {
            case PacketType.Basic:
                if (data.length !== 3) return packet;

                packet.setNumber(NumberFormat.Int8BE, 1, clampInt8(data[0]));
                packet.setNumber(NumberFormat.Int32BE, 2, clampInt32(data[1]));
                packet.setNumber(NumberFormat.Int32BE, 6, clampInt32(data[2]));
                break;

            case PacketType.FlexBasic:
                if (data.length !== 4) return packet;

                packet.setNumber(NumberFormat.Int8BE, 1, clampInt8(data[0]));
                packet.setNumber(NumberFormat.Int16BE, 2, clampInt16(data[1]));
                packet.setNumber(NumberFormat.Int16BE, 4, clampInt16(data[2]));
                packet.setNumber(NumberFormat.Int32BE, 6, clampInt32(data[3]));
                break;

            case PacketType.ExtendedBasic:
                if (data.length !== 5) return packet;

                packet.setNumber(NumberFormat.Int8BE, 1, clampInt8(data[0]));
                packet.setNumber(NumberFormat.Int16BE, 2, clampInt16(data[1]));
                packet.setNumber(NumberFormat.Int16BE, 4, clampInt16(data[2]));
                packet.setNumber(NumberFormat.Int16BE, 6, clampInt16(data[3]));
                packet.setNumber(NumberFormat.Int16BE, 8, clampInt16(data[4]));
                break;

            case PacketType.Float:
                if (data.length !== 3) return packet;

                packet.setNumber(NumberFormat.Int8BE, 1, clampInt8(data[0]));
                packet.setNumber(NumberFormat.Float32BE, 2, data[1]);
                packet.setNumber(NumberFormat.Float32BE, 6, data[2]);
                break;

            case PacketType.Balanced:
                if (data.length !== 3) return packet;

                packet.setNumber(NumberFormat.Int8BE, 1, clampInt8(data[0]));
                packet.setNumber(NumberFormat.Int32BE, 2, clampInt32(data[1]));
                packet.setNumber(NumberFormat.Float32BE, 6, data[2]);
                break;

            case PacketType.BetterBalance:
                if (data.length !== 4) return packet;

                packet.setNumber(NumberFormat.Int8BE, 1, clampInt8(data[0]));
                packet.setNumber(NumberFormat.Int16BE, 2, clampInt16(data[1]));
                packet.setNumber(NumberFormat.Int16BE, 4, clampInt16(data[2]));
                packet.setNumber(NumberFormat.Float32BE, 6, data[3]);
                break;

            case PacketType.Silly:
                if (data.length < 2) return packet;

                packet.setNumber(NumberFormat.Float32BE, 1, data[0]); 
                for (let i = 1; i < data.length; i++) {
                    packet.setNumber(NumberFormat.UInt8BE, 5 + i, data[i]); 
                }
                break;

            case PacketType.String:

                for (let i = 0; i < data.length; i++) {
                    packet.setNumber(NumberFormat.UInt8BE, 1 + i, data[i]); 
                }
                break;
        }
        return packet;
    }

    //EXPORTED FUNCTIONS

    /**
     * This should be placed in the start up section
     * @param id Payload identifier --> Team Name
     */
    //% block="start as Team $id"
    //% id.defl=Phobos
    //% weight=91
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
    //% weight=81
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
            const packet = constructPacket(PacketType.Basic, student_id, [temp, data1, data2])
            radio.sendBuffer(packet)

            intervalTime = input.runningTime()
        }
        
    }

    //% block="request downlink with byte $int8 short1 $short1 short2 $short2 int $int"
    //% weight=90 group="Advanced" inlineInputMode=inline
    export function downlinkFlexBasic(int8: number, short1: number, short2: number, intVal: number) {
        if (input.runningTime() - intervalTime >= minPayloadInterval) {
            const packet = constructPacket(PacketType.FlexBasic, student_id, [int8, short1, short2, intVal])
            radio.sendBuffer(packet)
            intervalTime = input.runningTime()
        }
    }

    //% block="request downlink with byte $int8 short1 $s1 short2 $s2 short3 $s3 short4 $s4"
    //% weight=90 group="Advanced" inlineInputMode=inline
    export function downlinkExtendedBasic(int8: number, s1: number, s2: number, s3: number, s4: number) {
        if (input.runningTime() - intervalTime >= minPayloadInterval) {
            const packet = constructPacket(PacketType.ExtendedBasic, student_id, [int8, s1, s2, s3, s4])
            radio.sendBuffer(packet)
            intervalTime = input.runningTime()
        }
    }

    //% block="request downlink with byte $int8 float1 $data1 float2 $data2"
    //% weight=90
    //% group="Advanced"
    //% inlineInputMode=inline
    export function downlinkFloat(int8: number, float1: number, float2: number) {

        if (input.runningTime() - intervalTime >= minPayloadInterval) {
            const packet = constructPacket(PacketType.Float, student_id, [int8, float1, float2])
            radio.sendBuffer(packet)

            intervalTime = input.runningTime()
        }
        
    }

    //% block="request downlink with byte $int8 int $intVal float $floatVal"
    //% weight=90 group="Advanced" inlineInputMode=inline
    export function downlinkBalanced(int8: number, intVal: number, floatVal: number) {
        if (input.runningTime() - intervalTime >= minPayloadInterval) {
            const packet = constructPacket(PacketType.Balanced, student_id, [int8, intVal, floatVal])
            radio.sendBuffer(packet)
            intervalTime = input.runningTime()
        }
    }

    //% block="request downlink with byte $int8 short1 $s1 short2 $s2 float $f"
    //% weight=90 group="Advanced" inlineInputMode=inline
    export function downlinkBetterBalance(int8: number, s1: number, s2: number, f: number) {
        if (input.runningTime() - intervalTime >= minPayloadInterval) {
            const packet = constructPacket(PacketType.BetterBalance, student_id, [int8, s1, s2, f])
            radio.sendBuffer(packet)
            intervalTime = input.runningTime()
        }
    }

    //% block="request downlink with float $f string $str (5 char)"
    //% weight=90 group="Advanced" inlineInputMode=inline
    export function downlinkSilly(f: number, str: string) {
        if (input.runningTime() - intervalTime >= minPayloadInterval) {
            const chars: number[] = (str.split("").map(c => c.charCodeAt(0))).slice(0,5)
            const packet = constructPacket(PacketType.Silly, student_id, chars)
            radio.sendBuffer(packet)
            intervalTime = input.runningTime()
        }
    }

    //% block="request downlink with string $str (9 char)"
    //% weight=90 group="Advanced" inlineInputMode=inline
    export function downlinkString(str: string) {
        if (input.runningTime() - intervalTime >= minPayloadInterval) {
            const chars: number[] = (str.split("").map(c => c.charCodeAt(0))).slice(0,9)
            const packet = constructPacket(PacketType.String, student_id, chars)
            radio.sendBuffer(packet)
            intervalTime = input.runningTime()
        }
    }


}