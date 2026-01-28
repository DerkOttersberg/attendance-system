# ImGui App (A7 Core)

This describes the ImGui app in:

- [product/GUI/IMGUI/v1.4.1](../product/GUI/IMGUI/v1.4.1)

---

## Responsibilities

- Render UI at 60 FPS
- Capture signature strokes
- Read RFID data from `/dev/ttyRPMSG0`
- Call backend API endpoints
- Send M4 control commands (LED/Buzzer)

---

## State Machine

- `STATE_WAITING_CARD`
- `STATE_SIGNATURE`
- `STATE_SUCCESS`
- `STATE_ERROR`
- `STATE_ADMIN_PASSWORD`
- `STATE_ADMIN`

(See [docs/diagrams/05-imgui-state-machine](diagrams/05-imgui-state-machine/imgui-state-machine.md))

---

## Key Components

- `RFIDReader`: parses M4 output into UID + card info
- `TouchHandler`: signature capture + button areas
- `APIClient`: `/api/scan`, `/api/clock_in_with_signature`, plus direct M4 commands
- `UIRenderer`: immediate-mode rendering of screens

---

## Admin PIN

The app includes a numeric PIN screen (default `1111`) to access an admin view showing last scanned UID.

---

**Last Updated**: January 27, 2026
