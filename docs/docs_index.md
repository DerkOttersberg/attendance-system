# Documentation Index

Central hub for all attendance-system documentation. This index reflects the current release set (A7 ImGui v1.4.1, M4 firmware v1.0.4, backend v1.5.2).

---

## Documentation Map

```
docs/
├── docs_index.md               # ← You are here
├── ARCHITECTURE.md             # System architecture + data flow
├── BACKEND_SETUP.md            # Backend + MySQL setup
├── DATABASE.md                 # Database schema & indexes
├── API.md                      # API reference
├── DASHBOARD.md                # Web dashboard guide
├── DEVICE_FIRMWARE.md          # M4 firmware overview
├── GUI_IMGUI.md                # A7 ImGui app overview
├── IMGUI_AUTOSTART.md           # (Blank) systemd autostart notes
├── BACKLOG.md                  # Current status + roadmap
├── change network in stm32 wifi.txt  # WiFi change steps
├── GUI_SETUP.md                # (Do not edit) GUI setup notes
├── HARDWARE_SETUP.md           # (Do not edit) hardware setup notes
├── stm32mp1-m4-autostart.md    # (Do not edit) autostart notes
├── diagrams/                   # Mermaid diagrams (do not edit)
└── markdown/
    └── detailed_process.md     # End-to-end process flow
```

---

## Quick Start

1. **[Architecture](ARCHITECTURE.md)**
2. **[Backend Setup](BACKEND_SETUP.md)**
3. **[Dashboard Guide](DASHBOARD.md)**
4. **[Device Firmware](DEVICE_FIRMWARE.md)**
5. **[ImGui App](GUI_IMGUI.md)**

---

## By Role

### Hardware / Embedded
- [Hardware Setup](HARDWARE_SETUP.md)
- [Device Firmware](DEVICE_FIRMWARE.md)
- [Autostart Notes](stm32mp1-m4-autostart.md)
- [WiFi Network Change](change%20network%20in%20stm32%20wifi.txt)

### Backend
- [Backend Setup](BACKEND_SETUP.md)
- [API Reference](API.md)
- [Database Schema](DATABASE.md)

### Frontend / Dashboard
- [Dashboard Guide](DASHBOARD.md)
- [ImGui Autostart (Systemd)](IMGUI_AUTOSTART.md)

---

## Diagrams

All Mermaid diagrams live in [docs/diagrams](diagrams). Key diagrams include:

- Component / deployment overview
- M4 command flow
- Clock-in with signature
- Clock-out with points update
- ImGui state machine
- ImGui class diagram
- Database ER diagram
- Dashboard data flow

---

**Last Updated**: January 27, 2026