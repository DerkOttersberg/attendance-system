# Hardware Setup Guide

> Complete guide for setting up the STM32-based attendance device with RFID reader and touchscreen.

---

## Table of Contents

- [Overview](#overview)
- [Hardware Components](#hardware-components)
- [Board Selection](#board-selection)
- [Wiring Diagram](#wiring-diagram)
- [STM32CubeIDE Setup](#stm32cubeide-setup)
- [Flashing Firmware](#flashing-firmware)
- [Hardware Testing](#hardware-testing)
- [Device Tree Configuration](#device-tree-configuration)
- [SystemD Services Setup](#systemd-services-setup)
- [WiFi Configuration](#wifi-configuration)
- [Performance Optimization](#performance-optimization)
- [Troubleshooting](#troubleshooting)

---

## Overview

The attendance device is built around the **STM32MP157F Discovery Kit**, which provides:
- Dual-core processor (Cortex-A7 + Cortex-M4)
- Embedded Linux capability (OPENstLinux)
- Integrated touchscreen display
- GPIO pins for peripherals

### System Architecture

```
┌─────────────────────────────────────┐
│       STM32F7 Discovery Board       │
│  ┌───────────┐      ┌───────────┐   │
│  │ Cortex-A7 │◄────►│ Cortex-M4 │   │
│  │  (Linux)  │      │  (RFID)   │   │
│  └─────┬─────┘      └─────┬─────┘   │
│        │                   │        │
│   ┌────▼────┐         ┌───▼───┐     │
│   │ImGui GUI│         │ RFID  │     │
│   │         │         │Reader │     │
│   └────┬────┘         └───────┘     │
│        │                            │
│   ┌────▼────────┐                   │
│   │ Touchscreen │                   │
│   └─────────────┘                   │
└─────────────────────────────────────┘
```

---

## Hardware Components

### Required Components

| Component | Model | Quantity | Purpose |
|-----------|-------|----------|---------|
| **Microcontroller Board** | STM32F7-DISCO (DK1 or DK2) | 1 | Main processing unit |
| **RFID Reader** | RC522 Module | 1 | Card reading |
| **Touchscreen** | Integrated on board | 1 | User input & display |
| **Power Supply** | 5V 2A USB | 1 | Power delivery |
| **MicroSD Card** | 16GB+ Class 10 | 1 | Linux filesystem (optional) |

### Optional Components

| Component | Purpose | Status |
|-----------|---------|--------|
| LED indicators | Visual feedback | Planned |
| Buzzer | Audio feedback | Planned |
| Reset button | System reboot | Planned |
| Custom encasing | Physical protection | In Progress |

---

## Board Selection

The project supports two STM32 Discovery boards:

### STM32MP157D (DK1)
- **Display**: 4.3" 800x480 LCD
- **Touchscreen**: Resistive
- **RAM**: 4-Gbit DDR3L, 16 bits, 533 MHz
- **Wiring**: SPI, HDMI
- **Project Path**: `Product/STMCUBEIDE/dk1/`

### STM32MP157F (DK2) ⭐ **Recommended**
- **Display**: 4.0" 800x480 LCD
- **Touchscreen**: Capacitive
- **RAM**: 4-Gbit DDR3L, 16 bits, 533 MHz
- **Different wiring**: Integrated Display Through MIPI DSI
- **Project Path**: `Product/STMCUBEIDE/dk2/`

> **Note**: This guide focuses on DK2 (STM32MP157F), but steps are similar for DK1.

---

## Wiring Diagram

### RFID RC522 Connection

The RC522 RFID module connects to the STM32 M4 core via SPI:

```
RC522 Module          STM32MP157F-DK2

┌──────────┐         ┌──────────┐
│   VCC    │────────→│   3.3V  Pin 1 │ voorkant
│   RST    │────────→│   PD15 D5    │    achterkant
│   GND     │────────→│   GND 6   │ voorkant
│   IRQ    │         │   NaN    │
│   MISO   │────────→│   PF8   21 │ Voorkant
│   MOSI   │────────→│   PF9   19 │ Voorkant
│   SCK    │────────→│   PH6 D9   │ achterkant    
│   SDA    │────────→│   PD14  D3 │ (CS)    achterkant
└──────────┘         └──────────┘



Buzzer    stm32 voorkant
gnd        pin30 gnd
vin         pin 24 pf6 
                

Reset knop    stm32    achterkant
rechterhoek knop                NRST pin 3 cn16
linker achterhoek knop            pin 6 cn16 gnd 


LED 1       stm32        Resistor
vin        pin8 bovenkant pb10
gnd        gnd

LED2        stm32        Resistor
Vin        pin10 PB12 bovenkant
GND        GND
```

**Pin Configuration**:
- **VCC**: 3.3V power (do NOT use 5V)
- **GND**: Ground
- **RST**: Reset pin (PD15)
- **MISO**: SPI data out (PF8)
- **MOSI**: SPI data in (PF9)
- **SCK**: SPI clock (PH6)
- **SDA**: Chip select (PD14)

### Touchscreen

The touchscreen is **integrated** on the Discovery board and requires no external wiring. It connects via:
- **Display**: LTDC interface (built-in)
- **Touch Controller**: I2C interface (built-in)

---

## STM32CubeIDE Setup

### 1. Install STM32CubeIDE

Download from [ST's website](https://www.st.com/en/development-tools/stm32cubeide.html):
- **Version**: 1.10.0 or higher
- **OS**: Windows, Linux, or macOS

### 2. Import Project

1. Open STM32CubeIDE
2. Go to `File → Import → Existing Projects into Workspace`
3. Browse to: `Product/STMCUBEIDE/dk2/`
4. Select the project and click **Finish**

### 3. Configure Build Settings

Right-click project → **Properties**:

**C/C++ General → Paths and Symbols**:
- Install Libraries for C, python3-dev

### 4. Install Dependencies

The project requires several libraries pre-installed on the STM32:

**Embedded Linux Packages**:
```bash
# SSH into STM32 (if Linux is installed)
ssh root@<stm32-ip>

# Install required packages
apt update (You need to be SuperUser)
```

**ImGui**: Already included in project (`Product/GUI/IMGUI/`)

---

## Flashing Firmware

### Using STM32CubeProgrammer

Follow the Flashing Guide from manufacturers website https://www.st.com
Download the Yocto Linux image

Its recommend to install the command line flasher, instead of using the UI programmer




#### 1. Configure Boot

Set boot switches on STM32 board to boot from SD card (refer to board manual).

#### 2. First Boot

Insert SD card and power on. 

---

## Hardware Testing

### Board Power & Boot

1. Connect USB power
2. Check for LED indicators
3. Display should show boot sequence
4. Touchscreen backlight should activate

**Expected**: Board boots within 20-45 seconds

---

## Test: RFID Reader

Project build included in `attendance-system\product\STM32CUBEIDE\workspace_1.19.0\dk2`:

1. Connect st-link
2. Configure the IP Adress in STMCUBEIDE
3. Configure OPENOCD
4. Upload project
5. SSH into the STM32
6. Read out the data
    1. `cat /dev/ttyRPMSG* &` (usually this is 0. This will make it so you can read out print statements in the console for testing)
    2. `echo "help" > /dev/ttyRPMSG*` (Nudge the M4 Core to start sending)
7. Scan RFID card near reader
8. UID should appear in the terminal

**Expected Similar Output**:
```
Card detected!
UID: A1 B2 C3 D4
Card type: MIFARE 1KB
```

---



### Issue: Touchscreen not responding

**Check**:
- Touch controller drivers installed
- Calibration completed
- No physical damage to screen

**Solution**:
```bash
# Recalibrate touchscreen
/usr/bin/ts_calibrate

# Test touch input
/usr/bin/ts_test
```

---

### Issue: RFID reader not detecting cards

**Check**:
- Wiring connections (especially 3.3V, not 5V!)
- SPI communication enabled in Device Tree
- Antenna is not damaged

**Solution**:
```cpp
// Check SPI communication
MFRC522 rfid(SS_PIN, RST_PIN);
rfid.PCD_Init();
byte version = rfid.PCD_ReadRegister(MFRC522::VersionReg);
printf("MFRC522 version: 0x%02X\n", version);
// Expected: 0x91 or 0x92
```

---

### Issue: Cannot flash firmware

**Error**: `Error: No ST-LINK detected`

**Solution**:
- Install ST-LINK drivers
- Update ST-LINK firmware using ST-LINK Upgrade tool
- Try different USB cable/port

---

### Issue: Linux boot failure

**Check**:
- SD card properly formatted (ext4)
- Boot switches configured correctly
- SD card not corrupted

**Solution**: Reflash SD card image

---

## Device Tree Configuration

For advanced users, configure peripherals via Device Tree:

**Location**: `/boot/devicetree.dtb`

**Example: Enable SPI for RFID**:
```dts
&spi1 {
    status = "okay";
    cs-gpios = <&gpioa 15 0>;
    
    mfrc522@0 {
        compatible = "nxp,mfrc522";
        reg = <0>;
        spi-max-frequency = <1000000>;
        interrupt-parent = <&gpiob>;
        interrupts = <0 IRQ_TYPE_EDGE_FALLING>;
    };
};
```

Recompile and flash device tree after changes.

---

## SystemD Services Setup

### Overview

The STM32MP157F-DK2 has two processor cores that need to be managed:
- **Cortex-M4**: Runs RFID firmware and hardware control
- **Cortex-A7**: Runs OPENstLinux and the ImGui application

Both cores are coordinated through systemd services that ensure proper boot sequencing and auto-start functionality. The M4 core starts first, followed by the A7 Linux-based GUI application.

### Architecture

```
┌─────────────────────────────────────────────────┐
│         STM32MP157F-DK2 Boot Sequence           │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. Power-on → u-Boot → Kernel Load            │
│                              ↓                  │
│  2. multi-user.target reached                  │
│                              ↓                  │
│  3. m4-autostart.service ────┐ (M4 Core)      │
│     └─ Load firmware          │                │
│     └─ Start M4 processor     │                │
│                              ↓                  │
│  4. graphical.target reached                   │
│                              ↓                  │
│  5. imgui-app.service (A7 Core)                │
│     └─ Wait 20 seconds (M4 ready)              │
│     └─ Launch ImGui application                │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## M4 Firmware Development & Deployment

### Development Environment Setup

Before creating systemd services, you need to compile the M4 firmware on your development machine and deploy it to the board.

#### Prerequisites

- **STM32CubeIDE** (v1.10.0 or higher) installed on your development machine
- **ARM GCC Compiler** for cross-compilation
- **SSH access** to the STM32MP157F-DK2 board
- Project source code in `Product/STMCUBEIDE/dk2/`

#### Compilation Steps (Development Machine)

**1. Build Release Version in STM32CubeIDE**

```
1. Open STM32CubeIDE
2. Import project: File → Import → Existing Projects into Workspace
3. Select: Product/STMCUBEIDE/dk2/
4. Right-click project → Build Configurations → Set Active → Release
5. Right-click project → Build Project
6. Wait for compilation to complete (no errors)
```

**Expected output**: Compiled `.elf` file in project directory
```
Product/STMCUBEIDE/dk2/Release/YourProjectName.elf
```

**2. Verify Compilation Success**

Check build console for:
```
Finished building: YourProjectName.elf
```

If you see errors, ensure:
- All dependencies are linked correctly
- M4-specific compiler flags are set (ARM Cortex-M4)
- No syntax errors in C/C++ code

---

### Manual M4 Firmware Deployment

Before automating with systemd, understand the manual deployment process.

#### Step 1: Copy Firmware to Device

On your **development machine**, copy the compiled `.elf` file to the board:

```bash
# From your development machine
scp Product/STMCUBEIDE/dk2/Release/YourProjectName.elf root@<stm32-ip>:/lib/firmware/
```

**Replace**:
- `<stm32-ip>`: IP address of your STM32MP157F-DK2 (e.g., `192.168.1.100`)

**Verify transfer**:
```bash
ssh root@<stm32-ip>
ls -la /lib/firmware/YourProjectName.elf
```

#### Step 2: Create Symbolic Link

On the **STM32MP157F-DK2 board** (via SSH):

```bash
cd /lib/firmware
ln -sf YourProjectName.elf rproc-m4-fw.elf
ls -la rproc-m4-fw.elf  # Verify symlink was created
```

This symlink ensures the remoteproc framework can find the firmware using a standard name.

#### Step 3: Load and Start M4 Firmware

```bash
cd /sys/class/remoteproc/remoteproc0
echo rproc-m4-fw.elf > firmware
echo start > state
```

**Expected behavior**:
- No error messages
- System should output kernel messages about M4 loading

#### Step 4: Verify M4 is Running

```bash
cat /sys/class/remoteproc/remoteproc0/state
```

**Expected output**: `running`

**If output is "failed"**:
```bash
dmesg | tail -20  # Check kernel error messages
journalctl -xe    # Check system journal
```

#### Step 5: Test M4 Communication

```bash
# Listen for M4 messages (run in background)
cat /dev/ttyRPMSG0 &

# Send a test command to wake up M4
echo "help" > /dev/ttyRPMSG0
```

**Expected**: M4 firmware should respond with output in the terminal

---

### Manual Start/Stop M4 Firmware

Once the firmware is deployed, you can control it manually:

#### Start M4
```bash
cd /sys/class/remoteproc/remoteproc0
echo rproc-m4-fw.elf > firmware
echo start > state
cat state  # Verify: should show "running"
```

#### Stop M4
```bash
cd /sys/class/remoteproc/remoteproc0
echo stop > state
cat state  # Verify: should show "offline"
```

#### Restart M4
```bash
cd /sys/class/remoteproc/remoteproc0
echo stop > state
sleep 1
echo rproc-m4-fw.elf > firmware
echo start > state
cat state  # Verify: should show "running"
```

---

### Development Workflow

This is the recommended workflow when developing M4 firmware:

**1. Develop & Debug in STM32CubeIDE**
   - Write code in your project
   - Use debug mode (F11 step-through, breakpoints)
   - Test individual functions

**2. Prepare for Deployment**
   - Build Release version (not Debug)
   - Ensure no compilation errors
   - Test on board manually

**3. Deploy to Board**
   ```bash
   scp Product/STMCUBEIDE/dk2/Release/YourProjectName.elf root@<stm32-ip>:/lib/firmware/
   ssh root@<stm32-ip>
   cd /lib/firmware && ln -sf YourProjectName.elf rproc-m4-fw.elf
   ```

**4. Test Manual Start**
   ```bash
   cd /sys/class/remoteproc/remoteproc0
   echo rproc-m4-fw.elf > firmware
   echo start > state
   cat /sys/class/remoteproc/remoteproc0/state  # Verify: running
   ```

**5. Verify Communication**
   ```bash
   cat /dev/ttyRPMSG0 &
   echo "help" > /dev/ttyRPMSG0
   ```

**6. Update Symlink (if filename changed)**
   ```bash
   cd /lib/firmware
   ln -sf NewFirmware.elf rproc-m4-fw.elf
   ```

**7. Automate with Systemd** (see below)
   - Set up m4-autostart.service
   - Test reboot to ensure auto-start works

**8. Monitor in Production**
   ```bash
   # View logs
   journalctl -u m4-autostart.service -f
   # Check M4 status
   systemctl status m4-autostart.service
   ```

---

## Service 1: M4 Firmware Auto-Start

The M4 core runs firmware for RFID reading and hardware control. This service loads and starts the M4 firmware automatically at boot.

#### File Location
```
/etc/systemd/system/m4-autostart.service
```

#### Create the Service File

```bash
sudo nano /etc/systemd/system/m4-autostart.service
```

#### Service File Content

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
ExecStart=/bin/sh -c 'echo "a" > /dev/ttyRPMSG0'
RemainAfterExit=yes
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

#### Configuration Details

| Parameter | Purpose |
|-----------|---------|
| `Description` | Service display name |
| `After=multi-user.target` | Start after Linux system reaches multi-user mode |
| `Type=oneshot` | Service runs once and exits (doesn't stay running) |
| `ExecStart` (firmware) | Load the M4 firmware from `/lib/firmware/rproc-m4-fw.elf` |
| `ExecStart` (state) | Start the M4 processor core |
| `ExecStart` (sleep) | Wait 2 seconds for M4 to boot |
| `ExecStart` (ping) | Send test message to verify M4 is responsive |
| `RemainAfterExit=yes` | Keep service marked as "active" after oneshot completes |
| `Restart=on-failure` | Automatically restart if the service fails |
| `WantedBy=multi-user.target` | Enable this service at boot |

#### Enable M4 Auto-Start Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable m4-autostart.service
sudo systemctl start m4-autostart.service
```

#### Verify M4 Service Status

```bash
sudo systemctl status m4-autostart.service
```

**Expected Output**:
```
● m4-autostart.service - Auto-start STM32 M4 Firmware
     Loaded: loaded (/etc/systemd/system/m4-autostart.service; enabled; vendor preset: disabled)
     Active: active (exited) since Mon 2024-11-20 10:15:32 UTC; 5min ago
    Process: 234 ExecStart=/bin/sh -c 'echo rproc-m4-fw.elf > /sys/class/remoteproc/remoteproc0/firmware' (code=exited, status=0/SUCCESS)
```

**Check M4 processor state**:
```bash
cat /sys/class/remoteproc/remoteproc0/state
```

Expected output: `running`

---

### Service 2: ImGui Application (Kiosk Mode)

The A7 core runs the Linux-based ImGui application in kiosk mode (full-screen GUI without desktop environment).

#### File Location
```
/etc/systemd/system/imgui-app.service
```

#### Create the Service File

```bash
sudo nano /etc/systemd/system/imgui-app.service
```

#### Service File Content

```ini
[Unit]
Description=IMGUI Application
After=m4-autostart.service graphical.target
Requires=graphical.target

[Service]
Type=simple
User=root
WorkingDirectory=/root
ExecStartPre=/bin/sleep 20
ExecStart=/root/imgui_app
Restart=always
RestartSec=10

Environment=WAYLAND_DISPLAY=wayland-0
Environment=XDG_RUNTIME_DIR=/run/user/1000

StandardOutput=append:/root/imgui.log
StandardError=append:/root/imgui.log

[Install]
WantedBy=multi-user.target
```

#### Configuration Details

| Parameter | Purpose |
|-----------|---------|
| `Description` | Service display name |
| `After=m4-autostart.service graphical.target` | Start only after M4 is ready and graphics are initialized |
| `Requires=graphical.target` | Require Wayland/graphics to be available |
| `Type=simple` | Service runs continuously (unlike oneshot) |
| `User=root` | Run as root (required for hardware access) |
| `WorkingDirectory=/root` | Set working directory for the application |
| `ExecStartPre=/bin/sleep 20` | Wait 20 seconds for M4 and graphics to fully initialize |
| `ExecStart=/root/imgui_app` | Path to the compiled ImGui application binary |
| `Restart=always` | Automatically restart if the application crashes |
| `RestartSec=10` | Wait 10 seconds between restart attempts |
| `WAYLAND_DISPLAY` | Use Wayland display server (modern approach) |
| `XDG_RUNTIME_DIR` | Runtime directory for Wayland socket |
| `StandardOutput/Error` | Log application output to file for debugging |

#### Enable ImGui Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable imgui-app.service
sudo systemctl start imgui-app.service
```

#### Verify ImGui Service Status

```bash
sudo systemctl status imgui-app.service
```

**Expected Output**:
```
● imgui-app.service - IMGUI Application
     Loaded: loaded (/etc/systemd/system/imgui-app.service; enabled; vendor preset: disabled)
     Active: active (running) since Mon 2024-11-20 10:15:52 UTC; 3min ago
    Process: 456 ExecStartPre=/bin/sleep 20 (code=exited, status=0/SUCCESS)
   Main PID: 457 (imgui_app)
     Memory: 45.2M
     CGroup: /system.slice/imgui-app.service
             └─457 /root/imgui_app
```

#### View Application Logs

```bash
tail -f /root/imgui.log
```

This is useful for debugging if the ImGui application crashes or has issues.

---

### Service Management Commands

#### View All System Services

```bash
systemctl list-units --type=service
```

#### Check Service Dependencies

```bash
systemctl list-dependencies --reverse m4-autostart.service
systemctl list-dependencies --reverse imgui-app.service
```

#### Manual Service Control

```bash
# Start services
sudo systemctl start m4-autostart.service
sudo systemctl start imgui-app.service

# Stop services
sudo systemctl stop m4-autostart.service
sudo systemctl stop imgui-app.service

# Restart services
sudo systemctl restart m4-autostart.service
sudo systemctl restart imgui-app.service

# Enable/disable auto-start
sudo systemctl enable m4-autostart.service
sudo systemctl disable imgui-app.service
```

#### View Boot Sequence

```bash
sudo systemctl status
```

Shows the current system state and all active services.

---

### Troubleshooting Services

#### M4 Service Won't Start

**Check kernel logs**:
```bash
dmesg | grep -i remoteproc
dmesg | grep -i m4
```

**Verify firmware exists and is accessible**:
```bash
ls -la /lib/firmware/rproc-m4-fw.elf
file /lib/firmware/rproc-m4-fw.elf  # Should show ELF 32-bit format
```

**Check if symlink is correct**:
```bash
cd /lib/firmware
ls -la rproc-m4-fw.elf
readlink rproc-m4-fw.elf  # Should show the actual filename
```

**Check remoteproc device availability**:
```bash
ls -la /sys/class/remoteproc/
cat /sys/class/remoteproc/remoteproc0/name  # Should show: m4
```

**Test manual M4 start** (without systemd):
```bash
# Stop current service
sudo systemctl stop m4-autostart.service

# Test manual loading
cd /sys/class/remoteproc/remoteproc0
echo rproc-m4-fw.elf > firmware
echo start > state

# Check result
cat state  # Should show "running"
cat /proc/device-tree/aliases/rproc0  # Verify M4 alias exists

# View detailed status
cat /sys/class/remoteproc/remoteproc0/state
cat /sys/class/remoteproc/remoteproc0/power/control
```

**Check service file syntax**:
```bash
sudo systemd-analyze verify m4-autostart.service
```

**View service execution details**:
```bash
sudo journalctl -u m4-autostart.service -n 50
sudo journalctl -u m4-autostart.service -f  # Follow in real-time
```

#### M4 Communication Tests

If M4 starts but doesn't respond to commands:

```bash
# Check RPMSG devices exist
ls -la /dev/ttyRPMSG*

# Listen for M4 output
cat /dev/ttyRPMSG0 &
RPMSG_PID=$!

# Send test command
echo "test" > /dev/ttyRPMSG0

# Kill listener after testing
kill $RPMSG_PID
```

**Expected output**: M4 firmware should respond with acknowledgment

#### M4 State Issues

**If state shows "failed"**:
```bash
# Check fault message
cat /sys/class/remoteproc/remoteproc0/power/autosuspend_delay_ms
cat /sys/kernel/debug/remoteproc/remoteproc0/trace0  # If available

# Restart remoteproc
echo stop > /sys/class/remoteproc/remoteproc0/state
echo rproc-m4-fw.elf > /sys/class/remoteproc/remoteproc0/firmware
echo start > /sys/class/remoteproc/remoteproc0/state
```

**If state shows "offline"**:
```bash
# M4 may have crashed, check logs
dmesg | tail -30
journalctl -xe

# Try restarting
echo rproc-m4-fw.elf > /sys/class/remoteproc/remoteproc0/firmware
echo start > /sys/class/remoteproc/remoteproc0/state
```

#### Firmware Version Mismatch

If you've updated the firmware but M4 still uses old version:

```bash
# Check current symlink
ls -la /lib/firmware/rproc-m4-fw.elf

# Stop M4
sudo systemctl stop m4-autostart.service

# Update symlink
cd /lib/firmware
ln -sf NewFirmwareName.elf rproc-m4-fw.elf

# Restart
sudo systemctl start m4-autostart.service

# Verify
cat /sys/class/remoteproc/remoteproc0/state  # Should show "running"
```

#### ImGui Application Crashes

**Check logs**:
```bash
tail -100 /root/imgui.log
```

**Verify binary exists and is executable**:
```bash
ls -la /root/imgui_app
file /root/imgui_app  # Should show: ELF 32-bit LSB executable
```

**Test manual execution**:
```bash
/root/imgui_app
```

**Check for missing libraries**:
```bash
ldd /root/imgui_app
```

#### Services Not Auto-Starting at Boot

**Verify services are enabled**:
```bash
systemctl is-enabled m4-autostart.service   # Should output: enabled
systemctl is-enabled imgui-app.service      # Should output: enabled
```

**Enable if necessary**:
```bash
sudo systemctl enable m4-autostart.service
sudo systemctl enable imgui-app.service
```

**Reboot to test**:
```bash
sudo reboot
```

**After reboot, verify both services are running**:
```bash
systemctl status m4-autostart.service
systemctl status imgui-app.service
```

#### Disable Services

To stop services from auto-starting:

```bash
sudo systemctl disable m4-autostart.service
sudo systemctl disable imgui-app.service
```

---

### Service Deployment Workflow

When deploying a new version of the ImGui application:

1. **Build application on development machine**
2. **Copy to device**:
   ```bash
   scp imgui_app root@<stm32-ip>:/root/
   chmod +x /root/imgui_app
   ```
3. **Restart service**:
   ```bash
   sudo systemctl restart imgui-app.service
   ```
4. **Verify**:
   ```bash
   sudo systemctl status imgui-app.service
   tail /root/imgui.log
   ```

---

## WiFi Configuration

### Overview

The STM32MP157F-DK2 supports WiFi connectivity through the embedded WiFi module. This section covers how to connect to a WiFi network using the `wpa_supplicant` tool with pre-shared key (PSK) authentication.

### Prerequisites

- SSH access to the STM32MP157F-DK2 board
- WiFi network SSID and password
- Board must be running OPENstLinux with WiFi drivers installed

### Step 1: Generate Secure PSK Hash

To avoid storing plain-text passwords, generate a secure PSK hash using `wpa_passphrase`:

```bash
wpa_passphrase "BitsEnBytes" "WLanVanBitsEnBytes"
```

**Expected Output**:
```
network={
    ssid="BitsEnBytes"
    #psk="WLanVanBitsEnBytes"
    psk=e1eea16c4e9e3e9a4c5c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f
}
```

> **Note**: Copy only the `psk=HEXSTRING` line (the hex value after `psk=`). The commented line with the plain password is for reference only.

### Step 2: Update WiFi Configuration

Edit the WiFi configuration file:

```bash
nano /etc/wpa_supplicant/wpa_supplicant-wlan0.conf
```

Replace or add the network configuration with your network details:

```ini
network={
    ssid="BitsEnBytes"
    psk=e1eea16c4e9e3e9a4c5c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f
}
```

**Steps in nano editor**:
1. Find the existing `network={}` block (or add a new one)
2. Update the `ssid` to your network name
3. Replace the `psk=` value with your generated hash
4. **Remove or comment out** any `#psk=` plain text line
5. Save: `Ctrl + O` → `Enter` → `Ctrl + X`

### Step 3: Restart WiFi Services

Restart the WiFi connection to apply changes:

```bash
systemctl restart wpa_supplicant@wlan0
systemctl restart udhcpc-wlan0
```

**Wait 5-10 seconds** for the services to initialize.

### Step 4: Verify Connection

Check if the WiFi interface has obtained an IP address:

```bash
ip addr show wlan0
```

**Expected Output**:
```
3: wlan0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500
    inet 192.168.1.100/24 brd 192.168.1.255 scope global wlan0
    valid_lft forever preferred_lft forever
```

> **Important**: Look for `inet 192.168.x.x` (your IP address). If you only see `inet6`, the IPv4 connection failed.

### Step 5: Test Internet Connectivity

Ping a reliable server to verify connectivity:

```bash
ping -c 3 google.com
```

**Expected Output**:
```
PING google.com (142.250.185.46) 56(84) bytes of data.
64 bytes from 142.250.185.46: icmp_seq=1 ttl=119 time=25.4 ms
64 bytes from 142.250.185.46: icmp_seq=2 ttl=119 time=24.8 ms
64 bytes from 142.250.185.46: icmp_seq=3 ttl=119 time=25.1 ms

--- google.com statistics ---
3 packets transmitted, 3 received, 0% packet loss
```

### Troubleshooting WiFi Connection

#### Issue: No IP Address Assigned

**Symptoms**: `ip addr show wlan0` shows no `inet` line

**Solution**:
1. Check if WiFi device is detected:
   ```bash
   ip link show wlan0
   ```
   Should show `BROADCAST,MULTICAST,UP,LOWER_UP`

2. Check DHCP client logs:
   ```bash
   journalctl -u udhcpc-wlan0 -n 20
   ```

3. Try manual connection:
   ```bash
   wpa_cli -i wlan0 reconnect
   ```

#### Issue: WPA Handshake Failure

**Symptoms**: `systemctl status wpa_supplicant@wlan0` shows errors

**Verify Configuration**:
1. Check file syntax:
   ```bash
   cat /etc/wpa_supplicant/wpa_supplicant-wlan0.conf
   ```

2. Verify PSK is correct (must be 64 hex characters):
   ```bash
   wpa_passphrase "YourSSID" "YourPassword"
   ```

3. Test connection manually:
   ```bash
   wpa_cli -i wlan0
   > scan
   > scan_results
   > add_network
   > set_network 0 ssid "YourSSID"
   > set_network 0 psk YOURHEXSTRING
   > enable_network 0
   > status
   ```

#### Issue: Interface Disabled After Restart

**Symptoms**: `ip link show wlan0` shows `DOWN` state

**Solution**:
```bash
ip link set wlan0 up
systemctl restart wpa_supplicant@wlan0
```

### Make WiFi Persistent at Boot

To automatically connect on every boot, ensure the systemd service is enabled:

```bash
systemctl enable wpa_supplicant@wlan0
systemctl enable udhcpc-wlan0
```

Verify:
```bash
systemctl is-enabled wpa_supplicant@wlan0  # Should output: enabled
systemctl is-enabled udhcpc-wlan0          # Should output: enabled
```

### Security Best Practices

1. **Never store plain-text passwords** - Always use PSK hash
2. **Change default WiFi credentials** - Update SSID and PSK regularly
3. **Use WPA2/WPA3** - Avoid open networks or WEP encryption
4. **Restrict SSH access** - Only allow connections from known IPs
5. **Monitor network logs**:
   ```bash
   journalctl -u wpa_supplicant@wlan0 -f  # Follow logs in real-time
   ```

---

## Performance Optimization

### CPU Frequency

Increase clock speed for better performance:
```c
// In SystemClock_Config()
RCC_OscInitStruct.PLL.PLLM = 25;
RCC_OscInitStruct.PLL.PLLN = 432;  // 216 MHz
```

### GPU Acceleration

Enable Chrom-ART accelerator for faster GUI:
```c
DMA2D_HandleTypeDef hdma2d;
HAL_DMA2D_Init(&hdma2d);
```

### Memory Optimization

Use external SDRAM for frame buffers:
```c
#define FRAMEBUFFER_ADDR 0xC0000000  // External RAM
```

---

## Related Documentation

- [GUI Development Guide](GUI.md) - ImGui interface details
- [RFID Integration](RFID.md) - RFID reader implementation
- [Touchscreen Guide](TOUCHSCREEN.md) - Touch input handling
- [Architecture Overview](ARCHITECTURE.md) - System design
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues

---

**Last Updated**: November 2024
