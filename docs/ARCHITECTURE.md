# System Architecture

Overview of the attendance system architecture based on the current release set.

---

## Overview

The system uses a **dual-core STM32MP157F** device as the client and a **Flask + MySQL** backend. The A7 core provides the GUI and network stack, while the M4 core handles real-time RFID and hardware feedback. A web dashboard provides admin visibility and exports. On clock-out, the backend updates points on an external “Punten” website.

---

## Core Components

### 1) Device (STM32MP157F)

**A7 Core (Linux)**
- ImGui application (`product/GUI/IMGUI/v1.4.1`)
- Touch input (`/dev/input/event1`)
- REST API client (`libcurl`)
- RPMSG interface (`/dev/ttyRPMSG0`)

**M4 Core (Firmware)**
- RC522 RFID reader on SPI5
- LED + buzzer control (GPIO + TIM16 PWM)
- OpenAMP/RPMSG to A7

See [Device Firmware](DEVICE_FIRMWARE.md) and [ImGui App](GUI_IMGUI.md).

---

### 2) Backend (Flask)

Located at [product/Database & Dashbaord/releases/v1.5.2/My website/api](../product/Database%20%26%20Dashbaord/releases/v1.5.2/My%20website/api).

Key endpoints:
- `/api/scan`
- `/api/clock_in_with_signature`
- `/api/attendance/*`
- `/api/users/*`
- `/api/departments/*`, `/api/products/*`

See [API Reference](API.md) and [Backend Setup](BACKEND_SETUP.md).

---

### 3) Database (MySQL)

Tables: `users`, `attendance`, `scan_log` + runtime `departments`, `products`.
Schema defined in `init.sql`.

See [Database Schema](DATABASE.md).

---

### 4) Dashboard

Static web UI served by Nginx at `http://localhost:8080`.

See [Dashboard Guide](DASHBOARD.md).

---

### 5) Points Website Integration

On clock-out, the backend calls an external API to update points:

- `product/Database & Dashbaord/releases/v1.5.2/target website`

---

## Data Flows

### Clock-In (Signature)

1. M4 detects card, sends UID via RPMSG.
2. A7 calls `POST /api/scan`.
3. Backend responds with `action=clock_in`.
4. User signs; A7 posts `POST /api/clock_in_with_signature` with SVG.
5. Backend inserts attendance + scan_log.

See diagram: [docs/diagrams/03-clock-in-signature](diagrams/03-clock-in-signature/clock-in-signature.md).

### Clock-Out (Points)

1. M4 detects card, sends UID via RPMSG.
2. A7 calls `POST /api/scan`.
3. Backend clocks out immediately + updates points.

See diagram: [docs/diagrams/04-clock-out-points](diagrams/04-clock-out-points/clock-out-points.md).

---

## Communication

**Device internal:**
- M4 ↔ A7 via OpenAMP/RPMSG (`/dev/ttyRPMSG0`)

**Network:**
- A7 → Flask API (HTTP/JSON)
- Dashboard → Flask API (HTTP/JSON)

---

## Technology Stack

| Layer | Tech |
|------|------|
| Firmware (M4) | C, STM32CubeIDE, MFRC522, OpenAMP |
| GUI (A7) | C++, ImGui, GLFW, OpenGL, libcurl |
| Backend | Python Flask |
| Database | MySQL 8 |
| Dashboard | HTML/CSS/JS |
| Deployment | Docker Compose |

---

**Last Updated**: January 27, 2026