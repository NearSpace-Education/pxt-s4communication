# S4 communication

## what is this?

This repo now includes:
- a MicroPython library (`s4comm.py`)
- a MakeCode extension (`pxt.json` + `main.ts`)

## Overview

This is a microPython library designed to interface with the EyeStar 4 radio module on a balloon or satellite. It is intended for students to send payload data to a master micro:bit, which handles communication with the EyeStar 4 (S4) radio. The library provides functions to initialize the radio and send data packets containing sensor/payload information. These packets are sent over the microbit radio protocol to a master micro:bit for processing. The library supports multiple packet formats to accommodate different data types and payload requirements.

## Packet Formats

The library supports 8 different packet types, each optimized for different data requirements. All packets are 11 bytes in length:
- Byte 0: `microbit_id` (settable source ID)
- Byte 1: combined team/type byte
- Bytes 2-10: payload data

### ID/Type Byte Structure
- **Bits 0-4:** Student/Team ID (0-31)
- **Bits 5-7:** Packet Type (0-7)

### Packet Type Details

| Type | Name | Format | Description |
|------|------|--------|-------------|
| 0 | Basic | int8, int32, int32 | Temperature + two large integers |
| 1 | FlexBasic | int8, int16, int16, int32 | Mixed precision data |
| 2 | ExtendedBasic | int8, int16, int16, int16, int16 | One byte + four shorts |
| 3 | Float | int8, float32, float32 | Byte + two floating-point values |
| 4 | Balanced | int8, int32, float32 | Mixed integer and float |
| 5 | BetterBalance | int8, int16, int16, float32 | Two shorts + one float |
| 6 | Silly | float32, char×5 | Float + 5-character string |
| 7 | String | char×9 | 9-character string only |

### Data Type Ranges
- **int8:** -128 to 127 (1 byte)
- **int16:** -32,768 to 32,767 (2 bytes, big-endian)
- **int32:** -2,147,483,648 to 2,147,483,647 (4 bytes, big-endian)
- **float32:** IEEE 754 single-precision floating-point (4 bytes, big-endian)
- **char:** ASCII character (1 byte each)

Values are automatically clamped to valid ranges to ensure packet integrity.
---

## How to use

- add this library to your project or path
- add the library using `import s4comm` 
- create an instance using `objName = s4comm()`
- call `objName.init(teamId)` at least once
  - optional: `objName.init(teamId, microbitID)` to set `microbit_id` at init
- optionally call `objName.setMicrobitID(id)` to set byte 0 (`microbit_id`)
- call `objName.sendMaster()` to attempt to downlink (rate limited)
  - basic or balanced are generally the most useful and beginner friendly
  - if teaching students with python make sure you are very clear regarding data types

## MakeCode usage

In MakeCode for micro:bit:
1. Import this repo as an extension.
2. Use `initialize S4 comm ...` once in `on start`.
3. Optionally set `microbit id`.
4. Use any `send ...` block (`basic`, `flex basic`, `extended basic`, `float`, `balanced`, `better balance`, `silly`, `string`).
