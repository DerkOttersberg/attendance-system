# RFID RPMSG Message Simulation Guide

## Overview

The RFID reader on the M4 core detects cards and sends the UID (Unique ID) to the A7 core via RPMSG (Remote Processor Messaging) using Virtual UART. This guide shows you how to manually send these messages to simulate card scans without using the physical RFID reader.

---

## How RFID Messages Are Generated

### 1. RFID Detection Flow (main.c)

When a card is detected, the M4 firmware follows this sequence:

```c
// In ExecuteScanOnce() function
void ExecuteScanOnce(void)
{
    uint8_t tagType[2];
    MFRC522_Status_t status = MFRC522_Request(PICC_CMD_REQA, tagType);
    
    if (status == MFRC522_OK) {
        // Step 1: Get card UID via anti-collision
        status = MFRC522_Anticoll(&uid);
        
        if (status == MFRC522_OK) {
            // Step 2: Send UID to A7 core
            qprint("Card UID: ");
            for (uint8_t i = 0; i < uid.size; i++) {
                qprint("%02X ", uid.uidByte[i]);
            }
            qprint("\r\n");
            
            // Step 3: Additional data...
            status = MFRC522_SelectTag(&uid);
            // ... more processing
        }
    }
}
```

### 2. Message Transmission (Virtual UART / RPMSG)

The `qprint()` function sends all output to the A7 core via Virtual UART:

```c
void qprint(const char* format, ...) {
    OPENAMP_check_for_message();
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

**Key Points:**
- Uses `VIRT_UART_Transmit()` - OpenAMP Virtual UART library function
- Sends formatted strings with newlines (`\r\n`)
- Data goes over RPMSG tunnel `/dev/ttyRPMSG0` on A7 side

---

## RFID Message Format

### Example Real Message from Physical Card

When you scan a real MIFARE card with UID `04 3A B2 C1`, the M4 sends:

```
Card UID: 04 3A B2 C1 
Card Type: MIFARE 1K
SAK: 0x08
Authentication successful!
Block 4 data: 00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F
```

### Message Structure

The output contains:
1. **Card UID line**: `Card UID: ` followed by hex bytes separated by spaces and `\r\n`
2. **Card Type line**: Card classification
3. **SAK value**: Select Acknowledge byte (card authentication status)
4. **Authentication status**: Confirms key access
5. **Block data**: If reading blocks

### Minimal Message for Clock-in

For a clock-in simulation, you only need:
```
Card UID: 04 3A B2 C1 
```

---

## How to Manually Send RPMSG Messages

### Method 1: Direct echo to /dev/ttyRPMSG0 (Simplest)

From the **STM32 board** (A7 core), you can send raw data to the M4 core:

```bash
# SSH into STM32
ssh root@<stm32-ip>

# Listen for M4 responses in background
cat /dev/ttyRPMSG0 &
RPMSG_PID=$!

# Send a raw UID message to M4
echo -ne "Card UID: 04 3A B2 C1 \r\n" > /dev/ttyRPMSG0

# Send additional fields if needed
echo -ne "Card Type: MIFARE 1K\r\n" > /dev/ttyRPMSG0
echo -ne "SAK: 0x08\r\n" > /dev/ttyRPMSG0

# Kill the listener
kill $RPMSG_PID
```

**Output:**
```
Card UID: 04 3A B2 C1 
Card Type: MIFARE 1K
SAK: 0x08
```

### Method 2: Send from M4 Core via Commands

The M4 firmware has a built-in command interface. You can send the `scan` command to trigger a scan:

```bash
# Send scan command to M4
echo "scan" > /dev/ttyRPMSG0

# Listen for response
cat /dev/ttyRPMSG0 &

# If no card present, M4 will respond
# If card present, you'll see the real UID
```

### Method 3: Simulate with Python Script

From your **development machine**, you can create a Python script to interact:

```python
#!/usr/bin/env python3
import subprocess
import time

def send_rpmsg_message(stm32_ip, message):
    """Send a message to STM32 via SSH"""
    cmd = f'echo -ne "{message}" > /dev/ttyRPMSG0'
    ssh_cmd = f'ssh root@{stm32_ip} "{cmd}"'
    
    result = subprocess.run(ssh_cmd, shell=True, capture_output=True, text=True)
    return result.returncode == 0

def simulate_rfid_scan(stm32_ip, uid_bytes):
    """Simulate an RFID card scan"""
    
    # Format UID as hex string (e.g., [0x04, 0x3A, 0xB2, 0xC1] → "04 3A B2 C1")
    uid_hex = " ".join([f"{b:02X}" for b in uid_bytes])
    
    # Create the RFID message
    message = f"Card UID: {uid_hex} \\r\\n"
    
    print(f"[*] Sending RFID simulation: {message.strip()}")
    
    if send_rpmsg_message(stm32_ip, message):
        print("[+] Message sent successfully")
        return True
    else:
        print("[-] Failed to send message")
        return False

# Example usage
if __name__ == "__main__":
    STM32_IP = "192.168.1.100"  # Replace with your STM32 IP
    
    # Simulate different card UIDs
    print("=== RFID Simulation ===\n")
    
    # Card 1: UID 04 3A B2 C1
    print("Simulating Card 1:")
    simulate_rfid_scan(STM32_IP, [0x04, 0x3A, 0xB2, 0xC1])
    time.sleep(2)
    
    # Card 2: UID 08 4F C3 D2
    print("\nSimulating Card 2:")
    simulate_rfid_scan(STM32_IP, [0x08, 0x4F, 0xC3, 0xD2])
    time.sleep(2)
    
    # Card 3: UID A1 B2 C3 D4
    print("\nSimulating Card 3:")
    simulate_rfid_scan(STM32_IP, [0xA1, 0xB2, 0xC3, 0xD4])
```

**Run it:**
```bash
python3 simulate_rfid.py
```

### Method 4: Backend API Simulation

If your backend API parses RPMSG messages, you can send HTTP requests directly:

```bash
# Assuming your backend expects JSON with UID
curl -X POST http://<backend-ip>:5000/clock-in \
  -H "Content-Type: application/json" \
  -d '{"uid": "04:3A:B2:C1", "action": "clock_in"}'
```

---

## Understanding the A7 Side (What Receives Messages)

The A7 core reads RPMSG messages from `/dev/ttyRPMSG0`. Your application should parse:

### C Example (reading RPMSG)

```c
#include <stdio.h>
#include <fcntl.h>
#include <unistd.h>
#include <string.h>

int main() {
    int fd = open("/dev/ttyRPMSG0", O_RDONLY);
    if (fd < 0) {
        perror("Failed to open /dev/ttyRPMSG0");
        return 1;
    }
    
    char buffer[256];
    ssize_t n;
    
    printf("Listening for RFID messages...\n");
    
    while (1) {
        n = read(fd, buffer, sizeof(buffer) - 1);
        if (n > 0) {
            buffer[n] = '\0';
            printf("Received: %s", buffer);
            
            // Parse UID
            if (strncmp(buffer, "Card UID:", 9) == 0) {
                printf("UID detected! Processing clock-in...\n");
                // Extract UID bytes and process
            }
        }
    }
    
    close(fd);
    return 0;
}
```

### Python Example (reading RPMSG)

```python
import sys

def read_rpmsg_messages():
    """Read messages from RPMSG device"""
    try:
        with open('/dev/ttyRPMSG0', 'rb') as f:
            print("Listening for RFID messages...")
            
            while True:
                data = f.read(256)
                if data:
                    message = data.decode('utf-8', errors='ignore').strip()
                    print(f"[RPMSG] {message}")
                    
                    if "Card UID:" in message:
                        # Extract and process UID
                        uid_line = message.split("Card UID:")[1].strip()
                        print(f"[*] UID: {uid_line}")
                        # Trigger clock-in logic
                        
    except FileNotFoundError:
        print("Error: /dev/ttyRPMSG0 not found. Ensure M4 firmware is running.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    read_rpmsg_messages()
```

**Run it (on STM32):**
```bash
python3 read_rpmsg.py &
```

---

## Complete Testing Workflow

### 1. Start M4 Core (if not already running)

```bash
# On STM32, ensure M4 firmware is loaded
cat /sys/class/remoteproc/remoteproc0/state
# Should output: running

# If not, start it:
cd /sys/class/remoteproc/remoteproc0
echo rproc-m4-fw.elf > firmware
echo start > state
```

### 2. Start Message Listener

```bash
# Terminal 1 - Listen for all M4 messages
cat /dev/ttyRPMSG0
```

### 3. Send Simulated Scan

```bash
# Terminal 2 - Send RFID simulation
echo -ne "Card UID: 04 3A B2 C1 \r\n" > /dev/ttyRPMSG0
```

### 4. Observe Output

```
Card UID: 04 3A B2 C1 
```

### 5. Full Workflow with Block Data

```bash
# Send complete card info
echo -ne "Card UID: 04 3A B2 C1 \r\n" > /dev/ttyRPMSG0
echo -ne "Card Type: MIFARE 1K\r\n" > /dev/ttyRPMSG0
echo -ne "SAK: 0x08\r\n" > /dev/ttyRPMSG0
echo -ne "Authentication successful!\r\n" > /dev/ttyRPMSG0
echo -ne "Block 4 data: 00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F\r\n" > /dev/ttyRPMSG0
```

---

## Common UID Formats

Use these test UIDs for different card types:

| UID | Card Type | Description |
|-----|-----------|-------------|
| `04 3A B2 C1` | MIFARE 1K (4-byte) | Standard MIFARE |
| `08 4F C3 D2` | MIFARE 1K (4-byte) | Another standard card |
| `A1 B2 C3 D4` | Generic UID | Test UID |
| `FF FF FF FF` | Invalid | For testing error handling |
| `04 3A B2 C1 9E` | MIFARE 1K (7-byte) | Extended UID (5 bytes) |

---

## Debugging Tips

### Check if M4 is Running

```bash
cat /sys/class/remoteproc/remoteproc0/state
# Output: running or offline
```

### Check if RPMSG Device Exists

```bash
ls -la /dev/ttyRPMSG*
# Should show /dev/ttyRPMSG0
```

### Monitor Kernel Messages

```bash
dmesg | tail -20
# Look for remoteproc or rpmsg messages
```

### Test RPMSG Communication

```bash
# Send test message
echo "test" > /dev/ttyRPMSG0

# Check M4 response in listener
cat /dev/ttyRPMSG0 &
```

### Verify Backend is Receiving Messages

If you have a backend API listening:

```bash
# In another terminal, check backend logs
tail -f /var/log/backend.log

# Or use tcpdump to monitor network
sudo tcpdump -i any port 5000
```

---

## Integration with Clock-in System

### Full Test Scenario

1. **Start services:**
   ```bash
   # Ensure all services running
   systemctl status m4-autostart.service
   systemctl status imgui-app.service
   ```

2. **Send simulated card:**
   ```bash
   echo -ne "Card UID: 04 3A B2 C1 \r\n" > /dev/ttyRPMSG0
   ```

3. **Check backend receives it:**
   ```bash
   curl http://<backend-ip>:5000/health
   # Should show normal operation
   
   # Check dashboard for new attendance record
   # http://<backend-ip>:8080
   ```

4. **Verify in database:**
   ```bash
   # SSH into backend
   mysql -h localhost -u user -p attendance_db
   SELECT * FROM attendance WHERE rfid_uid = '043AB2C1';
   ```

---

## Advanced: Custom M4 Firmware Modifications

If you want to add a command to send fake UIDs from the M4 itself, add this to `main.c`:

```c
// Add to ProcessCommand() function
else if (strncmp(cmd, "fake:", 5) == 0) {
    // Parse: fake:04:3A:B2:C1
    char* uidStr = cmd + 5;
    
    qprint("\r\n=== Card Detected (Simulated) ===\r\n");
    qprint("Card UID: ");
    
    // Parse and send each byte
    uint8_t uidBytes[4];
    sscanf(uidStr, "%hhx:%hhx:%hhx:%hhx", 
           &uidBytes[0], &uidBytes[1], &uidBytes[2], &uidBytes[3]);
    
    for (int i = 0; i < 4; i++) {
        qprint("%02X ", uidBytes[i]);
    }
    qprint("\r\n");
    qprint("Card Type: MIFARE 1K\r\n");
    qprint("SAK: 0x08\r\n");
}
```

Then use it:
```bash
echo "fake:04:3A:B2:C1" > /dev/ttyRPMSG0
```

---

## Summary

**Physical Card → RPMSG Message Translation:**

```
Physical RFID Card (04 3A B2 C1)
         ↓
   M4 Core Detects (MFRC522 reader)
         ↓
   ExecuteScanOnce() reads UID
         ↓
   qprint() formats as "Card UID: 04 3A B2 C1"
         ↓
   VIRT_UART_Transmit() sends via RPMSG
         ↓
   /dev/ttyRPMSG0 (A7 core receives)
         ↓
   Your Application/Backend Processes
```

**To Simulate Without Physical Card:**

```
Terminal Command (echo "Card UID: 04 3A B2 C1" > /dev/ttyRPMSG0)
         ↓
   /dev/ttyRPMSG0 (Direct injection)
         ↓
   Your Application/Backend Processes
```

---

**Last Updated**: January 28, 2026
