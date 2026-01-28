# Host Setup: Build ImGui Application

> **Location**: Build on your laptop, deploy to STM32MP157F-DK2

---

## Overview

The ImGui application is a modern, high-performance GUI built with:
- **ImGui** - Immediate-mode UI library
- **GLFW** - Window and input handling
- **OpenGL ES2** - Graphics rendering for embedded systems

This guide covers compiling the ImGui application on your development machine with a cross-compiler (ARM target).

### Prerequisites

- Prerequisites installed (see [SETUP_HOST_PREREQUISITES.md](SETUP_HOST_PREREQUISITES.md))
- ARM cross-compiler (gcc-arm-linux-gnueabihf)
- CMake 3.10+
- 5GB disk space for build artifacts

---

## Quick Start (20 minutes)

### Step 1: Set Up Build Environment (On Your Laptop)

```bash
# Create workspace directory:
mkdir -p ~/imgui_stm32
cd ~/imgui_stm32

# Clone required repositories:
git clone https://github.com/ocornut/imgui.git
git clone https://github.com/glfw/glfw.git

# Copy project files from your repository:
# From attendance-system, copy the main project files:
cp -r <path-to>/product/GUI/IMGUI/v1.2.7/* .
# Or use v1.4.1 if available
```

### Step 2: Build GLFW Library

```bash
cd ~/imgui_stm32/glfw
mkdir build
cd build

# Configure with cross-compiler for ARM:
cmake .. \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_C_COMPILER=arm-linux-gnueabihf-gcc \
  -DCMAKE_CXX_COMPILER=arm-linux-gnueabihf-g++ \
  -DGLFW_BUILD_EXAMPLES=OFF \
  -DGLFW_BUILD_TESTS=OFF \
  -DGLFW_BUILD_DOCS=OFF \
  -DGLFW_BUILD_WAYLAND=ON \
  -DGLFW_BUILD_X11=OFF

# Compile:
make -j$(nproc)

# Install (to local directory, not system):
make DESTDIR=../install install
```

**Expected Output:**
```
[100%] Built target glfw
```

### Step 3: Create CMakeLists.txt for ImGui

```bash
cd ~/imgui_stm32

# Create CMakeLists.txt (see detailed version below):
cat > CMakeLists.txt << 'EOF'
cmake_minimum_required(VERSION 3.10)
project(imgui_stm32)

set(CMAKE_CXX_STANDARD 11)
set(CMAKE_C_COMPILER arm-linux-gnueabihf-gcc)
set(CMAKE_CXX_COMPILER arm-linux-gnueabihf-g++)

# ImGui sources
set(IMGUI_DIR ${CMAKE_CURRENT_SOURCE_DIR}/imgui)
file(GLOB IMGUI_SOURCES ${IMGUI_DIR}/*.cpp)
list(APPEND IMGUI_SOURCES
    ${IMGUI_DIR}/backends/imgui_impl_glfw.cpp
    ${IMGUI_DIR}/backends/imgui_impl_opengl3.cpp
)

# Main executable
add_executable(imgui_app
    main.cpp
    ${IMGUI_SOURCES}
)

target_include_directories(imgui_app PRIVATE
    ${IMGUI_DIR}
    ${IMGUI_DIR}/backends
    ${CMAKE_CURRENT_SOURCE_DIR}/glfw/include
)

target_compile_definitions(imgui_app PRIVATE
    GLFW_INCLUDE_ES2
    GLFW_EXPOSE_NATIVE_WAYLAND
    IMGUI_IMPL_OPENGL_ES2
)

target_link_libraries(imgui_app
    ${CMAKE_CURRENT_SOURCE_DIR}/glfw/install/usr/local/lib/libglfw3.a
    GLESv2
    EGL
    dl
    pthread
    m
    curl
)

set_target_properties(imgui_app PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin
)
EOF
```

### Step 4: Build ImGui Application

```bash
# Create build directory:
mkdir -p ~/imgui_stm32/build
cd ~/imgui_stm32/build

# Configure:
cmake ..

# Compile:
make -j$(nproc)

# Watch the build progress:
# Should complete in 2-5 minutes
```

**Expected Output:**
```
[100%] Built target imgui_app
```

### Step 5: Verify Build Success

```bash
# Check binary was created:
ls -lh bin/imgui_app

# Should show: imgui_app with size ~1-5 MB

# Verify it's ARM binary:
file bin/imgui_app

# Expected: ELF 32-bit LSB executable, ARM, EABI5 version 1
```

### Step 6: Transfer to STM32 (On Your Laptop)

```bash
# Copy binary to STM32:
scp ~/imgui_stm32/build/bin/imgui_app root@<stm32-ip>:/root/

# Verify on STM32:
ssh root@<stm32-ip>
ls -lh /root/imgui_app
file /root/imgui_app
```

### Step 7: Deploy & Enable Auto-Start (On STM32)

See [SETUP_STM32_IMGUI_KIOSK.md](SETUP_STM32_IMGUI_KIOSK.md) for complete deployment steps.

---

## Detailed Build Process

### Project Structure

```
~/imgui_stm32/
├── CMakeLists.txt              # CMake build configuration
├── main.cpp                    # Application entry point
├── imgui/                      # ImGui library
│   ├── imgui.h
│   ├── imgui.cpp
│   ├── backends/
│   │   ├── imgui_impl_glfw.h/cpp
│   │   └── imgui_impl_opengl3.h/cpp
│   └── ...
├── glfw/                       # GLFW3 library
│   ├── src/
│   ├── include/
│   ├── build/
│   └── CMakeLists.txt
└── build/                      # Compilation output
    ├── CMakeCache.txt
    ├── CMakeFiles/
    ├── bin/
    │   └── imgui_app          # Final binary
    └── ...
```

### Understanding the CMakeLists.txt

**ImGui Sources Collection:**
```cmake
file(GLOB IMGUI_SOURCES ${IMGUI_DIR}/*.cpp)
```
Gathers all `.cpp` files from ImGui core directory.

**Backend Implementation:**
```cmake
list(APPEND IMGUI_SOURCES
    ${IMGUI_DIR}/backends/imgui_impl_glfw.cpp    # Input handling
    ${IMGUI_DIR}/backends/imgui_impl_opengl3.cpp # Graphics rendering
)
```
Adds platform-specific backends for GLFW and OpenGL ES2.

**Compiler Flags:**
```cmake
target_compile_definitions(imgui_app PRIVATE
    GLFW_INCLUDE_ES2                # Use GLES2 instead of OpenGL
    GLFW_EXPOSE_NATIVE_WAYLAND      # Enable Wayland backend
    IMGUI_IMPL_OPENGL_ES2           # Use OpenGL ES2 rendering
)
```
These flags optimize for embedded graphics (no desktop GL).

**Linked Libraries:**
```cmake
target_link_libraries(imgui_app
    libglfw3.a          # Static GLFW library
    GLESv2              # OpenGL ES 2.0 library
    EGL                 # EGL display interface
    dl                  # Dynamic library loading
    pthread             # Threading support
    m                   # Math library
    curl                # HTTP requests (for API calls)
)
```

### Cross-Compilation Details

**ARM Target Configuration:**
```cmake
set(CMAKE_C_COMPILER arm-linux-gnueabihf-gcc)
set(CMAKE_CXX_COMPILER arm-linux-gnueabihf-g++)
```

Tells CMake to use ARM compilers instead of native (x86/x64).

**Compiler Output:**
```
arm-linux-gnueabihf-gcc: ELF 32-bit LSB executable
- 32-bit: Matches STM32MP157F architecture
- LSB: Little-endian byte order (ARM standard)
- EABI5: Embedded ABI version 5 (ARM standard)
```

### Build Options

```bash
# Debug build (with symbols, slower):
cmake .. -DCMAKE_BUILD_TYPE=Debug

# Release build (optimized, faster):
cmake .. -DCMAKE_BUILD_TYPE=Release

# With custom GLFW path:
cmake .. -DGLFW_DIR=/path/to/glfw

# Verbose output:
cmake .. --debug-output
make VERBOSE=1
```

---

## Advanced Configuration

### Modify for Different Backend URL

**Edit**: `main.cpp`

```cpp
// Find this line:
#define API_BASE_URL "http://your_host_server_ip_adress:5000"

// Change to your backend IP:
#define API_BASE_URL "http://192.168.1.50:5000"

// Rebuild:
cd ~/imgui_stm32/build
cmake ..
make -j$(nproc)
```

### Custom UI Modifications

**Edit**: `main.cpp` or related files

```cpp
// Example: Change welcome text
ImGui::Text("Your Custom Text");

// Change window title
ImGui::SetNextWindowSize(ImVec2(800, 480));
ImGui::SetNextWindowPos(ImVec2(0, 0));
ImGui::Begin("Custom App Title");
```

Then rebuild:
```bash
cd ~/imgui_stm32/build
make -j$(nproc)
```

### Link Additional Libraries

**Edit**: `CMakeLists.txt`

```cmake
target_link_libraries(imgui_app
    # ... existing ...
    yourlib                    # Add new library
)

# Or with full path:
target_link_libraries(imgui_app
    /path/to/libyourlib.a
)
```

---

## Troubleshooting Build Issues

### CMake Not Found

```bash
# Install CMake:
# Windows (WSL): sudo apt install cmake
# macOS: brew install cmake
# Linux: sudo apt install cmake

# Verify:
cmake --version
```

### ARM Compiler Not Found

```bash
# Check if installed:
which arm-linux-gnueabihf-gcc

# If not found, install:
# Windows (WSL): sudo apt install gcc-arm-linux-gnueabihf
# macOS: brew install arm-linux-embedded-toolchain
# Linux: sudo apt install gcc-arm-linux-gnueabihf

# Verify:
arm-linux-gnueabihf-gcc --version
```

### GLFW Build Fails

**Common error**: `libssl-dev not found`

```bash
# Install required libraries:
# Linux/WSL:
sudo apt install -y \
  libssl-dev \
  libxrandr-dev \
  libxinerama-dev \
  libxi-dev \
  libxext-dev \
  libxcursor-dev

# Retry GLFW build:
cd glfw/build
rm -rf *
cmake ..
make -j$(nproc)
```

### ImGui Build Fails

**Common error**: `undefined reference to 'glGetString'`

```bash
# Ensure OpenGL ES libraries are installed:
# Linux/WSL:
sudo apt install -y \
  libgles2-mesa-dev \
  libegl1-mesa-dev \
  libdrm-dev

# Clean and rebuild:
cd ~/imgui_stm32/build
rm -rf *
cmake ..
make -j$(nproc)
```

### libcurl Not Found

```bash
# Install libcurl development files:
# Linux/WSL:
sudo apt install -y libcurl4-openssl-dev

# macOS:
brew install curl

# Verify:
pkg-config --cflags --libs libcurl

# Rebuild:
cd ~/imgui_stm32/build
make clean
make -j$(nproc)
```

### Binary Too Large

If binary exceeds 10 MB, optimize:

```bash
# In CMakeLists.txt, add:
target_compile_options(imgui_app PRIVATE -Os -flto)
target_link_options(imgui_app PRIVATE -s)  # Strip symbols

# Rebuild:
cd ~/imgui_stm32/build
cmake ..
make -j$(nproc)

# Check size:
ls -lh bin/imgui_app
```

---

## Testing Build Locally (Optional)

### Build for Your Desktop OS

To test ImGui code changes before deploying to ARM:

```bash
# Native build (on your laptop, not cross-compiled):
cd ~/imgui_stm32
mkdir build_native
cd build_native

cmake .. \
  -DCMAKE_BUILD_TYPE=Release
  # Don't specify ARM compiler

make -j$(nproc)

# Run locally:
./bin/imgui_app

# This won't work perfectly (touchscreen, M4 comms won't function)
# But UI changes can be previewed
```

---

## Deployment Checklist

Before transferring to STM32, verify:

- ✅ Binary built successfully: `ls -lh build/bin/imgui_app`
- ✅ Binary is ARM executable: `file build/bin/imgui_app`
- ✅ Binary size < 20 MB: `ls -lh build/bin/imgui_app`
- ✅ Backend URL correctly set in code
- ✅ API endpoint is accessible: `curl http://backend-ip:5000/health`
- ✅ M4 firmware already deployed on STM32
- ✅ WiFi configured on STM32

---

## Iterative Development Workflow

Typical development cycle:

```
1. Edit code in ~/imgui_stm32/main.cpp
   │
2. Rebuild: cd build && make -j$(nproc)
   │
3. Transfer: scp bin/imgui_app root@<stm32-ip>:/root/
   │
4. Restart: systemctl restart imgui-app.service
   │
5. Test on device
   │
6. Check logs: tail /root/imgui.log
   │
7. Repeat from step 1
```

**Speed up rebuilds:**
```bash
# Only rebuild changed files:
cd ~/imgui_stm32/build
make -j$(nproc)  # Much faster than full rebuild

# Full clean rebuild if issues persist:
rm -rf ~/imgui_stm32/build
mkdir ~/imgui_stm32/build
cd ~/imgui_stm32/build
cmake ..
make -j$(nproc)
```

---

## Build Optimization

### Speed Up Compilation

```bash
# Use all CPU cores (adjust number):
make -j$(nproc)      # Auto-detect cores
make -j8             # Or specify manually

# Parallel cmake build:
cmake --build . -j$(nproc)
```

### Reduce Binary Size

Already done in Release build, but can optimize further:

```cmake
# In CMakeLists.txt:
target_compile_options(imgui_app PRIVATE
    -O2          # Optimization level 2
    -flto        # Link-time optimization
    -ffunction-sections
    -fdata-sections
)

target_link_options(imgui_app PRIVATE
    -s                           # Strip symbols
    -Wl,--gc-sections           # Remove unused code
    -Wl,--as-needed             # Remove unneeded libraries
)
```

---

## Next Steps

1. **Deploy to STM32:**
   - See [SETUP_STM32_IMGUI_KIOSK.md](SETUP_STM32_IMGUI_KIOSK.md)

2. **Set up backend:**
   - See [SETUP_HOST_BACKEND.md](SETUP_HOST_BACKEND.md)

3. **Deploy M4 firmware:**
   - See [SETUP_STM32_M4_FIRMWARE.md](SETUP_STM32_M4_FIRMWARE.md)

4. **Test complete system:**
   - Scan RFID card
   - Verify ImGui displays and responds
   - Check API calls reach backend

---

## Related Documentation

- [SETUP_HOST_PREREQUISITES.md](SETUP_HOST_PREREQUISITES.md) - Tools setup
- [SETUP_HOST_BACKEND.md](SETUP_HOST_BACKEND.md) - Backend services
- [SETUP_HOST_DEPLOY.md](SETUP_HOST_DEPLOY.md) - Full deployment
- [SETUP_STM32_IMGUI_KIOSK.md](SETUP_STM32_IMGUI_KIOSK.md) - ImGui deployment
- [GUI_IMGUI.md](GUI_IMGUI.md) - ImGui app architecture

---

**Last Updated**: January 28, 2026
