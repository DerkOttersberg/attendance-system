# Attendance System

A comprehensive hardware-based time tracking and attendance management system built with STM32 microcontroller, featuring RFID authentication, touchscreen signature capture, and web-based administration.

![Project Status](https://img.shields.io/badge/status-in%20development-yellow)
![Hardware](https://img.shields.io/badge/hardware-STM32-blue)
![Backend](https://img.shields.io/badge/backend-Python%20Flask-green)

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [System Architecture](#system-architecture)
- [Quick Start](#quick-start)
- [Documentation](#documentation)
- [Project Structure](#project-structure)
- [Development Status](#development-status)
- [Contributing](#contributing)

## 🎯 Overview

This attendance system provides a seamless way for users to clock in and out using RFID cards, with digital signature capture for legal verification. The system consists of:

- **Hardware Device**: STM32-based terminal with RFID reader and touchscreen
- **Backend API**: Flask-based REST API for data management
- **Web Dashboard**: Administrative interface for attendance monitoring and reporting
- **Database**: PostgreSQL for secure data storage

## ✨ Features

### Core Functionality
- ✅ RFID-based clock in/out
- ✅ Touchscreen signature capture
- ✅ Real-time user feedback and status display
- ✅ Network communication with server
- ✅ Attendance data export to PDF with signatures

### Administrative
- ✅ Web-based dashboard for attendance overview
- ✅ User management interface
- ✅ Report generation and export
- 🔄 Points system integration (in progress)
- 🔄 Multi-language support (planned)

### System Features
- ✅ Automatic server communication
- ✅ Database synchronization
- 🔄 Offline mode with queue management (in progress)
- 🔄 Error handling with LED/buzzer feedback (planned)

## 🏗️ System Architecture

```
┌─────────────────┐
│  RFID Reader    │
└────────┬────────┘
         │
┌────────▼────────┐      ┌──────────────┐
│  STM32 Device   │◄────►│  Touchscreen │
│   (ImGui GUI)   │      └──────────────┘
└────────┬────────┘
         │ Network
         │ (WiFi/Ethernet)
┌────────▼────────┐
│   Flask API     │
│  (Backend)      │
└────────┬────────┘
         │
┌────────▼────────┐      ┌──────────────┐      ┌──────────────┐
│   PostgreSQL    │◄────►│ Web Dashboard│◄────►|Export to PDF |
│    Database     │      └──────────────┘      └──────────────┘
└─────────────────┘
```

For detailed architecture documentation, see [Architecture Overview](./docs/ARCHITECTURE.md).

## 🚀 Quick Start

### Prerequisites
- STM32F7 Discovery Board (DK1 or DK2)
- RFID reader module
- Compatible touchscreen
- Docker and Docker Compose
- Python 3.9+

### Running the Backend

```bash
cd Product/Database\ &\ Dashboard
docker-compose up -d
```

The API will be available at `http://localhost:5000`  
The dashboard will be available at `http://localhost:8080`

For detailed setup instructions, see:
- [Hardware Setup Guide](./docs/HARDWARE_SETUP.md)
- [Backend Setup Guide](./docs/BACKEND_SETUP.md)
- [GUI Development Guide](./docs/GUI_SETUP.md)

## 📚 Documentation

### User Documentation
- [User Manual](./docs/USER_MANUAL.md) - How to use the attendance device
- [Admin Guide](./docs/ADMIN_GUIDE.md) - Managing the system via web dashboard

### Technical Documentation
- [Architecture Overview](./docs/ARCHITECTURE.md) - System design and component interaction
- [Hardware Setup](./docs/HARDWARE_SETUP.md) - STM32 configuration and wiring
- [GUI Development](./docs/GUI_SETUP.md) - ImGui interface development
- [API Documentation](./docs/API.md) - Backend endpoints and usage
- [Database Schema](./docs/DATABASE.md) - Data structure and relationships
- [Flowcharts](./project%20beheer/project%20beheer/Markdown/FlowCharts/) - Process flow diagrams

### Development Guides
- [Contributing Guide](./docs/CONTRIBUTING.md)
- [Testing Guide](./docs/TESTING.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)

## 📁 Project Structure

```
attendance-system/
├── Product/
│   ├── Database & Dashboard/     # Backend API and web interface
│   │   ├── api/                  # Flask REST API
│   │   ├── web/                  # Web dashboard (HTML/CSS/JS)
│   │   ├── docker-compose.yml    # Docker configuration
│   │   └── init.sql              # Database initialization
│   │
│   ├── GUI/                      # User interface implementations
│   │   ├── IMGUI/                # Main GUI (C++ ImGui) ✅ Active
│   │   └── KIVY/                 # Python GUI test (deprecated)
│   │
│   ├── STMCUBEIDE/              # STM32 firmware projects
│   │   ├── dk1/                  # For STM32F7-DK1 board
│   │   └── dk2/                  # For STM32F7-DK2 board
│   │
│   └── ESP32/                    # Hardware testing sketches
│       ├── RFID_test.ino
│       └── Touchscreen_test/
│
├── project beheer/               # Project management
│   └── project beheer/
│       ├── Burndown diagrams/    # Sprint tracking
│       └── Markdown/
│           └── FlowCharts/       # System flowcharts
│
└── docs/                         # Documentation (see above)
```

### Key Components

#### 1. **STM32 Device** ([Hardware Setup](./docs/HARDWARE_SETUP.md))
- Main controller running embedded Linux
- ImGui-based graphical interface
- RFID reader integration
- Touchscreen driver implementation

#### 2. **Backend API** ([API Documentation](./docs/API.md))
- Flask-based REST API
- PostgreSQL database
- Docker containerized
- Handles authentication, time entries, and signatures

#### 3. **Web Dashboard** ([Admin Guide](./docs/ADMIN_GUIDE.md))
- Real-time attendance monitoring
- User management
- Report generation and PDF export
- Responsive design

## 📊 Development Status

### Completed ✅
- [x] Hardware foundation (STM32, RFID, touchscreen)
- [x] RFID check-in/check-out functionality
- [x] Touchscreen signature capture
- [x] ImGui-based user interface
- [x] Backend API with database
- [x] Web dashboard
- [x] PDF export with signatures
- [x] Network communication

### In Progress 🔄
- [ ] Physical encasing design
- [ ] Offline mode with queue management
- [ ] Points system integration
- [ ] User status display enhancements
- [ ] Admin user management interface

### Planned 📋
- [ ] Error feedback (LED/buzzer)
- [ ] System reset functionality
- [ ] Multi-language support
- [ ] Security implementation
- [ ] Custom PCB design
- [ ] GUI screen restriction (kiosk mode)

See the [Product Backlog](./docs/BACKLOG.md) for detailed task breakdown.

## 🔄 Process Flows

### Clock-In Flow
```
User Scans RFID → Device Reads Card → API Validates User → 
Display Welcome Screen → User Signs on Touchscreen → 
Signature Stored → Time Entry Created → Success Feedback
```

See [Clock-In Flowchart](./project%20beheer/project%20beheer/Markdown/FlowCharts/flowchart%20CLOCKIN%20COMPACT.md) for detailed flow.

### Dashboard Flow
See [Dashboard Flowchart](./project%20beheer/project%20beheer/Markdown/FlowCharts/flowchart%20Dashboard%20compact.md) for administrative workflows.

## 🛠️ Technology Stack

### Hardware
- **Microcontroller**: STM32F7 Discovery (DK1/DK2)
- **RFID**: RC522/PN532 module
- **Display**: SPI touchscreen (driver-dependent)
- **OS**: Embedded Linux

### Software
- **GUI Framework**: Dear ImGui (C++)
- **Backend**: Python Flask
- **Database**: PostgreSQL
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Containerization**: Docker

### Development Tools
- STM32CubeIDE
- Visual Studio Code
- Docker Desktop
- Git

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./docs/CONTRIBUTING.md) for details on:
- Code style and standards
- Development workflow
- Testing requirements
- Pull request process

## 📄 License

This project is developed as part of an educational/commercial project. License details to be determined.

## 📞 Contact & Support

For questions, issues, or contributions:
- Create an issue in the repository
- Contact the development team
- See [Project Management](./project%20beheer/) for sprint planning and burndown charts

## 🎓 Project Management

This project follows Agile methodology with:
- Sprint-based development
- User story tracking
- Regular burndown chart updates

See [Project Beheer](./project%20beheer/project%20beheer/) for:
- Burndown diagrams
- Sprint planning documents
- Technical flowcharts

---

**Last Updated**: November 2025  
**Version**: 1.2.5.2  
**Status**: Active Development