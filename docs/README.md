# Attendance System Documentation

> Complete guide for the RFID attendance system built on STM32MP157F-DK2 with ImGui frontend and Flask backend.

---

## 📋 Quick Navigation

This documentation is organized by **setup location** and **component**. Choose your path:

### 🎯 I want to...

- **[Get Started (30 min overview)](#getting-started)**
- **[Set up the STM32MP157F-DK2 device](#stm32-device-setup)**
- **[Set up the backend & database on my laptop/server](#backend-setup)**
- **[Understand the system architecture](#system-architecture)**
- **[Deploy updates](#deployment--updates)**
- **[Troubleshoot issues](#troubleshooting)**

---

## Getting Started

### System Overview

The attendance system consists of three main parts:

```
┌─────────────────────────────────────────────────────┐
│         RFID Attendance System Architecture         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │    STM32MP157F-DK2 (On Device)              │  │
│  │  ┌────────────────┐    ┌─────────────────┐  │  │
│  │  │  A7 Core       │    │   M4 Core       │  │  │
│  │  │ (ImGui App)    │◄──►│ (RFID Firmware) │  │  │
│  │  │ (Linux)        │    │ (via RPMSG)     │  │  │
│  │  └────────┬───────┘    └─────────────────┘  │  │
│  │           │                                   │  │
│  │      ┌────▼─────┐                            │  │
│  │      │  Touchscreen                          │  │
│  │      │  Display                              │  │
│  │      └───────────┘                           │  │
│  └────────────┬────────────────────────────────┘  │
│               │                                    │
│               │ WiFi / Ethernet                    │
│               ▼                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │   Backend Server (Your Laptop/Server)       │  │
│  │  ┌──────────────────────────────────────┐   │  │
│  │  │  Flask API                           │   │  │
│  │  │  - /api/scan                         │   │  │
│  │  │  - /api/clock_in_with_signature      │   │  │
│  │  │  - /api/attendance                   │   │  │
│  │  └──────────────┬───────────────────────┘   │  │
│  │                │                            │  │
│  │  ┌──────────────▼───────────────────────┐   │  │
│  │  │  MySQL Database                      │   │  │
│  │  │  - users                             │   │  │
│  │  │  - attendance                        │   │  │
│  │  │  - scan_log                          │   │  │
│  │  └───────────────────────────────────────┘   │  │
│  │                                              │  │
│  │  ┌──────────────────────────────────────┐   │  │
│  │  │  Dashboard (Web UI)                  │   │  │
│  │  │  - Attendance records                │   │  │
│  │  │  - User management                   │   │  │
│  │  │  - Reports & export                  │   │  │
│  │  └───────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Device** | STM32MP157F-DK2 | - |
| **OS (A7)** | OPENstLinux | - |
| **GUI** | ImGui + GLFW | v1.4.1 |
| **Firmware (M4)** | STM32 ARM C | v1.0.4 |
| **Backend** | Flask + Python | 3.8+ |
| **Database** | MySQL | 8.0 |
| **Dashboard** | HTML5 + JavaScript | - |
| **Container** | Docker & Docker Compose | - |

---

## 📍 Setup by Location

### STM32 Device Setup

Everything you do **directly on the STM32MP157F-DK2 board**.

#### Quick Start

1. [WiFi Configuration](SETUP_STM32_WIFI.md) - Connect to your network
2. [M4 Firmware Deployment](SETUP_STM32_M4_FIRMWARE.md) - Compile on laptop, deploy to board
3. [ImGui Auto-Start](SETUP_STM32_IMGUI_KIOSK.md) - Full-screen kiosk mode at boot
4. [Hardware Setup](HARDWARE_SETUP.md) - RFID reader wiring & testing

#### Topics

- **Firmware**: How the M4 core runs RFID firmware
- **System Services**: systemd services for auto-start
- **Network**: WiFi & Ethernet configuration
- **Hardware**: Wiring, touchscreen, power

### Backend Setup

Everything on your **laptop/server** (not on the STM32).

#### Quick Start

1. [Install Dependencies](SETUP_HOST_PREREQUISITES.md) - Docker, Git, etc.
2. [Build ImGui Application](SETUP_HOST_BUILD_GUI.md) - Cross-compile with STM32 SDK
3. [Run Backend Services](SETUP_HOST_BACKEND.md) - Docker Compose for Flask + MySQL
4. [Deploy to STM32](SETUP_HOST_DEPLOY.md) - Transfer compiled binaries to board

#### Topics

- **Prerequisites**: WSL, cross-compiler, ARM SDK
- **ImGui Building**: CMake, GLFW, OpenGL ES2
- **Backend**: Flask API, MySQL database
- **Dashboard**: Web UI for administration
- **Deployment**: SCP, SSH for remote updates

---

## System Architecture

### High-Level Data Flow

```
┌──────────────────────────────────────────────────────────┐
│                    CLOCK-IN FLOW                         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  1. User scans RFID card at terminal                    │
│     └─ RFID reader (M4 core) detects UID               │
│                                                          │
│  2. M4 sends UID to A7 via RPMSG (/dev/ttyRPMSG0)      │
│     └─ ImGui application receives scan event            │
│                                                          │
│  3. ImGui app calls: POST /api/scan                     │
│     └─ Backend checks if user exists                    │
│                                                          │
│  4. User signs on touchscreen                           │
│     └─ Signature captured as SVG path                   │
│                                                          │
│  5. ImGui submits: POST /api/clock_in_with_signature   │
│     └─ Body: {uid, signature_svg, timestamp}           │
│                                                          │
│  6. Backend inserts into:                              │
│     └─ attendance (record created)                      │
│     └─ scan_log (transaction recorded)                  │
│                                                          │
│  7. ImGui shows success screen with visual feedback     │
│     └─ Green LED on, success sound                      │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Component Responsibilities

**M4 Firmware (Cortex-M4)**
- RFID polling via RC522 reader
- Card UID detection & parsing
- LED & buzzer control
- Real-time hardware feedback
- OpenAMP/RPMSG communication with A7

**ImGui Application (Cortex-A7)**
- 60 FPS UI rendering
- Touchscreen input & signature capture
- WiFi/Ethernet connectivity
- REST API calls to backend
- RPMSG communication with M4

**Flask Backend (Laptop/Server)**
- User authentication & validation
- Attendance record storage
- REST API endpoints
- Database management
- Points/rewards integration

**MySQL Database (Laptop/Server)**
- User records
- Attendance logs
- Scan transactions
- Admin data

**Web Dashboard (Browser)**
- Real-time attendance view
- User management
- Reports & PDF export
- Manual entry capability

---

## 📚 Complete Documentation Index

### Device Setup (On STM32)
- [WiFi Configuration](SETUP_STM32_WIFI.md) - Network connectivity
- [M4 Firmware](SETUP_STM32_M4_FIRMWARE.md) - Compilation & deployment
- [ImGui Kiosk Mode](SETUP_STM32_IMGUI_KIOSK.md) - Auto-start configuration
- [Hardware Setup](HARDWARE_SETUP.md) - Wiring, power, peripherals

### Host/Server Setup (On Your Machine)
- [Prerequisites](SETUP_HOST_PREREQUISITES.md) - Tools & dependencies
- [Build ImGui](SETUP_HOST_BUILD_GUI.md) - Cross-compilation
- [Backend Services](SETUP_HOST_BACKEND.md) - Docker setup
- [Deployment](SETUP_HOST_DEPLOY.md) - Transfer to STM32

### Architecture & Concepts
- [System Architecture](ARCHITECTURE.md) - Overview & diagrams
- [API Reference](API.md) - All endpoints
- [Database Schema](DATABASE.md) - Tables & relationships
- [ImGui Application](GUI_IMGUI.md) - State machine & components
- [M4 Firmware](DEVICE_FIRMWARE.md) - Commands & protocol

### Operations
- [Dashboard Guide](DASHBOARD.md) - Web UI features
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues & solutions
- [Deployment & Updates](DEPLOYMENT.md) - Release process
- [Backlog](BACKLOG.md) - Features & roadmap

---

## 🚀 Common Tasks

### First-Time Setup (30 minutes)

1. **On your laptop:**
   - [Install prerequisites](SETUP_HOST_PREREQUISITES.md)
   - [Build ImGui](SETUP_HOST_BUILD_GUI.md)
   - [Run backend](SETUP_HOST_BACKEND.md)

2. **On the STM32:**
   - [Configure WiFi](SETUP_STM32_WIFI.md)
   - [Deploy M4 firmware](SETUP_STM32_M4_FIRMWARE.md)
   - [Deploy ImGui & enable Kiosk](SETUP_STM32_IMGUI_KIOSK.md)

3. **Verify:**
   - Access dashboard at http://backend-ip:8080
   - Scan a card on the STM32 terminal

### Update ImGui Application

1. **On laptop:**
   ```bash
   cd ~/imgui_stm32/build
   make -j$(nproc)
   scp bin/imgui_app root@<stm32-ip>:/root/
   ```

2. **On STM32:**
   ```bash
   systemctl restart imgui-app.service
   ```

### Update Backend

1. **On laptop:**
   ```bash
   cd product/Database & Dashbaord/releases/v1.5.2/My website
   docker-compose down
   docker-compose up -d
   ```

### Add New User via Dashboard

1. Open http://backend-ip:8080
2. Navigate to "Users" tab
3. Click "Add User"
4. Fill in details and upload profile image

---

## 🆘 Troubleshooting

### Device Issues
- [RFID not scanning](TROUBLESHOOTING.md#rfid-not-scanning)
- [ImGui not starting](TROUBLESHOOTING.md#imgui-app-crashes)
- [WiFi not connecting](TROUBLESHOOTING.md#wifi-connection-fails)

### Backend Issues
- [API errors](TROUBLESHOOTING.md#api-errors)
- [Database connection](TROUBLESHOOTING.md#database-issues)
- [Dashboard not loading](TROUBLESHOOTING.md#dashboard-issues)

### Deployment Issues
- [Firmware won't load](TROUBLESHOOTING.md#m4-firmware-issues)
- [SSH connection problems](TROUBLESHOOTING.md#ssh-connection-issues)

---

## 📖 Documentation Standards

All documents follow this structure:

1. **Overview** - What & why
2. **Prerequisites** - Tools needed
3. **Step-by-step instructions** - How to
4. **Verification** - How to test it works
5. **Troubleshooting** - Common issues
6. **Related docs** - Links to other guides

---

## 🔄 Feedback & Updates

- Last Updated: January 28, 2026
- Version: 1.5.2 (Device v1.0.4, Backend v1.5.2)

For issues or suggestions, refer to [BACKLOG.md](BACKLOG.md).

---

## 📞 Quick Reference

| Need | Document |
|------|-----------|
| First-time setup | [README.md](README.md) |
| System overview | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Device setup | [SETUP_STM32_*](SETUP_STM32_WIFI.md) |
| Laptop setup | [SETUP_HOST_*](SETUP_HOST_PREREQUISITES.md) |
| API endpoints | [API.md](API.md) |
| Database structure | [DATABASE.md](DATABASE.md) |
| Web dashboard | [DASHBOARD.md](DASHBOARD.md) |
| Troubleshooting | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| Deploy updates | [DEPLOYMENT.md](DEPLOYMENT.md) |

---

**Start with:** [SETUP_STM32_WIFI.md](SETUP_STM32_WIFI.md) if setting up the device, or [SETUP_HOST_PREREQUISITES.md](SETUP_HOST_PREREQUISITES.md) if setting up the backend.
