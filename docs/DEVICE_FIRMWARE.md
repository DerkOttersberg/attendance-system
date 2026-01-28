# Device Firmware (M4 Core)

This describes the M4 firmware in:

- [product/STM32CUBEIDE/workspace_1.19.0/dk2 v1.0.4/main.c](../product/STM32CUBEIDE/workspace_1.19.0/dk2%20v1.0.4/main.c)

---

## Responsibilities

- RFID polling via RC522 over SPI5
- Card UID parsing + authentication
- Virtual UART output to A7 (OpenAMP/RPMSG)
- LED + buzzer control via GPIO + TIM16
- Command parsing from A7

---

## Virtual UART Commands

Supported commands (from A7 → M4):

- `scan`
- `status`
- `read:N`
- `write:N:DATA`
- `buzz`
- `beep`
- `red_on`, `red_off`
- `green_on`, `green_off`

---

## RFID Flow (M4)

1. Periodic scan (`ExecuteScanOnce`)
2. On card detect → get UID
3. Emit logs via Virtual UART
4. Halt card + stop crypto

---

**Last Updated**: January 27, 2026
