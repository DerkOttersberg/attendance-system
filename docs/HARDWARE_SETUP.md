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

## Test 3: RFID Reader

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

# Test 4: ImGui Display

This test demonstrates the **main GUI display** for your STM32 board using **Dear ImGui** and **GLFW**.

---

## 🧰 Prerequisites

### On Your Main PC

1. **Install WSL (Ubuntu 22.04)**
   ```bash
   wsl --install -d Ubuntu-22.04
   sudo apt update
   sudo apt upgrade -y
   ```

2. **Set Up Cross Compiler**
   ```bash
   wsl.exe -d Ubuntu-24.04
   cd ~
   ```

3. **Install Build Dependencies**
   ```bash
   sudo apt install -y        build-essential        cmake        git        wget        curl        pkg-config        python3        python3-pip        libssl-dev        device-tree-compiler        u-boot-tools        bison        flex        bc        libncurses-dev        dosfstools        mtools        parted        rsync
   ```

---

### On Your STM32 Board

1. **Install Required Packages**
   ```bash
   opkg update
   opkg install libdrm libgbm mesa-gl libgles2 libegl
   ```

---

## 🧩 Installing the OpenSTLinux SDK

1. Download the SDK from STMicroelectronics:
   ```
   gcc-arm-10.3-2021.07-x86_64-arm-none-linux-gnueabihf.tar.xz
   ```

2. Extract and set up the environment:
   ```bash
   export PATH=/opt/gcc-arm-10.3-2021.07-x86_64-arm-none-linux-gnueabihf/bin:$PATH
   export CROSS_COMPILE=arm-none-linux-gnueabihf-
   export ARCH=arm
   ```

3. Verify installation:
   ```bash
   $CC --version
   ```

---

## 🧱 Building ImGui and GLFW

1. **Clone Repositories**
   ```bash
   mkdir -p ~/imgui_stm32
   cd ~/imgui_stm32
   git clone https://github.com/ocornut/imgui.git
   git clone https://github.com/glfw/glfw.git
   ```

2. **Build GLFW**
   ```bash
   cd glfw
   mkdir build && cd build
   cmake ..        -DCMAKE_BUILD_TYPE=Release        -DGLFW_BUILD_EXAMPLES=OFF        -DGLFW_BUILD_TESTS=OFF        -DGLFW_BUILD_DOCS=OFF        -DGLFW_BUILD_WAYLAND=ON        -DGLFW_BUILD_X11=OFF
   make -j$(nproc)
   sudo make install
   ```

---

## 📝 Project Setup

1. In your `imgui_stm32` directory, copy the files from:
   ```
   attendance-system\product\GUI\IMGUI\v1.2.5.2
   ```
   *(Copy the files directly — no subfolder.)*

2. **Create `CMakeLists.txt`**
   ```cmake
   cmake_minimum_required(VERSION 3.10)
   project(imgui_stm32)

   set(CMAKE_CXX_STANDARD 11)
   set(CMAKE_CXX_STANDARD_REQUIRED ON)

   # ImGui sources
   set(IMGUI_DIR ${CMAKE_CURRENT_SOURCE_DIR}/imgui)
   file(GLOB IMGUI_SOURCES ${IMGUI_DIR}/*.cpp)
   list(APPEND IMGUI_SOURCES
       ${IMGUI_DIR}/backends/imgui_impl_glfw.cpp
       ${IMGUI_DIR}/backends/imgui_impl_opengl3.cpp
   )

   # GLFW
   set(GLFW_DIR ${CMAKE_CURRENT_SOURCE_DIR}/glfw)

   # Executable
   add_executable(imgui_app
       main.cpp
       ${IMGUI_SOURCES}
   )

   target_include_directories(imgui_app PRIVATE
       ${IMGUI_DIR}
       ${IMGUI_DIR}/backends
       ${GLFW_DIR}/include
   )

   target_compile_definitions(imgui_app PRIVATE 
       GLFW_INCLUDE_ES2
       GLFW_EXPOSE_NATIVE_WAYLAND
       IMGUI_IMPL_OPENGL_ES2
   )

   target_link_libraries(imgui_app
       ${GLFW_DIR}/build/src/libglfw3.a
       GLESv2
       EGL
       dl
       pthread
       m
       curl
   )

   # Output Directory
   set_target_properties(imgui_app PROPERTIES
       RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin
       BUILD_RPATH "${SYSROOT}/lib"
       INSTALL_RPATH "${SYSROOT}/lib"
   )
   ```

---

## ⚙️ Building the Project

```bash
cd ~/imgui_stm32
mkdir build && cd build
cmake ..
make -j$(nproc)
```

You should now have a runnable binary in `bin/imgui_app`.

---

## 🚀 Deploying to STM32

```bash
scp bin/imgui_app root@your_stm32_ip_adress:/home/root/
chmod +x /home/root/imgui_app
./imgui_app
```




**Expected Result:** Smooth 30+ FPS rendering on STM32 display.


---

### Test 5: Network Communication

Test API connectivity:

```cpp
// In main.cpp
//change this line to your current IP ADRESS
#define API_BASE_URL "http://your_host_server_ip_adress:5000"
```

**Expected**: IMGUI will put debug prints in the console showing it works

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