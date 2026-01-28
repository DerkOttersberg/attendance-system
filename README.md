# Attendance System

Hardware-based attendance terminal with RFID, signature capture, and a web dashboard. The device runs on STM32MP157F (dual-core A7 + M4) and communicates with a Flask API backed by MySQL. A points update integrates with the existing “Punten” website.

![Project Status](https://img.shields.io/badge/status-production--ready-brightgreen)
![Hardware](https://img.shields.io/badge/hardware-STM32MP157F-blue)
![Backend](https://img.shields.io/badge/backend-Flask%20%2B%20MySQL-green)

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Quick Start (Backend + Dashboard)](#quick-start-backend--dashboard)
- [Documentation](#documentation)
- [Project Structure](#project-structure)
- [Current Status](#current-status)

## Overview

The system consists of:

- **Clock-in device** (STM32MP157F):
    - **M4 core** handles RFID polling, LEDs, buzzer, and OpenAMP/RPMSG
    - **A7 core** runs Linux + ImGui GUI + REST API client
- **Backend API** (Flask): attendance logic, signature storage, user management
- **Web dashboard** (HTML/CSS/JS): live attendance, filtering, PDF export
- **Database** (MySQL): users, attendance, scan_log, departments, products
- **Points website integration**: updates points on clock-out

## Key Features

- RFID scan for clock-in/out
- Signature capture on clock-in (SVG)
- Live admin dashboard + PDF export
- Manual attendance entries (with signature)
- Department/product management
- LED/buzzer feedback via M4 commands
- Points update to the external “Punten” website

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and the diagrams in [docs/diagrams](docs/diagrams).

![Component Deployment](docs/diagrams/01-component-deployment/RFID%20Attendance%20API%20Pipeline-2026-01-27-194226.png)

## Quick Start (Backend + Dashboard)

From the latest backend release:

```bash
cd "product/Database & Dashbaord/releases/v1.5.2/My website"
docker-compose up -d
```

- API: http://localhost:5000
- Dashboard: http://localhost:8080

For hardware and GUI setup, see [docs/HARDWARE_SETUP.md](docs/HARDWARE_SETUP.md) and [docs/GUI_SETUP.md](docs/GUI_SETUP.md).

## Documentation

- [Documentation Index](docs/docs_index.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Backend Setup](docs/BACKEND_SETUP.md)
- [API Reference](docs/API.md)
- [Database Schema](docs/DATABASE.md)
- [Dashboard Guide](docs/DASHBOARD.md)
- [Device Firmware (M4)](docs/DEVICE_FIRMWARE.md)
- [ImGui App (A7)](docs/GUI_IMGUI.md)
- [WiFi Network Change (STM32)](docs/change%20network%20in%20stm32%20wifi.txt)
- [ImGui Autostart (Systemd)](docs/IMGUI_AUTOSTART.md)
- [Detailed Process Flow](docs/markdown/detailed_process.md)
- [Project Backlog](docs/BACKLOG.md)

## Project Structure

```
attendance-system/
├── product/
│   ├── Database & Dashbaord/
│   │   └── releases/v1.5.2/My website/   # Flask API + MySQL + web dashboard
│   │   └── releases/v1.5.2/target website/ # Points website API (Express)
│   ├── GUI/IMGUI/v1.4.1/                 # Current A7 ImGui app
│   ├── STM32CUBEIDE/workspace_1.19.0/
│   │   └── dk2 v1.0.4/                   # Current M4 firmware (main.c)
│   └── ESP32/                            # Hardware test sketches
├── docs/                                # All documentation
└── STAGEVERSLAG_v2.md                    # Internship report (historical)
```

## Current Status

**Production-ready** for internal use.

**Active components**:
- M4 firmware: RFID + command parser + buzzer/LED control
- A7 ImGui app: signature capture + admin PIN + API client
- Flask API: attendance, signatures, manual entry, departments/products
- Dashboard: filtering, user management, PDF export

**Planned / backlog**: see [docs/BACKLOG.md](docs/BACKLOG.md).

---

**Last Updated**: January 27, 2026

