# Parsing Student Payloads

## Overview

Each payload packet is exactly 11 bytes. Byte 0 is `microbit_id`, byte 1 is the combined ID/type byte, and bytes 2-10 are payload bytes. The combined ID/type byte contains the team (0-31) and packetType (0-7), which determines how to parse the next 9 bytes. The MMB (Master Micro:Bit) is designed to fill up its buffer with these payloads and then dump them to the S4 to be sent over with its health and safety packets.

## Packet Format

- **Byte 0**: `microbit_id` (0-255)
- **Byte 1**: combined ID/type byte
  - Bits 0-4: Team/ID value (0-31)
  - Bits 5-7: Packet type (0-7)

- **Bytes 2-10**: Payload data
  - Format determined by packet type

### ID Byte Decoding

To extract values from the ID byte:

```c++
// C++ example
uint8_t id_byte = packet[1]; //0b11100001 -> packetType: String (7), Team: Phobos (1)
uint8_t team_id = id_byte & 0x1F;
uint8_t packet_type = (id_byte >> 5) & 0x07;
```

## Packet Types

### Type 0: Basic
**Format**: int8, int32, int32
- Byte 1: Temperature (-128 to 127)
- Bytes 2-5: First data value (32-bit signed integer, big-endian)
- Bytes 6-9: Second data value (32-bit signed integer, big-endian)

```
| MBID | ID | temp | ----data1---- | ----data2---- |
| 0    | 1  | 2    | 3  4  5  6    | 7  8  9  10   |
```

### Type 1: FlexBasic
**Format**: int8, int16, int16, int32
- Byte 1: 8-bit signed integer (-128 to 127)
- Bytes 2-3: First 16-bit signed integer (big-endian)
- Bytes 4-5: Second 16-bit signed integer (big-endian)
- Bytes 6-9: 32-bit signed integer (big-endian)

```
| MBID | ID | int8 | -short1- | -short2- | ----int32---- |
| 0    | 1  | 2    | 3  4     | 5  6     | 7  8  9  10   |
```

### Type 2: ExtendedBasic
**Format**: int8, int16, int16, int16, int16
- Byte 1: 8-bit signed integer (-128 to 127)
- Bytes 2-3: First 16-bit signed integer (big-endian)
- Bytes 4-5: Second 16-bit signed integer (big-endian)
- Bytes 6-7: Third 16-bit signed integer (big-endian)
- Bytes 8-9: Fourth 16-bit signed integer (big-endian)

```
| MBID | ID | int8 | -short1- | -short2- | -short3- | -short4- |
| 0    | 1  | 2    | 3  4     | 5  6     | 7  8     | 9  10    |
```

### Type 3: Float
**Format**: int8, float32, float32
- Byte 1: 8-bit signed integer (-128 to 127)
- Bytes 2-5: First 32-bit float (IEEE 754, big-endian)
- Bytes 6-9: Second 32-bit float (IEEE 754, big-endian)

```
| MBID | ID | int8 | ---float1--- | ---float2--- |
| 0    | 1  | 2    | 3  4  5  6   | 7  8  9  10  |
```

### Type 4: Balanced
**Format**: int8, int32, float32
- Byte 1: 8-bit signed integer (-128 to 127)
- Bytes 2-5: 32-bit signed integer (big-endian)
- Bytes 6-9: 32-bit float (IEEE 754, big-endian)

```
| MBID | ID | int8 | ----int32---- | ---float32--- |
| 0    | 1  | 2    | 3  4  5  6    | 7  8  9  10   |
```

### Type 5: BetterBalance
**Format**: int8, int16, int16, float32
- Byte 1: 8-bit signed integer (-128 to 127)
- Bytes 2-3: First 16-bit signed integer (big-endian)
- Bytes 4-5: Second 16-bit signed integer (big-endian)
- Bytes 6-9: 32-bit float (IEEE 754, big-endian)

```
| MBID | ID | int8 | -short1- | -short2- | ---float32--- |
| 0    | 1  | 2    | 3  4     | 5  6     | 7  8  9  10   |
```

### Type 6: Silly
**Format**: float32, char×5
- Bytes 1-4: 32-bit float (IEEE 754, big-endian)
- Bytes 5-9: 5 ASCII characters (string data)

```
| MBID | ID | ---float32--- | c1 | c2 | c3 | c4 | c5 |
| 0    | 1  | 2  3  4  5    | 6  | 7  | 8  | 9  | 10 |
```

### Type 7: String
**Format**: char×9
- Bytes 1-9: 9 ASCII characters (string data)

```
| MBID | ID | c1 | c2 | c3 | c4 | c5 | c6 | c7 | c8 | c9 |
| 0    | 1  | 2  | 3  | 4  | 5  | 6  | 7  | 8  | 9  | 10 |
```

## Team ID Mapping

The system supports up to 32 teams (0-31). For educational purposes, moon names are used as team identifiers (Tom is space rock scientist):

| Team ID | Moon Name | Planet |
|---------|-----------|---------|
| 1 | Phobos | Mars |
| 2 | Deimos | Mars |
| 3 | Io | Jupiter |
| 4 | Europa | Jupiter |
| 5 | Ganymede | Jupiter |
| ... | ... | ... |
| 30 | Galatea | Neptune |

## Error Handling

When parsing payloads, consider these potential issues:
1. **String Encoding**: ASCII characters outside printable range (32-126)
2. **Endianness**: All multi-byte values are big-endian

## Integration Notes

- The MMB buffers multiple payload packets before forwarding to S4
- S4 combines payload data with health/safety telemetry
- Ground stations receive combined packets for processing
- Timestamp information is added at the S4 level, not in payload packets
