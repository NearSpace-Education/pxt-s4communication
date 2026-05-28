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
        String = 7
    }

    let teamId = 0
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
        return (teamId & 0x1f) | ((packetType & 0x07) << 5)
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

    //% block="initialize S4 comm team id $id channel $channel group $group power $power interval ms $interval"
    //% id.min=0 id.max=31 channel.min=0 channel.max=83 group.min=0 group.max=255 power.min=0 power.max=7 interval.min=0
    export function initialize(id: number, channel: number = 7, group: number = 23, power: number = 7, interval: number = 5000): void {
        teamId = id & 0x1f
        sendIntervalMs = Math.max(0, interval)
        radio.setFrequencyBand(channel)
        radio.setGroup(group)
        radio.setTransmitPower(power)
    }

    //% block="set team id $id"
    //% id.min=0 id.max=31
    export function setTeamId(id: number): void {
        teamId = id & 0x1f
    }

    //% block="set microbit id $id"
    //% id.min=0 id.max=255
    export function setMicrobitId(id: number): void {
        microbitId = clampUInt8(id)
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
}
