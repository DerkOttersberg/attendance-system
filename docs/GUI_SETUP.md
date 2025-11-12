# ImGui Display setup

This demonstrates the setup of the **main GUI display** for your STM32 board using **Dear ImGui** and **GLFW**.

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


---

**Expected Result:** Smooth 30+ FPS rendering on STM32 display.


### Test: Network Communication

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