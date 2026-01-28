# Host Setup: Prerequisites & Dependencies

> **Location**: On your development laptop/server (NOT on the STM32)

---

## Overview

Before building the ImGui application and backend services, you need to install several tools on your development machine. This guide covers all prerequisites for Windows, macOS, and Linux.

### System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **RAM** | 4 GB | 8 GB+ |
| **Storage** | 10 GB free | 20 GB+ free |
| **OS** | Windows 10+, macOS 10.13+, Ubuntu 20.04+ | Latest LTS version |
| **Internet** | Required for downloads | High-speed recommended |

---

## Quick Start

### Windows (WSL2 + Ubuntu)

```bash
# 1. Install WSL2 with Ubuntu 22.04
wsl --install -d Ubuntu-22.04

# 2. Inside WSL, install everything:
sudo apt update && sudo apt upgrade -y

# 3. Install build tools
sudo apt install -y \
  build-essential \
  cmake \
  git \
  wget \
  curl \
  pkg-config \
  python3 \
  python3-pip \
  docker.io

# 4. Install ARM cross-compiler
sudo apt install -y gcc-arm-linux-gnueabihf arm-none-eabi-gcc

# 5. Install Docker (outside WSL on Windows)
# Download from: https://www.docker.com/products/docker-desktop
```

### macOS

```bash
# 1. Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. Install tools
brew install \
  cmake \
  git \
  wget \
  curl \
  pkg-config \
  python3

# 3. Install Docker Desktop
brew install --cask docker

# 4. Install ARM compiler
brew tap ArmCommunityProjects/gnu-embedded-toolchain-arm
brew install arm-none-eabi-gcc
```

### Linux (Ubuntu/Debian)

```bash
# 1. Update package lists
sudo apt update && sudo apt upgrade -y

# 2. Install build tools
sudo apt install -y \
  build-essential \
  cmake \
  git \
  wget \
  curl \
  pkg-config \
  python3 \
  python3-pip

# 3. Install cross-compiler
sudo apt install -y gcc-arm-linux-gnueabihf arm-none-eabi-gcc

# 4. Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 5. Add your user to docker group (avoid sudo)
sudo usermod -aG docker $USER
newgrp docker
```

---

## Detailed Installation

### 1. Development Tools

#### CMake

**Required for**: Building ImGui and GLFW

```bash
# Check if installed:
cmake --version

# Install (if not present):
# Windows (WSL): sudo apt install cmake
# macOS: brew install cmake
# Linux: sudo apt install cmake
```

#### Git

**Required for**: Cloning repositories

```bash
# Check if installed:
git --version

# Install:
# Windows (WSL): sudo apt install git
# macOS: brew install git
# Linux: sudo apt install git
```

#### Python 3

**Required for**: Backend Flask API

```bash
# Check if installed:
python3 --version
# Should show Python 3.8 or higher

# Install (if needed):
# Windows (WSL): sudo apt install python3 python3-pip
# macOS: brew install python3
# Linux: sudo apt install python3 python3-pip
```

### 2. Cross-Compiler (ARM)

**Required for**: Building ImGui that runs on ARM Cortex-A7

The cross-compiler lets you compile code on your x86/x64 machine that runs on the ARM board.

#### Install ARM GCC

**Windows (WSL):**
```bash
sudo apt install -y gcc-arm-linux-gnueabihf
arm-linux-gnueabihf-gcc --version
```

**macOS:**
```bash
brew tap ArmCommunityProjects/gnu-embedded-toolchain-arm
brew install arm-none-eabi-gcc
arm-none-eabi-gcc --version
```

**Linux:**
```bash
sudo apt install -y gcc-arm-linux-gnueabihf
arm-linux-gnueabihf-gcc --version
```

#### Verify Installation

```bash
# Should show version info:
arm-linux-gnueabihf-gcc --version
arm-linux-gnueabihf-g++ --version

# Expected:
# arm-linux-gnueabihf-gcc (Debian 10.2.1-6) 10.2.1 20210110
```

### 3. STM32 SDK & Tools

#### STM32CubeIDE (For M4 Firmware Development)

**Download from**: https://www.st.com/en/development-tools/stm32cubeide.html

1. Download installer for your OS
2. Run installer with admin privileges
3. Installation location: `C:\ST\STM32CubeIDE\` (Windows) or `/opt/stm32cubeide/` (Linux/Mac)
4. Verify in IDE: **Help → About**

#### STM32 SDK (Optional, if building from source)

For cross-compilation with proper libraries:

```bash
# Download OpenSTLinux SDK from STMicroelectronics
# Extract to ~/.stm32-sdk/ or similar location

# Set environment variables:
export SYSROOT=~/.stm32-sdk/sysroots/cortexa7t2hf-neon-openstlinux-gnueabi
export CROSS_COMPILE=arm-openstlinux-gnueabi-
export PATH=~/.stm32-sdk/sysroots/x86_64-openstlinuxsdk-linux/usr/bin:$PATH
```

### 4. Docker & Docker Compose

**Required for**: Running backend services (Flask + MySQL)

#### Install Docker Desktop

**Windows:**
- Download: https://www.docker.com/products/docker-desktop
- Run installer, restart system
- Verify: `docker --version`

**macOS:**
- Download: https://www.docker.com/products/docker-desktop
- Open `.dmg` file, drag Docker to Applications
- Verify: `docker --version`

**Linux:**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker
docker --version
```

#### Install Docker Compose

**Windows / macOS:**
Docker Desktop includes Docker Compose automatically.

**Linux:**
```bash
# Verify it's installed:
docker-compose --version

# If not found, install:
sudo apt install -y docker-compose
# Or use pip:
pip3 install docker-compose
```

### 5. Required Libraries

#### For Building ImGui

**Windows (WSL):**
```bash
sudo apt install -y \
  libglfw3-dev \
  libgles2-mesa-dev \
  libegl1-mesa-dev \
  libdrm-dev \
  libgbm-dev
```

**macOS:**
```bash
brew install glfw3 --HEAD  # Latest development version

# Also install OpenGL development tools:
xcode-select --install
```

**Linux:**
```bash
sudo apt install -y \
  libglfw3-dev \
  libgles2-mesa-dev \
  libegl1-mesa-dev \
  libdrm-dev \
  libgbm-dev \
  pkg-config
```

#### For Backend Flask

```bash
# Python packages (cross-platform):
pip3 install \
  flask \
  flask-cors \
  python-dotenv \
  pymysql

# Or use requirements.txt:
pip3 install -r requirements.txt
```

### 6. Optional Development Tools

#### Text Editor / IDE

**Recommended Options:**
- **VS Code** (free, lightweight)
- **CLion** (paid, full IDE)
- **Vim/Neovim** (terminal-based)
- **Sublime Text** (fast)

#### Version Control Tools

```bash
# gitk - visual Git repository browser
# Linux/WSL:
sudo apt install -y gitk

# GitKraken - GUI Git client (all platforms)
# Download: https://www.gitkraken.com/

# GitHub Desktop (Windows/macOS)
# Download: https://desktop.github.com/
```

#### System Monitoring

```bash
# Monitor builds and resource usage:
# Linux/WSL:
sudo apt install -y htop iotop

# macOS:
brew install htop
```

---

## Environment Setup

### Create Development Directory

```bash
# Create a folder for your projects:
mkdir -p ~/attendance-system
cd ~/attendance-system

# Clone or download the project:
git clone <repository-url>
# Or extract zip file
```

### Environment Variables

**For ARM Cross-Compilation:**

```bash
# Add to ~/.bashrc or ~/.zshrc:
export CROSS_COMPILE=arm-linux-gnueabihf-
export AR=arm-linux-gnueabihf-ar
export CC=arm-linux-gnueabihf-gcc
export CXX=arm-linux-gnueabihf-g++
export LD=arm-linux-gnueabihf-ld

# Reload shell:
source ~/.bashrc  # or source ~/.zshrc
```

**For Docker:**

```bash
# Verify Docker works without sudo:
docker ps
# If error, add user to docker group:
sudo usermod -aG docker $USER
newgrp docker
docker ps  # Should work now
```

---

## Verification Checklist

### Check All Tools Are Installed

```bash
# Run this script to verify everything:
echo "=== Development Tools ==="
cmake --version
git --version
python3 --version
pkg-config --version

echo "=== ARM Compiler ==="
arm-linux-gnueabihf-gcc --version
arm-linux-gnueabihf-g++ --version

echo "=== Docker ==="
docker --version
docker-compose --version

echo "=== STM32 Tools ==="
# If you installed STM32CubeIDE, verify it's in your PATH
# or note the installation path for later

echo "=== Python Packages ==="
pip3 list | grep -E "flask|docker"

echo "=== Git ==="
git config --list | head -5
```

**Expected Output:**
- All tools show version numbers (no "command not found" errors)
- Python 3.8 or higher
- Docker and Docker Compose installed
- ARM compiler showing proper version

### Test Docker

```bash
# Run a test container:
docker run hello-world

# Expected output:
# "Hello from Docker!"
# "This message shows that your installation appears to be working correctly."

# Try docker-compose:
docker-compose --version
# Expected: docker-compose version 1.29.0 or higher
```

### Test ARM Compiler

```bash
# Create a simple test file:
cat > test.c << 'EOF'
int main() { return 0; }
EOF

# Try to compile for ARM:
arm-linux-gnueabihf-gcc -v test.c -o test_arm

# Should show compilation steps without errors
```

---

## Troubleshooting

### "command not found" errors

**Solution:**
```bash
# Ensure PATH is set correctly:
echo $PATH

# If tools are not in PATH, add them:
export PATH="/usr/bin:/usr/local/bin:$PATH"

# Or install in standard location:
sudo apt install package-name  # Installs to /usr/bin
```

### Docker permission denied

**Solution:**
```bash
# Add current user to docker group:
sudo usermod -aG docker $USER

# Log out and log back in (or use newgrp):
newgrp docker

# Test:
docker ps
```

### ARM compiler not found in CMake

**Solution:**
```bash
# Specify compiler explicitly in CMake:
cmake .. \
  -DCMAKE_C_COMPILER=arm-linux-gnueabihf-gcc \
  -DCMAKE_CXX_COMPILER=arm-linux-gnueabihf-g++
```

### WSL2 Performance Issues

**Optimization:**
```bash
# Create .wslconfig in Windows home directory:
# C:\Users\YourUsername\.wslconfig

[wsl2]
memory=4GB          # Limit WSL memory
processors=4        # Number of CPU cores
swap=2GB
localhostForwarding=true
```

### Python package conflicts

**Solution:**
```bash
# Use virtual environment:
python3 -m venv ~/venv
source ~/venv/bin/activate

# Install packages in virtual environment:
pip install flask docker

# Deactivate when done:
deactivate
```

---

## Next Steps

1. **Build ImGui Application:**
   - See [SETUP_HOST_BUILD_GUI.md](SETUP_HOST_BUILD_GUI.md)

2. **Run Backend Services:**
   - See [SETUP_HOST_BACKEND.md](SETUP_HOST_BACKEND.md)

3. **Deploy to STM32:**
   - See [SETUP_HOST_DEPLOY.md](SETUP_HOST_DEPLOY.md)

---

## Related Documentation

- [SETUP_HOST_BUILD_GUI.md](SETUP_HOST_BUILD_GUI.md) - Building ImGui
- [SETUP_HOST_BACKEND.md](SETUP_HOST_BACKEND.md) - Backend setup
- [SETUP_HOST_DEPLOY.md](SETUP_HOST_DEPLOY.md) - Deployment

---

**Last Updated**: January 28, 2026
