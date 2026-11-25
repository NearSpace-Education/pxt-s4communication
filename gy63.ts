/**
 * GY-63 (MS5611) barometric pressure + temperature sensor over I2C.
 * Wiring: VCC->3V, GND->GND, SCL->P19, SDA->P20.
 * I2C address: 0x77 when CSB is low (module default), 0x76 when CSB is high.
 *
 * Note: the MS5611 datasheet uses 64-bit integer math. MakeCode bit shifts
 * truncate to 32 bits, so all scaling here uses * and / by powers of two.
 */
//% color="#2a9d8f" icon="" block="GY63"
namespace gy63 {
    export enum Address {
        //% block="0x77 (default)"
        Addr0x77 = 0x77,
        //% block="0x76"
        Addr0x76 = 0x76
    }

    const CMD_RESET = 0x1E
    const CMD_CONV_D1 = 0x48 // pressure, OSR 4096
    const CMD_CONV_D2 = 0x58 // temperature, OSR 4096
    const CMD_ADC_READ = 0x00
    const CMD_PROM_BASE = 0xA0

    let addr = 0x77
    let C: number[] = [0, 0, 0, 0, 0, 0, 0] // C[1..6] used
    let initialized = false
    let lastTempC = 0
    let lastPressurePa = 0

    function cmd(c: number): void {
        pins.i2cWriteNumber(addr, c, NumberFormat.UInt8BE, false)
    }

    function readProm(): void {
        for (let i = 1; i <= 6; i++) {
            cmd(CMD_PROM_BASE + i * 2)
            C[i] = pins.i2cReadNumber(addr, NumberFormat.UInt16BE, false)
        }
    }

    function readAdc(convCmd: number): number {
        cmd(convCmd)
        basic.pause(10) // OSR 4096 conversion takes ~9 ms
        cmd(CMD_ADC_READ)
        const b = pins.i2cReadBuffer(addr, 3, false)
        return b[0] * 65536 + b[1] * 256 + b[2]
    }

    function ensureInit(): void {
        if (!initialized) init(addr)
    }

    /**
     * Datasheet compensation (first + second order).
     * Returns [temperature in 0.01 °C, pressure in Pa].
     */
    export function compensate(d1: number, d2: number, c: number[]): number[] {
        const dT = d2 - c[5] * 256
        let temp = 2000 + dT * c[6] / 8388608
        let off = c[2] * 65536 + c[4] * dT / 128
        let sens = c[1] * 32768 + c[3] * dT / 256

        // Second-order compensation for cold temperatures
        if (temp < 2000) {
            const t2 = dT * dT / 2147483648
            const lowSq = (temp - 2000) * (temp - 2000)
            let off2 = 5 * lowSq / 2
            let sens2 = 5 * lowSq / 4
            if (temp < -1500) {
                const vlowSq = (temp + 1500) * (temp + 1500)
                off2 += 7 * vlowSq
                sens2 += 11 * vlowSq / 2
            }
            temp -= t2
            off -= off2
            sens -= sens2
        }

        const p = (d1 * sens / 2097152 - off) / 32768
        return [temp, p]
    }

    function update(): void {
        ensureInit()
        const d2 = readAdc(CMD_CONV_D2)
        const d1 = readAdc(CMD_CONV_D1)
        const r = compensate(d1, d2, C)
        lastTempC = r[0] / 100
        lastPressurePa = r[1]
    }

    /**
     * Reset the GY63 and read its calibration data. Put this in "on start".
     */
    //% block="initialize GY63 at address $address"
    //% address.defl=gy63.Address.Addr0x77
    //% weight=100
    export function init(address: Address = Address.Addr0x77): void {
        addr = address
        cmd(CMD_RESET)
        basic.pause(3)
        readProm()
        initialized = true
    }

    /**
     * Take a new reading and return the air pressure in Pa.
     */
    //% block="GY63 pressure (Pa)"
    //% weight=90
    export function pressure(): number {
        update()
        return lastPressurePa
    }

    /**
     * Take a new reading and return the temperature in °C.
     */
    //% block="GY63 temperature (°C)"
    //% weight=80
    export function temperature(): number {
        update()
        return lastTempC
    }

    /**
     * True if the sensor answers with valid calibration data. Useful for checking wiring.
     */
    //% block="GY63 is connected"
    //% weight=70
    export function isConnected(): boolean {
        ensureInit()
        let allZero = true
        let allOnes = true
        for (let i = 1; i <= 6; i++) {
            if (C[i] != 0) allZero = false
            if (C[i] != 0xFFFF) allOnes = false
        }
        return !(allZero || allOnes)
    }
}
