# STM32MP157F-DK2: M4 Firmware Setup

> **Location**: Compile on your laptop, deploy to STM32MP157F-DK2

---

## Overview

The STM32MP157F-DK2 has two processor cores:
- **Cortex-A7 (Linux)** - Runs the ImGui application
- **Cortex-M4** - Runs embedded firmware for RFID reading & hardware control

This guide covers compiling the M4 firmware on your development machine and deploying it to the board for auto-start at boot.

### Prerequisites

- **Development Machine**: Windows/Mac/Linux with STM32CubeIDE installed
- **STM32CubeIDE**: v1.10.0 or higher
- **ARM GCC Compiler**: Pre-installed with STM32CubeIDE
- **SSH Access**: To the STM32MP157F-DK2 board
- **Project Source**: `Product/STMCUBEIDE/dk2/`

---

## Quick Start (15 minutes)

### Step 1: Build Release Firmware (On Your Laptop)

Open STM32CubeIDE and compile the M4 firmware:

```
1. File → Import → Existing Projects into Workspace
2. Browse to: Product/STMCUBEIDE/dk2/
3. Select project → Finish
4. Right-click project → Build Configurations → Set Active → Release
5. Right-click project → Build Project
6. Wait for build to complete (should see "Finished building: ...")
```

**Expected Output**:
```
Finished building: YourProjectName.elf
```

**Location of compiled binary:**
```
Product/STMCUBEIDE/dk2/Release/YourProjectName.elf
```

### Step 2: Copy to STM32 Board (On Your Laptop)

Transfer the compiled firmware to the board:

```bash
# From your development machine
scp Product/STMCUBEIDE/dk2/Release/YourProjectName.elf root@<stm32-ip>:/lib/firmware/
```

**Replace `<stm32-ip>`** with your board's IP (e.g., `192.168.1.100`)

### Step 3: Create Symlink (On STM32 Board)

SSH into the board and create a symlink:

```bash
ssh root@<stm32-ip>

# Navigate to firmware directory
cd /lib/firmware

# Create symlink to the firmware
ln -sf YourProjectName.elf rproc-m4-fw.elf

# Verify symlink
ls -la rproc-m4-fw.elf
```

**Expected**:
```
lrwxrwxrwx 1 root root 24 Jan 28 10:15 rproc-m4-fw.elf -> YourProjectName.elf
```

### Step 4: Test Manual M4 Start (On STM32 Board)

Start the M4 firmware manually to verify it works:

```bash
cd /sys/class/remoteproc/remoteproc0

# Load firmware
echo rproc-m4-fw.elf > firmware

# Start M4 processor
echo start > state

# Verify it's running
cat state
```

**Expected Output**: `running`

### Step 5: Test M4 Communication (On STM32 Board)

Verify M4 is responsive:

```bash
# Listen for M4 messages (run in background)
cat /dev/ttyRPMSG0 &

# Send test command to wake M4
echo "test" > /dev/ttyRPMSG0

# M4 should respond with output
# You should see a response in the terminal
```

### Step 6: Enable Auto-Start (On STM32 Board)

Set up systemd to auto-load firmware at boot:

```bash
# View the service (should already exist):
cat /etc/systemd/system/m4-autostart.service

# Enable auto-start
sudo systemctl daemon-reload
sudo systemctl enable m4-autostart.service
sudo systemctl start m4-autostart.service

# Verify
sudo systemctl status m4-autostart.service
```

**Expected**:
```
● m4-autostart.service - Auto-start STM32 M4 Firmware
     Loaded: loaded (...; enabled; ...)
     Active: active (exited) since ...
```

### Step 7: Reboot and Verify (On STM32 Board)

Test that M4 auto-starts after reboot:

```bash
sudo reboot

# After reboot (wait 30 seconds):
ssh root@<stm32-ip>

# Check M4 is running
cat /sys/class/remoteproc/remoteproc0/state  # Should show "running"

# Test M4 communication
cat /dev/ttyRPMSG0 &
echo "test" > /dev/ttyRPMSG0
# Should see response
```

✅ **Success**: M4 firmware is loaded and auto-starting!

---

## Detailed Workflow

### Understanding M4 Firmware Compilation

**Project Structure:**
```
Product/STMCUBEIDE/dk2/
├── main.c                          # M4 firmware entry point
├── Src/
│   ├── mfrc522.c                  # RFID reader driver
│   ├── uart_rpmsg.c               # RPMSG communication
│   └── gpio_control.c             # LED/Buzzer control
├── Inc/
│   ├── mfrc522.h
│   ├── rpmsg.h
│   └── config.h
└── Release/                        # Compiled output
    └── YourProjectName.elf        # Binary file
```

**Compilation Details:**
- **Compiler**: ARM GCC (Cortex-M4 specific)
- **Optimization**: Release mode (O2 optimization)
- **Output**: ELF 32-bit format
- **Size**: Typically 100-500 KB
- **Target**: STM32MP157F M4 core

### Verifying Compiled Binary

After building, verify the binary:

```bash
# On your laptop (in the Release directory):
file Release/YourProjectName.elf
# Expected: ELF 32-bit LSB executable, ARM, EABI5 version 1

# Check binary size:
ls -lh Release/YourProjectName.elf
# Should show size in KB (e.g., 250K)

# List symbols (optional):
arm-none-eabi-nm Release/YourProjectName.elf | head -20
```

### Deployment Process

**Step-by-step data flow:**

```
┌─────────────────────┐
│ Development Machine │
└──────────┬──────────┘
           │
           │ 1. Compile with STM32CubeIDE
           │
           ▼
    ┌──────────────┐
    │ YourFW.elf   │ (in Release/)
    └──────┬───────┘
           │
           │ 2. SCP transfer
           │
           ▼
┌─────────────────────────────────┐
│ STM32MP157F-DK2 (Cortex-A7)     │
│  /lib/firmware/YourFW.elf       │
└──────────┬──────────────────────┘
           │
           │ 3. Create symlink
           │ rproc-m4-fw.elf → YourFW.elf
           │
           ▼
    ┌──────────────────────────┐
    │ /sys/class/remoteproc/   │
    │ remoteproc0/firmware     │
    │ remoteproc0/state        │
    └──────┬───────────────────┘
           │
           │ 4. Load & start
           │ echo rproc-m4-fw.elf > firmware
           │ echo start > state
           │
           ▼
    ┌──────────────────────────┐
    │ M4 Cortex-M4 Processor   │
    │ - RFID polling           │
    │ - LED/Buzzer control     │
    │ - RPMSG to A7            │
    └──────────────────────────┘
```

---

## Manual M4 Firmware Management

### Start M4 Firmware

```bash
cd /sys/class/remoteproc/remoteproc0

echo rproc-m4-fw.elf > firmware
echo start > state

# Verify
cat state  # Should show "running"
```

### Stop M4 Firmware

```bash
cd /sys/class/remoteproc/remoteproc0

echo stop > state

# Verify
cat state  # Should show "offline"
```

### Restart M4 Firmware

```bash
cd /sys/class/remoteproc/remoteproc0

echo stop > state
sleep 1
echo rproc-m4-fw.elf > firmware
echo start > state

# Verify
cat state  # Should show "running"
```

### Check M4 Status

```bash
# Current state
cat /sys/class/remoteproc/remoteproc0/state

# Detailed info
cat /sys/class/remoteproc/remoteproc0/name          # Should show: m4
cat /sys/class/remoteproc/remoteproc0/firmware
cat /sys/class/remoteproc/remoteproc0/power/control
```

---

## Updating M4 Firmware

### When You Modify M4 Code

1. **Edit code** in STM32CubeIDE
2. **Build Release version** (Right-click → Build Project)
3. **Copy to board:**
   ```bash
   scp Release/YourProjectName.elf root@<stm32-ip>:/lib/firmware/
   ```
4. **Update symlink** (on STM32):
   ```bash
   cd /lib/firmware
   ln -sf YourProjectName.elf rproc-m4-fw.elf
   ```
5. **Restart M4:**
   ```bash
   sudo systemctl restart m4-autostart.service
   ```
6. **Verify:**
   ```bash
   cat /sys/class/remoteproc/remoteproc0/state  # Should show "running"
   ```

### Version Management

Keep firmware versions organized:

```bash
# On the STM32:
cd /lib/firmware

# Store versions with dates
ls -la
# m4_firmware_v1.0.0.elf
# m4_firmware_v1.0.1.elf
# m4_firmware_v1.0.2.elf (current)
# rproc-m4-fw.elf → m4_firmware_v1.0.2.elf

# To rollback to previous version:
ln -sf m4_firmware_v1.0.1.elf rproc-m4-fw.elf
sudo systemctl restart m4-autostart.service
```

---

## Troubleshooting M4 Firmware

### M4 Service Won't Start

**Check 1 - Verify firmware file exists:**
```bash
ls -la /lib/firmware/rproc-m4-fw.elf
file /lib/firmware/rproc-m4-fw.elf
# Should show: ELF 32-bit
```

**Check 2 - Check symlink is correct:**
```bash
cd /lib/firmware
readlink rproc-m4-fw.elf
# Should show actual filename
```

**Check 3 - Check remoteproc device:**
```bash
ls -la /sys/class/remoteproc/
cat /sys/class/remoteproc/remoteproc0/name  # Should show: m4
```

**Check 4 - View kernel messages:**
```bash
dmesg | grep -i remoteproc
dmesg | grep -i m4

# Or view live:
journalctl -f | grep remoteproc
```

**Check 5 - Test manual load:**
```bash
cd /sys/class/remoteproc/remoteproc0
echo rproc-m4-fw.elf > firmware
echo start > state
cat state  # If shows "failed", check dmesg output above
```

### M4 Communication Not Working

**Symptom**: M4 starts but doesn't respond to commands

**Check 1 - Verify RPMSG device exists:**
```bash
ls -la /dev/ttyRPMSG*
# Should show: /dev/ttyRPMSG0
```

**Check 2 - Test RPMSG communication:**
```bash
# Listen for M4 messages:
cat /dev/ttyRPMSG0 &
LISTEN_PID=$!

# Send test command:
echo "help" > /dev/ttyRPMSG0

# Wait for response:
sleep 2

# Kill listener:
kill $LISTEN_PID
```

**Check 3 - Check firmware logs:**
```bash
# View M4 debug output (if firmware logs to RPMSG):
timeout 5 cat /dev/ttyRPMSG0

# Check RPMSG module:
lsmod | grep rpmsg
```

### M4 Crashes After Start

**Symptom**: M4 state shows "running" initially, then changes to "crashed"

**Check 1 - View crash information:**
```bash
# Check if crash dump available:
cat /sys/kernel/debug/remoteproc/remoteproc0/trace0 2>/dev/null || echo "No trace"

# View kernel messages:
dmesg | tail -30
```

**Check 2 - Common causes:**
- Firmware exceeds M4 memory (check linker script)
- Infinite loop or exception in firmware
- Stack overflow (increase stack size in linker script)
- Accessing invalid memory address

**Check 3 - Recompile with debug symbols:**
```bash
# In STM32CubeIDE:
# Right-click project → Properties
# C/C++ Build → Settings → Optimization: None (-O0)
# Add debug symbols: -g3
# Rebuild → Build Configurations → Debug
# Transfer debug binary to board for troubleshooting
```

### Firmware Version Mismatch

**Symptom**: Old firmware still running after update

**Solution:**
```bash
# Stop M4:
sudo systemctl stop m4-autostart.service

# Check current symlink:
ls -la /lib/firmware/rproc-m4-fw.elf

# Update symlink to new version:
cd /lib/firmware
ln -sf NewFirmwareName.elf rproc-m4-fw.elf

# Restart:
sudo systemctl start m4-autostart.service

# Verify:
cat /sys/class/remoteproc/remoteproc0/state  # Should show "running"
```

---

## M4 Firmware Development

### Building Debug Version

For active debugging:

```bash
# In STM32CubeIDE:
1. Right-click project → Build Configurations → Set Active → Debug
2. Right-click → Build Project
3. Download via ST-LINK debugger
4. Use STM32CubeIDE debugger (breakpoints, step, watch variables)
```

### RFID Testing

After deploying firmware, test RFID functionality:

```bash
# Listen to M4 output:
cat /dev/ttyRPMSG0 &

# Scan an RFID card near the reader
# You should see output like:
# Card detected!
# UID: A1 B2 C3 D4
# Card type: MIFARE 1KB
```

### LED & Buzzer Testing

Test hardware feedback:

```bash
# Turn on red LED:
echo "red_on" > /dev/ttyRPMSG0

# Beep buzzer:
echo "buzz" > /dev/ttyRPMSG0

# Turn off LED:
echo "red_off" > /dev/ttyRPMSG0
```

---

## Service Configuration (Auto-Start)

The M4 firmware auto-starts via systemd. Service details:

**File**: `/etc/systemd/system/m4-autostart.service`

```ini
[Unit]
Description=Auto-start STM32 M4 Firmware
After=multi-user.target

[Service]
Type=oneshot
ExecStart=/bin/sh -c 'echo rproc-m4-fw.elf > /sys/class/remoteproc/remoteproc0/firmware'
ExecStart=/bin/sh -c 'echo start > /sys/class/remoteproc/remoteproc0/state'
ExecStart=/bin/sleep 2
ExecStart=/bin/sh -c 'echo a > /dev/ttyRPMSG0'
RemainAfterExit=yes
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

See [SETUP_STM32_IMGUI_KIOSK.md](SETUP_STM32_IMGUI_KIOSK.md) for complete systemd service setup.

---

## Next Steps

1. **Enable ImGui kiosk mode:**
   See [SETUP_STM32_IMGUI_KIOSK.md](SETUP_STM32_IMGUI_KIOSK.md)

2. **Test complete system:**
   - Scan RFID card on device
   - Check ImGui displays card UID
   - Verify backend receives API call

3. **Deploy backend (if not already done):**
   See [SETUP_HOST_BACKEND.md](SETUP_HOST_BACKEND.md)

---

## Related Documentation

- [SETUP_STM32_WIFI.md](SETUP_STM32_WIFI.md) - WiFi configuration
- [SETUP_STM32_IMGUI_KIOSK.md](SETUP_STM32_IMGUI_KIOSK.md) - ImGui auto-start
- [DEVICE_FIRMWARE.md](DEVICE_FIRMWARE.md) - M4 firmware details & commands
- [HARDWARE_SETUP.md](HARDWARE_SETUP.md) - Wiring & hardware
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Additional help

---

**Last Updated**: January 28, 2026
