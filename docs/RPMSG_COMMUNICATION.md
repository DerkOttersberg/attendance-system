# RPMSG Communication: M4 ↔ A7 Core Protocol

> Technical reference for inter-core communication between M4 firmware and A7 Linux via RPMSGtty0

---

## Overview

The STM32MP157F-DK2 has two cores that need to communicate:
- **M4 Core**: Real-time firmware handling RFID reader, LEDs, buzzer
- **A7 Core**: Linux (Cortex-A7) running ImGui application, network stack

**RPMSG** (Remote Processor Messaging) is OpenAMP's message-passing protocol:
- **Virtual UART over IPC**: Uses IPCC (Inter-Processor Communication Controller)
- **Bidirectional**: Both cores can send/receive messages
- **Device**: `/dev/ttyRPMSG0` on A7 Linux side
- **Protocol**: Plain text commands + responses (reverse-engineered from dk2 v1.0.4/main.c)

**Architecture**:
```
┌─────────────────────────────────────┐
│  A7 Core (Linux)                    │
│  ┌─────────────────────────────┐    │
│  │  ImGui Application          │    │
│  │  (C++ using libcurl)        │    │
│  └──────────┬──────────────────┘    │
│             │ (write to /dev/ttyRPMSG0)
│             │ (read from /dev/ttyRPMSG0)
│  ┌──────────▼──────────────────┐    │
│  │  RPMSG Virtual UART Driver  │    │
│  │  (virt_uart.c)              │    │
│  └──────────┬──────────────────┘    │
│             │ OpenAMP/IPCC
├─────────────┼─────────────────────┤
│             │ (IPCC Interrupt)    │
│  ┌──────────▼──────────────────┐    │
│  │  IPCC (Inter-Processor      │    │
│  │  Communication Controller)  │    │
│  └──────────┬──────────────────┘    │
│             │ Shared Memory       │
│  ┌──────────▼──────────────────┐    │
│  │  M4 Core (Firmware)         │    │
│  │  ┌─────────────────────┐    │    │
│  │  │  VIRT_UART Handler  │    │    │
│  │  │  (virt_uart.c)      │    │    │
│  │  └─────────┬───────────┘    │    │
│  │            │                │    │
│  │  ┌─────────▼───────────┐    │    │
│  │  │  Command Processor  │    │    │
│  │  │  ProcessCommand()   │    │    │
│  │  └─────────┬───────────┘    │    │
│  │            │                │    │
│  │  ┌─────────▼───────────┐    │    │
│  │  │  RFID Reader        │    │    │
│  │  │  LEDs, Buzzer       │    │    │
│  │  │  (Hardware Control) │    │    │
│  │  └─────────────────────┘    │    │
│  └────────────────────────────┘    │
└─────────────────────────────────────┘
```

---

## Protocol Specification

### Message Format

**From A7 → M4 (Commands)**:
```
<COMMAND>\r\n
```

**From M4 → A7 (Responses)**:
```
<RESPONSE>\r\n
```

**Key points**:
- **Delimiter**: `\r\n` (carriage return + line feed)
- **Encoding**: ASCII text (printable characters)
- **Buffer size**: 256 bytes (RX_BUFFER_SIZE in main.c)
- **Max command length**: 255 bytes (excluding null terminator)

### Handshake on Startup

When M4 core starts, it sends:

```
=== M4 Core Started ===
RFID Reader Ready
Available commands:
  scan        - Scan for card once
  status      - Get system status
  read:N      - Read block N (e.g., read:4)
  write:N:DATA - Write to block N
  buzz        - Test buzzer
  beep        - Test single beep
  red_on      - Turn red LED on
  red_off     - Turn red LED off
  green_on    - Turn green LED on
  green_off   - Turn green LED off
===================
```

**Wait time**: Allow 2-3 seconds after boot before sending commands

---

## Command Reference

### Core Commands

#### 1. SCAN (Scan for RFID Card)

**Request**:
```
scan
```

**Response (Card detected)**:
```
RX: scan

=== Card Detected ===
Card UID: 04 3A B2 C1 
Card Type: Mifare1K
SAK: 0x08
Authentication successful!
Block 4 data: 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F 10 
ASCII: ............
=== End ===
```

**Response (No card)**:
```
RX: scan
(timeout, no response)
```

**Use case**: ImGui app calls this when user presents card to RFID reader

**Timing**:
- Scan detection: ~100-200ms
- Full scan (detect + authenticate + read): ~500-1000ms
- Auto-scan interval: 100ms (built-in continuous scanning)

---

#### 2. STATUS (Get M4 System Status)

**Request**:
```
status
```

**Response**:
```
RX: status
>> Status:
   M4 Core: Running
   RFID: OK
   Uptime: 1234567 ms
```

**Use case**: Verify M4 firmware is responsive and healthy

---

#### 3. READ Block (Read RFID Card Data)

**Request**:
```
read:4
```

Where `4` is the block number (0-63 depending on card type)

**Response**:
```
RX: read:4
>> Reading block 4...
(Card detection and authentication happens)
Block 4 data: FF FF FF FF FF FF 07 08 04 00 69 90 DA D0 D3 2E 
ASCII: .......i.....
```

**Block addressing for Mifare Classic 1K**:
```
Sector 0: Blocks 0-3
  Block 0: Manufacturer data (read-only)
  Block 1: User data
  Block 2: User data
  Block 3: Sector trailer (keys + access bits)
  
Sector 1: Blocks 4-7
  Block 4-6: User data
  Block 7: Sector trailer
  
... (continues through Sector 15)
```

**Common blocks**:
- Block 0: Card UID and manufacturer info (read-only)
- Blocks 4, 5, 6: User data (requires key authentication)
- Block 3, 7, 11, etc: Trailer blocks (keys and access control)

---

#### 4. WRITE Block (Write RFID Card Data)

**Request**:
```
write:4:Hello World
```

Where `4` is block number and `Hello World` is data to write

**Response**:
```
RX: write:4:Hello World
>> Writing to block 4...
(Card detection and authentication)
Write completed successfully
```

**Data encoding**:
- Writes exactly 16 bytes to block
- If data < 16 bytes, pads with spaces (ASCII 0x20)
- Example: `"Hello"` becomes `"Hello           "` (padded to 16)

**Use case**: Store employee ID, signature data, etc. on RFID card

---

#### 5. BEEP (Single Buzzer Beep)

**Request**:
```
beep
```

**Response**:
```
RX: beep
>> Beep Once...
(buzzer beeps for 50ms)
>> Done
```

**Hardware**: Timer 16 (TIM16) PWM on PA8

---

#### 6. BUZZ (Multiple Beeps)

**Request**:
```
buzz
```

**Response**:
```
RX: buzz
>> Buzzing...
(3 beeps, 50ms each, 50ms apart)
Green LED ON
Red LED OFF
>> Done
```

**Pattern**: 50ms beep, 50ms pause, 50ms beep, 50ms pause, 50ms beep

---

#### 7. LED Control

**Red LED ON**:
```
red_on
```

Response:
```
RX: red_on
>> Red LED ON
```

**Red LED OFF**:
```
red_off
```

Response:
```
RX: red_off
>> Red LED OFF
```

**Green LED ON**:
```
green_on
```

Response:
```
RX: green_on
>> Green LED ON
```

**Green LED OFF**:
```
green_off
```

Response:
```
RX: green_off
>> Green LED OFF
```

**GPIO Mapping** (from main.c):
- Red LED: LED_RED_GPIO_Port, LED_RED_Pin
- Green LED: LED_GREEN_GPIO_Port, LED_GREEN_Pin

---

#### 8. HELP (Show Available Commands)

**Request**:
```
help
```

**Response**:
```
RX: help
>> Available commands:
   scan           - Scan for card once
   status         - Get system status
   read:N         - Read block N
   write:N:DATA   - Write DATA to block N
   buzz           - Test buzzer
   help           - Show this help
```

---

## Linux Side (A7) Integration

### Reading from RPMSG

**File device**: `/dev/ttyRPMSG0`

**In C/C++ (ImGui)**:

```c
#include <unistd.h>
#include <fcntl.h>
#include <string.h>

// Open RPMSG device
int rpmsg_fd = open("/dev/ttyRPMSG0", O_RDWR | O_NOCTTY);
if (rpmsg_fd < 0) {
    perror("Failed to open /dev/ttyRPMSG0");
    return;
}

// Read response from M4
char buffer[256];
ssize_t bytes_read = read(rpmsg_fd, buffer, sizeof(buffer) - 1);
if (bytes_read > 0) {
    buffer[bytes_read] = '\0';
    printf("M4 Response:\n%s\n", buffer);
}

close(rpmsg_fd);
```

### Writing to RPMSG

```c
// Open RPMSG device
int rpmsg_fd = open("/dev/ttyRPMSG0", O_RDWR | O_NOCTTY);

// Send command to M4
const char* command = "scan\r\n";
ssize_t bytes_written = write(rpmsg_fd, command, strlen(command));

if (bytes_written < 0) {
    perror("Failed to write to M4");
}

close(rpmsg_fd);
```

### Full Request-Response Example

```c
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <fcntl.h>
#include <string.h>
#include <time.h>

int send_rpmsg_command(const char* cmd, char* response, size_t resp_size) {
    // Open RPMSG device
    int fd = open("/dev/ttyRPMSG0", O_RDWR | O_NOCTTY | O_NONBLOCK);
    if (fd < 0) {
        perror("open /dev/ttyRPMSG0");
        return -1;
    }
    
    // Send command
    char full_cmd[260];
    snprintf(full_cmd, sizeof(full_cmd), "%s\r\n", cmd);
    
    ssize_t written = write(fd, full_cmd, strlen(full_cmd));
    if (written < 0) {
        perror("write");
        close(fd);
        return -1;
    }
    
    printf("Sent: %s", full_cmd);
    
    // Wait for response (max 2 seconds)
    time_t start = time(NULL);
    memset(response, 0, resp_size);
    
    while (time(NULL) - start < 2) {
        ssize_t read_bytes = read(fd, response, resp_size - 1);
        if (read_bytes > 0) {
            response[read_bytes] = '\0';
            close(fd);
            return read_bytes;
        }
        usleep(100000);  // Wait 100ms before retry
    }
    
    printf("No response from M4\n");
    close(fd);
    return 0;
}

// Usage:
int main() {
    char response[512];
    int size = send_rpmsg_command("scan", response, sizeof(response));
    if (size > 0) {
        printf("Response:\n%s\n", response);
    }
    return 0;
}
```

---

## M4 Firmware Implementation

### Command Receiving (Callback)

From main.c line 630:

```c
void VIRT_UART_RxCpltCallback(VIRT_UART_HandleTypeDef *huart)
{
    // Data is automatically in the RX buffer
    // huart->RxXferSize contains the number of bytes received
    
    for (uint16_t i = 0; i < huart->RxXferSize; i++) {
        uint8_t data = huart->pRxBuffPtr[i];
        
        if (data == '\n' || data == '\r') {
            // End of command
            if (rxIndex > 0) {
                rxBuffer[rxIndex] = '\0';
                commandReady = 1;
                rxIndex = 0;  // Reset for next command
            }
        } else if (rxIndex < RX_BUFFER_SIZE - 1) {
            // Add to buffer
            rxBuffer[rxIndex++] = data;
        }
    }
}
```

**Flow**:
1. VIRT_UART receives bytes from A7
2. Each byte is checked: if `\r` or `\n`, command is complete
3. `commandReady` flag is set
4. Main loop processes command via `ProcessCommand(rxBuffer)`

### Command Processing

From main.c line 655:

```c
void ProcessCommand(char* cmd)
{
    // Trim whitespace
    while (*cmd == ' ' || *cmd == '\t') cmd++;
    
    qprint("RX: %s\r\n", cmd);  // Echo command for debugging
    
    // Parse and execute command
    if (strncmp(cmd, "scan", 4) == 0) {
        ExecuteScanOnce();
    } else if (strncmp(cmd, "status", 6) == 0) {
        qprint(">> Status: ...\r\n");
    }
    // ... more commands
}
```

### Response Sending (qprint)

From main.c (around line 945):

```c
void qprint(const char* format, ...)
{
    char buffer[256];
    va_list args;
    va_start(args, format);
    int len = vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    
    if (len > 0) {
        VIRT_UART_Transmit(&huart0, (uint8_t*)buffer, len);
    }
}
```

**Flow**:
1. `qprint()` formats message (like `printf`)
2. Sends via `VIRT_UART_Transmit()` to A7
3. A7 reads from `/dev/ttyRPMSG0`

---

## Auto-Scan Mode

### Continuous Card Detection

From main.c line 225:

```c
// Auto-scan mode (can be disabled via command)
if (autoScanEnabled && (HAL_GetTick() - lastAutoScan > 100)) {
    lastAutoScan = HAL_GetTick();
    ExecuteScanOnce();
}
```

**Behavior**:
- Scans continuously every 100ms
- If card detected, prints UID and data
- No special command needed
- Can be enabled/disabled (modify in firmware)

**Output**:
```
=== Card Detected ===
Card UID: 04 3A B2 C1
Card Type: Mifare1K
...
=== End ===
```

**A7 app must parse these messages** if relying on auto-scan

**Better approach**: Send explicit "scan" command when needed

---

## Debugging RPMSG Communication

### From Linux Side (A7)

**Monitor all RPMSG messages**:
```bash
# Watch kernel logs
dmesg -w | grep -i rpmsg

# Check RPMSG device
ls -la /dev/ttyRPMSG*

# Read raw data from RPMSG
cat /dev/ttyRPMSG0

# Send test command
echo "beep" > /dev/ttyRPMSG0
```

### From M4 Side

**Serial console on UART3**:
```bash
# Connect USB serial adapter to UART3 pins
# Terminal: 115200 baud

# Boot messages appear automatically
# Send commands via /dev/ttyRPMSG0 from A7, responses print here
```

### Troubleshooting

**Problem**: A7 sends command but no response

```bash
# Check 1: Is M4 running?
cat /sys/class/remoteproc/remoteproc0/state
# Should output: "running"

# Check 2: Is RPMSG device present?
ls /dev/ttyRPMSG0
# Should exist

# Check 3: Can we write to it?
echo "status" > /dev/ttyRPMSG0
# Should get response (may be buffered)

# Check 4: Read with cat (blocks until data)
timeout 2 cat /dev/ttyRPMSG0
# Should show responses
```

---

## Performance Characteristics

### Latency

| Operation | Time |
|-----------|------|
| Command transmission | < 1ms |
| M4 processing | 1-10ms |
| Response transmission | < 1ms |
| **Total round-trip** | **5-50ms** |

### Throughput

- **Baud rate equivalent**: Virtual (no actual baud rate)
- **Max message size**: 256 bytes
- **Max messages/sec**: ~100+ (depends on processing)

### Reliability

- **Error-free**: OpenAMP handles CRC, retransmission
- **No data loss**: All bytes guaranteed to arrive
- **In-order**: Messages maintain order

---

## Integration with ImGui Application

### Example: Card Scan in ImGui

```cpp
#include <unistd.h>
#include <fcntl.h>

// Global RPMSG file descriptor
int g_rpmsg_fd = -1;

// Called on startup
void init_rpmsg() {
    g_rpmsg_fd = open("/dev/ttyRPMSG0", O_RDWR | O_NOCTTY | O_NONBLOCK);
    if (g_rpmsg_fd < 0) {
        fprintf(stderr, "Failed to open RPMSG\n");
    }
}

// Called when user presses "Scan Card" button
void on_scan_button_clicked() {
    write(g_rpmsg_fd, "scan\r\n", 6);
}

// Called in main render loop (every frame)
void check_rpmsg_responses() {
    char buffer[256];
    ssize_t bytes = read(g_rpmsg_fd, buffer, sizeof(buffer) - 1);
    
    if (bytes > 0) {
        buffer[bytes] = '\0';
        
        // Parse response
        if (strstr(buffer, "Card UID:")) {
            // Extract UID from response
            printf("Card detected! Response:\n%s\n", buffer);
            
            // Send to backend API
            // POST /api/scan with UID
        }
    }
}

// At shutdown
void cleanup_rpmsg() {
    if (g_rpmsg_fd >= 0) {
        close(g_rpmsg_fd);
    }
}
```

---

## Extension: Custom Commands

### Adding New M4 Command

To add a custom command (e.g., "calibrate"):

**In M4 firmware (main.c)**:

```c
} else if (strncmp(cmd, "calibrate", 9) == 0) {
    qprint(">> Calibrating RFID reader...\r\n");
    // Your calibration code here
    MFRC522_Init(&mfrc522);
    qprint(">> Calibration complete\r\n");
}
```

**From A7 (Linux)**:

```c
write(rpmsg_fd, "calibrate\r\n", 11);
// Wait for response
```

---

## Reference: VirtUART Handler

The VIRT_UART (virtual UART) is part of OpenAMP and abstracts RPMSG communication:

**Key functions**:
- `VIRT_UART_Init()` - Initialize virtual UART
- `VIRT_UART_Transmit()` - Send data
- `VIRT_UART_Receive()` - Receive data (non-blocking)
- `VIRT_UART_RegisterCallback()` - Set receive callback
- `/dev/ttyRPMSG0` - Device file interface

---

## See Also

- [SETUP_STM32_M4_FIRMWARE.md](SETUP_STM32_M4_FIRMWARE.md) - M4 compilation and deployment
- [HARDWARE_SETUP.md](HARDWARE_SETUP.md) - Hardware wiring and RFID reader
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md#m4-communication-fails) - M4 communication troubleshooting
- [dk2 v1.0.4/main.c](../product/STM32CUBEIDE/workspace_1.19.0/dk2%20v1.0.4/main.c) - Source code reference

---

**Last Updated**: January 28, 2026
**Protocol Version**: 1.0 (reverse-engineered from dk2 v1.0.4)
