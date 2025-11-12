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
- [Troubleshooting](#troubleshooting)

---

## Overview

The attendance device is built around the **STM32F7 Discovery Kit**, which provides:
- Dual-core processor (Cortex-A7 + Cortex-M4)
- Embedded Linux capability
- Integrated touchscreen display
- GPIO pins for peripherals

### System Architecture

```
┌─────────────────────────────────────┐
│       STM32F7 Discovery Board       │
│  ┌───────────┐      ┌───────────┐  │
│  │ Cortex-A7 │◄────►│ Cortex-M4 │  │
│  │  (Linux)  │      │  (RFID)   │  │
│  └─────┬─────┘      └─────┬─────┘  │
│        │                   │         │
│   ┌────▼────┐         ┌───▼───┐    │
│   │ImGui GUI│         │ RFID  │    │
│   │         │         │Reader │    │
│   └────┬────┘         └───────┘    │
│        │                            │
│   ┌────▼────────┐                  │
│   │ Touchscreen │                  │
│   └─────────────┘                  │
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
| **MicroSD Card** | 8GB+ Class 10 | 1 | Linux filesystem (optional) |

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

### STM32F746-DISCO (DK1)
- **Display**: 4.3" 480x272 LCD
- **Touchscreen**: Capacitive
- **RAM**: 340KB
- **Flash**: 1MB
- **Project Path**: `Product/STMCUBEIDE/dk1/`

### STM32F769-DISCO (DK2) ⭐ **Recommended**
- **Display**: 4.0" 800x480 LCD
- **Touchscreen**: Capacitive
- **RAM**: 512KB
- **Flash**: 2MB
- **Better performance**: Faster processor
- **Project Path**: `Product/STMCUBEIDE/dk2/`

> **Note**: This guide focuses on DK2 (STM32F769), but steps are similar for DK1.

---

## Wiring Diagram

### RFID RC522 Connection

The RC522 RFID module connects to the STM32 M4 core via SPI:

```
RC522 Module          STM32MP157F-DK2
┌──────────┐         ┌──────────┐
│   VCC    │────────→│   3.3V   │
│   GND    │────────→│   GND    │
│   RST    │────────→│   PD15   │
│   IRQ    │         │   NaN    │
│   MISO   │────────→│   PF8    │
│   MOSI   │────────→│   PF9    │
│   SCK    │────────→│   PH6    │
│   SDA    │────────→│   PD14   │ (CS)
└──────────┘         └──────────┘
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

**C/C++ Build → Settings**:
- **Optimization**: `-O2` (release) or `-Og` (debug)
- **Debugging**: Enable `-g` flag for debug builds

**C/C++ General → Paths and Symbols**:
- Add include paths for ImGui and custom libraries

### 4. Install Dependencies

The project requires several libraries pre-installed on the STM32:

**Embedded Linux Packages**:
```bash
# SSH into STM32 (if Linux is installed)
ssh root@<stm32-ip>

# Install required packages
opkg update
opkg install libstdc++ libpthread
```

**ImGui**: Already included in project (`Product/GUI/IMGUI/`)

---

## Flashing Firmware

### Method 1: Using STM32CubeIDE (Recommended)

1. **Connect board** via USB ST-LINK
2. **Build project**: Click hammer icon or press `Ctrl+B`
3. **Flash**: Click play icon (Run) or press `F11`
4. Monitor console for flash progress

**Expected Output**:
```
Downloading...
File downloaded successfully
Verified OK
Debugger connection lost.
Shutting down...
```

### Method 2: Using STM32CubeProgrammer

1. Open STM32CubeProgrammer
2. Connect to board (ST-LINK)
3. Load `.elf` or `.bin` file from build directory
4. Click **Download**

### Method 3: Using Command Line

```bash
# Navigate to build directory
cd Product/STMCUBEIDE/dk2/Debug/

# Flash using st-flash
st-flash write firmware.bin 0x08000000
```

---

## Installing Embedded Linux (Optional)

For advanced features, you can run embedded Linux on the A7 core:

### 1. Prepare SD Card

Download and flash Yocto Linux image:
```bash
# Download image
wget <yocto-image-url>

# Flash to SD card (Linux)
sudo dd if=image.wic of=/dev/sdX bs=4M status=progress
sync
```

### 2. Configure Boot

Set boot switches on STM32 board to boot from SD card (refer to board manual).

### 3. First Boot

Insert SD card and power on. Default credentials:
- **Username**: `root`
- **Password**: (none)

### 4. Network Configuration

```bash
# Connect via Ethernet or WiFi
ifconfig eth0 192.168.1.100 netmask 255.255.255.0
route add default gw 192.168.1.1

# Or use NetworkManager
nmcli device wifi connect "SSID" password "PASSWORD"
```

---

## Hardware Testing

### Test 1: Board Power & Boot

1. Connect USB power
2. Check for LED indicators
3. Display should show boot sequence
4. Touchscreen backlight should activate

**Expected**: Board boots within 5-10 seconds

---

### Test 2: Touchscreen Calibration

Test included in `Product/ESP32/Touchscreen_test/`:

1. Flash test sketch to board
2. Screen displays touch coordinates
3. Touch corners and center to verify accuracy

**Expected**: Coordinates match touch position

---

### Test 3: RFID Reader

Test included in `Product/ESP32/RFID_test.ino`:

1. Flash test sketch
2. Open serial monitor (115200 baud)
3. Scan RFID card near reader
4. UID should appear in serial output

**Expected Output**:
```
Card detected!
UID: A1 B2 C3 D4
Card type: MIFARE 1KB
```

---

### Test 4: ImGui Display

Main GUI test:

1. Flash full firmware from `Product/GUI/IMGUI/v1.2.5.2/`
2. GUI should render on touchscreen
3. Touch interface should respond
4. Check for visual glitches

**Expected**: Smooth 30+ FPS rendering

---

### Test 5: Network Communication

Test API connectivity:

```cpp
// In main.cpp
#include "api_client.h"

void testAPI() {
    APIClient client("http://192.168.1.100:5000");
    bool connected = client.testConnection();
    
    if (connected) {
        printf("API connection: SUCCESS\n");
    } else {
        printf("API connection: FAILED\n");
    }
}
```

**Expected**: "API connection: SUCCESS"

---

## Troubleshooting

### Issue: Board won't power on

**Check**:
- USB cable is data + power capable (not charge-only)
- Power LED on board is lit
- USB port provides sufficient power (2A)

**Solution**: Try different USB port or use external 5V supply

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