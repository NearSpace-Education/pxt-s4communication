# S4 Communication

This is a MakeCode library designed to interface with the EyeStar 4 radio module on a balloon or satellite. It is intended for students to send payload data to a master micro:bit, which handles communication with the EyeStar 4 (S4) radio.

---

## Overview

The `balloonNSE` namespace provides blocks to initialize the radio and send data packets containing sensor or payload information. These packets are sent as radio buffers to a master micro:bit for processing. The library supports multiple packet formats to accommodate different data types and payload requirements.

---

## Blocks and Functions

### Initialization Functions

#### `start as Team [Moon Name]`

- **Purpose:** Initializes the radio settings using a team identifier based on moon names.
- **Parameters:**
  - Team identifier selected from moon names (Phobos, Deimos, Io, Europa, etc.)
- **Usage:** Place this block in the start-up section of your program to set up the radio with a memorable team name.
- **Group:** Basic

#### `start with id [number] (0-31)`

- **Purpose:** Initializes the radio settings using a numeric identifier.
- **Parameters:**
  - `id`: Payload identifier (0–31), used to identify the sending device.
- **Usage:** Place this block in the start-up section for advanced users who prefer numeric IDs.
- **Group:** Advanced

### Basic Downlink Functions

#### `request downlink with temp [temp] data1 [data1] data2 [data2]`

- **Purpose:** Sends a basic downlink packet with temperature and two integer data values.
- **Parameters:**
  - `temp`: Temperature value included in the packet (range: -128 to 127).
  - `data1`, `data2`: Additional signed 32-bit integer data values.
- **Usage:** Call this block repeatedly; it will only send data if the minimum interval (30 seconds) has elapsed.
- **Packet Format:** Basic (Type 0)
- **Group:** Basic

### Advanced Downlink Functions

#### `request downlink with byte [int8] short1 [short1] short2 [short2] int [int]`

- **Parameters:**
  - `int8`: 8-bit signed integer (-128 to 127)
  - `short1`, `short2`: 16-bit signed integers (-32,768 to 32,767)
  - `int`: 32-bit signed integer
- **Packet Format:** FlexBasic (Type 1)
- **Group:** Advanced

#### `request downlink with byte [int8] short1 [s1] short2 [s2] short3 [s3] short4 [s4]`

- **Parameters:**
  - `int8`: 8-bit signed integer (-128 to 127)
  - `s1`, `s2`, `s3`, `s4`: Four 16-bit signed integers (-32,768 to 32,767)
- **Packet Format:** ExtendedBasic (Type 2)
- **Group:** Advanced

#### `request downlink with byte [int8] float1 [float1] float2 [float2]`

- **Parameters:**
  - `int8`: 8-bit signed integer (-128 to 127)
  - `float1`, `float2`: 32-bit floating-point numbers
- **Packet Format:** Float (Type 3)
- **Group:** Advanced

#### `request downlink with byte [int8] int [intVal] float [floatVal]`

- **Parameters:**
  - `int8`: 8-bit signed integer (-128 to 127)
  - `intVal`: 32-bit signed integer
  - `floatVal`: 32-bit floating-point number
- **Packet Format:** Balanced (Type 4)
- **Group:** Advanced

#### `request downlink with byte [int8] short1 [s1] short2 [s2] float [f]`

- **Parameters:**
  - `int8`: 8-bit signed integer (-128 to 127)
  - `s1`, `s2`: 16-bit signed integers (-32,768 to 32,767)
  - `f`: 32-bit floating-point number
- **Packet Format:** BetterBalance (Type 5)
- **Group:** Advanced

#### `request downlink with float [f] string [str] (5 char)`

- **Parameters:**
  - `f`: 32-bit floating-point number
  - `str`: String data (maximum 5 characters)
- **Packet Format:** Silly (Type 6)
- **Group:** Advanced

#### `request downlink with string [str] (9 char)`

- **Parameters:**
  - `str`: String data (maximum 9 characters)
- **Packet Format:** String (Type 7)
- **Group:** Advanced

---

## Packet Formats

The library supports 8 different packet types, each optimized for different data requirements. All packets are 10 bytes in length and include a combined ID/type byte as the first byte.

### ID/Type Byte Structure
- **Bits 0-2:** Packet Type (0-7)
- **Bits 3-7:** Student/Team ID (0-31)

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

## Transmission Control

- **Minimum Interval:** 30 seconds between transmissions (prevents accidental spamming)
- **Automatic Timing:** All downlink functions automatically enforce the minimum interval
- **Radio Settings:** 
  - Default Channel: 7
  - Default Group: 23
  - Default Power: 7

---

## Example Usage

![make code blocks](example.png)



## [Slide Guide](https://docs.google.com/presentation/d/1hMdmafFlc-lLIqcJOhETRY5BsjdJvocBKo3NrH4bV4w/edit?usp=sharing)

- A full guide describing how to use this library and 
- Epxlaining some of the basics for how the whole thing works

## [Sister microPython Library](https://github.com/NearSpace-Education/s4communication)

- The same library adapted for use with [microPython](https://python.microbit.org/v/3)
- Contains a "How to parse" file which could be useful to more advanced users