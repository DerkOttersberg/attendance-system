# Detailed Process (Current Release)

This document reflects the latest flow used by the **M4 firmware**, **A7 ImGui app**, and **Flask API**.

---

## Phase 1: RFID Detection (M4 → A7)

1. **M4 core** polls the RC522 via SPI5 (`ExecuteScanOnce`).
2. On card detect, M4 prints a block of lines to RPMSG:
   - `=== Card Detected ===`
   - `Card UID: ...`
   - `Card Type: ...`
   - `SAK: ...`
3. **A7 ImGui app** parses the stream using `RFIDReader`.

---

## Phase 2: Determine Action (A7 → API)

**Request:**
```http
POST /api/scan
Content-Type: application/json

{
  "rfid_uid": "8144EE19"
}
```

**Server logic:**
- If user not found → 404.
- If no open attendance today → `action = clock_in`.
- If already clocked in → clock out immediately and return `action = clock_out`.

---

## Phase 3A: Clock-In (Signature Required)

1. A7 transitions to **signature screen**.
2. User draws signature; A7 converts strokes to SVG.

**Request:**
```http
POST /api/clock_in_with_signature
Content-Type: application/json

{
  "rfid_uid": "8144EE19",
  "signature": "<svg ...>...</svg>"
}
```

**Database action:**
- Insert into `attendance` with `status = clocked_in` and `signature_data`.
- Insert into `scan_log`.

**Feedback:**
- A7 sends `buzz`, `red_on`, `green_off` to M4.
- A7 shows success screen, then returns to waiting state.

---

## Phase 3B: Clock-Out (No Signature)

The clock-out happens inside `POST /api/scan`:

- Update `attendance` with `clock_out` and `work_duration`.
- Log the scan.
- Update points on the external website.

**Feedback:**
- A7 sends `beep` to M4 and shows success screen.

---

## Error Handling (Current)

- Invalid card → UI error state.
- API unreachable → error state; manual retry by re-scan.
- Signature missing → cannot submit clock-in.

---

## Related Diagrams

- [Clock-In (Signature)](../diagrams/03-clock-in-signature/clock-in-signature.md)
- [Clock-Out (Points)](../diagrams/04-clock-out-points/clock-out-points.md)

---

**Last Updated**: January 27, 2026