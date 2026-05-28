/**
 * S4 communication helpers for MakeCode.
 * Packet format is 11 bytes:
 * [0] microbit_id, [1] packed team/type id, [2..10] payload.
 */
namespace s4comm {
    export enum PacketType {
        Basic = 0,
        FlexBasic = 1,
        ExtendedBasic = 2,
        Float = 3,
        Balanced = 4,
        BetterBalance = 5,
        Silly = 6,
        String = 7,
        Pressure = 8
    }

    let microbitId = 1
    let sendIntervalMs = 5000
    let lastSendMs = -5000

    const CTRL_MAGIC = 0xAA
    const CMD_DISCOVER = 0xD0
    const CMD_HERE = 0xD1
    const CMD_POLL = 0xD2
    let respondingToPoll = false
    let _pollHandler: () => void = function () { }
    let _hasPollHandler = false

    // Handlers at namespace level so they register at program start.
    // Master sends MakeCode-framed strings using send_mk_string() in Python.
    radio.onReceivedString(function (str: string) {
        if (str == "D") {
            basic.pause(microbitId * 5)
            const reply = pins.createBuffer(3)
            reply[0] = CTRL_MAGIC
            reply[1] = CMD_HERE
            reply[2] = microbitId
            radio.sendBuffer(reply)
        } else if (str == "P" + microbitId) {
            if (_hasPollHandler) {
                respondingToPoll = true
                _pollHandler()
                respondingToPoll = false
            }
        }
    })

    function clampInt8(v: number): number {
        if (v > 127) return 127
        if (v < -128) return -128
        return v
    }

    function clampInt16(v: number): number {
        if (v > 32767) return 32767
        if (v < -32768) return -32768
        return v
    }

    function clampUInt8(v: number): number {
        return v & 0xff
    }

    function clampInt32(v: number): number {
        if (v > 2147483647) return 2147483647
        if (v < -2147483648) return -2147483648
        return Math.round(v)
    }

    function packedId(packetType: PacketType): number {
        return packetType & 0xff
    }

    function writeAscii(buf: Buffer, offset: number, text: string, width: number): void {
        for (let i = 0; i < width; i++) {
            let code = 0
            if (i < text.length) {
                code = text.charCodeAt(i) & 0x7f
            }
            buf[offset + i] = code
        }
    }

    function canSendNow(): boolean {
        if (respondingToPoll) return true
        return input.runningTime() - lastSendMs >= sendIntervalMs
    }

    function sendPacket(packetType: PacketType, payloadWriter: (packet: Buffer) => void): void {
        if (!canSendNow()) return
        const packet = pins.createBuffer(11)
        packet[0] = microbitId
        packet[1] = packedId(packetType)
        payloadWriter(packet)
        radio.sendBuffer(packet)
        lastSendMs = input.runningTime()
    }

    //% block="initialize S4 comm microbit id $id channel $channel group $group power $power interval ms $interval"
    //% id.min=0 id.max=255 channel.min=0 channel.max=83 group.min=0 group.max=255 power.min=0 power.max=7 interval.min=0
    export function initialize(id: number, channel: number = 7, group: number = 23, power: number = 7, interval: number = 5000): void {
        microbitId = clampUInt8(id)
        sendIntervalMs = Math.max(0, interval)
        radio.setFrequencyBand(channel)
        radio.setGroup(group)
        radio.setTransmitPower(power)
    }

    //% block="set microbit id $id"
    //% id.min=0 id.max=255
    export function setMicrobitId(id: number): void {
        microbitId = clampUInt8(id)
    }

    //% blockId="s4comm_get_microbit_id"
    //% block="microbit id"
    export function getMicrobitId(): number {
        return microbitId
    }

    //% block="set send interval ms $interval"
    //% interval.min=0
    export function setSendInterval(interval: number): void {
        sendIntervalMs = Math.max(0, interval)
    }

    //% block="on master poll"
    export function onMasterPoll(handler: () => void): void {
        _pollHandler = handler
        _hasPollHandler = true
    }

    //% block="send basic temp $temp data1 $data1 data2 $data2"
    export function sendBasic(temp: number, data1: number, data2: number): void {
        sendPacket(PacketType.Basic, (packet) => {
            packet.setNumber(NumberFormat.Int8LE, 2, clampInt8(temp))
            packet.setNumber(NumberFormat.Int32BE, 3, clampInt32(data1))
            packet.setNumber(NumberFormat.Int32BE, 7, clampInt32(data2))
        })
    }

    //% block="send flex basic int8 $int8Value short1 $short1 short2 $short2 int32 $int32Value"
    export function sendFlexBasic(int8Value: number, short1: number, short2: number, int32Value: number): void {
        sendPacket(PacketType.FlexBasic, (packet) => {
            packet.setNumber(NumberFormat.Int8LE, 2, clampInt8(int8Value))
            packet.setNumber(NumberFormat.Int16BE, 3, clampInt16(short1))
            packet.setNumber(NumberFormat.Int16BE, 5, clampInt16(short2))
            packet.setNumber(NumberFormat.Int32BE, 7, clampInt32(int32Value))
        })
    }

    //% block="send extended basic int8 $int8Value short1 $short1 short2 $short2 short3 $short3 short4 $short4"
    export function sendExtendedBasic(int8Value: number, short1: number, short2: number, short3: number, short4: number): void {
        sendPacket(PacketType.ExtendedBasic, (packet) => {
            packet.setNumber(NumberFormat.Int8LE, 2, clampInt8(int8Value))
            packet.setNumber(NumberFormat.Int16BE, 3, clampInt16(short1))
            packet.setNumber(NumberFormat.Int16BE, 5, clampInt16(short2))
            packet.setNumber(NumberFormat.Int16BE, 7, clampInt16(short3))
            packet.setNumber(NumberFormat.Int16BE, 9, clampInt16(short4))
        })
    }

    //% block="send float int8 $int8Value float1 $float1 float2 $float2"
    export function sendFloat(int8Value: number, float1: number, float2: number): void {
        sendPacket(PacketType.Float, (packet) => {
            packet.setNumber(NumberFormat.Int8LE, 2, clampInt8(int8Value))
            packet.setNumber(NumberFormat.Float32BE, 3, float1)
            packet.setNumber(NumberFormat.Float32BE, 7, float2)
        })
    }

    //% block="send balanced int8 $int8Value int32 $int32Value float32 $float32Value"
    export function sendBalanced(int8Value: number, int32Value: number, float32Value: number): void {
        sendPacket(PacketType.Balanced, (packet) => {
            packet.setNumber(NumberFormat.Int8LE, 2, clampInt8(int8Value))
            packet.setNumber(NumberFormat.Int32BE, 3, clampInt32(int32Value))
            packet.setNumber(NumberFormat.Float32BE, 7, float32Value)
        })
    }

    //% block="send better balance int8 $int8Value short1 $short1 short2 $short2 float32 $float32Value"
    export function sendBetterBalance(int8Value: number, short1: number, short2: number, float32Value: number): void {
        sendPacket(PacketType.BetterBalance, (packet) => {
            packet.setNumber(NumberFormat.Int8LE, 2, clampInt8(int8Value))
            packet.setNumber(NumberFormat.Int16BE, 3, clampInt16(short1))
            packet.setNumber(NumberFormat.Int16BE, 5, clampInt16(short2))
            packet.setNumber(NumberFormat.Float32BE, 7, float32Value)
        })
    }

    //% block="send silly float32 $float32Value text $text"
    export function sendSilly(float32Value: number, text: string): void {
        sendPacket(PacketType.Silly, (packet) => {
            packet.setNumber(NumberFormat.Float32BE, 2, float32Value)
            writeAscii(packet, 6, text || "", 5)
        })
    }

    //% block="send string text $text"
    export function sendString(text: string): void {
        sendPacket(PacketType.String, (packet) => {
            writeAscii(packet, 2, text || "", 9)
        })
    }

    //% block="send pressure $pressure"
    export function sendPressure(pressure: number): void {
        sendPacket(PacketType.Pressure, (packet) => {
            packet.setNumber(NumberFormat.Int32BE, 2, clampInt32(pressure))
        })
    }
}



enum BMP280_I2C_ADDRESS {
    //% block="0x76"
    ADDR_0x76 = 0x76,
    //% block="0x77"
    ADDR_0x77 = 0x77
}
/**
 * BMP280 block
 */
//% weight=100 color=#70c0f0 icon="\uf042" block="BMP280"
namespace BMP280 {
    let BMP280_I2C_ADDR = BMP280_I2C_ADDRESS.ADDR_0x76

    function setreg(reg: number, dat: number): void {
        let buf = pins.createBuffer(2);
        buf[0] = reg;
        buf[1] = dat;
        pins.i2cWriteBuffer(BMP280_I2C_ADDR, buf);
    }

    function getreg(reg: number): number {
        pins.i2cWriteNumber(BMP280_I2C_ADDR, reg, NumberFormat.UInt8BE);
        return pins.i2cReadNumber(BMP280_I2C_ADDR, NumberFormat.UInt8BE);
    }

    function getUInt16LE(reg: number): number {
        pins.i2cWriteNumber(BMP280_I2C_ADDR, reg, NumberFormat.UInt8BE);
        return pins.i2cReadNumber(BMP280_I2C_ADDR, NumberFormat.UInt16LE);
    }

    function getInt16LE(reg: number): number {
        pins.i2cWriteNumber(BMP280_I2C_ADDR, reg, NumberFormat.UInt8BE);
        return pins.i2cReadNumber(BMP280_I2C_ADDR, NumberFormat.Int16LE);
    }

    let dig_T1 = getUInt16LE(0x88)
    let dig_T2 = getInt16LE(0x8A)
    let dig_T3 = getInt16LE(0x8C)
    let dig_P1 = getUInt16LE(0x8E)
    let dig_P2 = getInt16LE(0x90)
    let dig_P3 = getInt16LE(0x92)
    let dig_P4 = getInt16LE(0x94)
    let dig_P5 = getInt16LE(0x96)
    let dig_P6 = getInt16LE(0x98)
    let dig_P7 = getInt16LE(0x9A)
    let dig_P8 = getInt16LE(0x9C)
    let dig_P9 = getInt16LE(0x9E)
    setreg(0xF4, 0x2F)
    setreg(0xF5, 0x0C)
    let T = 0
    let P = 0

    function get(): void {
        let adc_T = (getreg(0xFA) << 12) + (getreg(0xFB) << 4) + (getreg(0xFC) >> 4)
        let var1 = (((adc_T >> 3) - (dig_T1 << 1)) * dig_T2) >> 11
        let var2 = (((((adc_T >> 4) - dig_T1) * ((adc_T >> 4) - dig_T1)) >> 12) * dig_T3) >> 14
        let t = var1 + var2
        T = Math.idiv(((t * 5 + 128) >> 8), 100)
        var1 = (t >> 1) - 64000
        var2 = (((var1 >> 2) * (var1 >> 2)) >> 11) * dig_P6
        var2 = var2 + ((var1 * dig_P5) << 1)
        var2 = (var2 >> 2) + (dig_P4 << 16)
        var1 = (((dig_P3 * ((var1 >> 2) * (var1 >> 2)) >> 13) >> 3) + (((dig_P2) * var1) >> 1)) >> 18
        var1 = ((32768 + var1) * dig_P1) >> 15
        if (var1 == 0)
            return; // avoid exception caused by division by zero
        let adc_P = (getreg(0xF7) << 12) + (getreg(0xF8) << 4) + (getreg(0xF9) >> 4)
        let _p = ((1048576 - adc_P) - (var2 >> 12)) * 3125
        _p = Math.idiv(_p, var1) * 2;
        var1 = (dig_P9 * (((_p >> 3) * (_p >> 3)) >> 13)) >> 12
        var2 = (((_p >> 2)) * dig_P8) >> 13
        P = _p + ((var1 + var2 + dig_P7) >> 4)
    }

    /**
     * get pressure
     */
    //% blockId="BMP280_GET_PRESSURE" block="get pressure"
    //% weight=80 blockGap=8
    export function pressure(): number {
        get();
        return P;
    }

    /**
     * get temperature
     */
    //% blockId="BMP280_GET_TEMPERATURE" block="get temperature"
    //% weight=80 blockGap=8
    export function temperature(): number {
        get();
        return T;
    }

    /**
     * power on
     */
    //% blockId="BMP280_POWER_ON" block="Power On"
    //% weight=61 blockGap=8
    export function PowerOn() {
        setreg(0xF4, 0x2F)
    }

    /**
     * power off
     */
    //% blockId="BMP280_POWER_OFF" block="Power Off"
    //% weight=60 blockGap=8
    export function PowerOff() {
        setreg(0xF4, 0)
    }

    /**
     * set I2C address
     */
    //% blockId="BMP280_SET_ADDRESS" block="set address %addr"
    //% weight=50 blockGap=8
    export function Address(addr: BMP280_I2C_ADDRESS) {
        BMP280_I2C_ADDR = addr
    }
}