# 🔄 SEQUENCE DIAGRAMS - RFID Attendance System

Gedetailleerde interactie-diagrammen voor alle kritieke processen in het systeem.

---

## 📑 Inhoudsopgave

- [🔄 SEQUENCE DIAGRAMS - RFID Attendance System](#-sequence-diagrams---rfid-attendance-system)
  - [📑 Inhoudsopgave](#-inhoudsopgave)
  - [Clock-In Flow (Compleet)](#clock-in-flow-compleet)
  - [Clock-Out Flow](#clock-out-flow)
  - [Dual-Core RFID Communication](#dual-core-rfid-communication)
  - [Dashboard Real-Time Update](#dashboard-real-time-update)
  - [PDF Export with Signatures](#pdf-export-with-signatures)
  - [Admin User Management](#admin-user-management)
  - [Error Handling \& Recovery](#error-handling--recovery)
  - [Database Transaction Flow](#database-transaction-flow)
  - [📊 Sequence Diagram Legend](#-sequence-diagram-legend)
  - [🔄 Integrale Flow (End-to-End)](#-integrale-flow-end-to-end)

---

## Clock-In Flow (Compleet)

**Scenario:** Werknemer scant RFID-kaart → Tekent → Systeem registreert

```
┌──────────┐  ┌────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐
│ Employee │  │ RFID Card  │  │ STM32MP157F  │  │  Flask API   │  │   MySQL    │
│   (User) │  │   Reader   │  │   (ImGui)    │  │   (Backend)  │  │ (Database) │
└────┬─────┘  └────────────┘  └──────────────┘  └──────────────┘  └────────────┘
     │              │                 │                 │                │
     │              │1. Scan RFID Card│                 │                │
     │   ┌──────────┼────────────────►│                 │                │
     │   │          │                 │                 │                │
     │   │          │2. RC522 Driver  │                 │                │
     │   │          │   Read UID      │                 │                │
     │   │          │   (SPI5)        │                 │                │
     │   │          │◄────────────────┤                 │                │
     │   │          │   UID: 8144EE19 │                 │                │
     │   │          │                 │                 │                │
     │   │          │3. Forward UID   │                 │                │
     │   │          │   via RPMSG     │                 │                │
     │   │          │   (/ttyRPMSG0)  │                 │                │
     │   │          │────────────────►│                 │                │
     │   │          │                 │                 │                │
     │   │          │         4. API Call: POST /api/scan             │
     │   │          │         Payload: {"rfid_uid":"8144EE19"}        │
     │   │          │────────────────────────────────────────────────►│
     │   │          │                 │                 │                │
     │   │          │                 │         5. Validate RFID       │
     │   │          │                 │         SELECT * FROM users    │
     │   │          │                 │            WHERE rfid_uid=..   │
     │   │          │                 │────────────────────────────────►│
     │   │          │                 │                 │                │
     │   │          │                 │         6. Check today's status│
     │   │          │                 │         SELECT * FROM attendance│
     │   │          │                 │         WHERE user_id AND date=│
     │   │          │                 │────────────────────────────────►│
     │   │          │                 │                 │                │
     │   │          │                 │  7. Response: action='clock_in' │
     │   │          │                 │◄────────────────────────────────┤
     │   │          │                 │                 │                │
     │   │          │  8. Parse Response                │                │
     │   │          │  Display: "Welcome John! Please   │                │
     │   │          │            sign below"            │                │
     │   │          │                 │                 │                │
     │   │          │                 │ Init Signature  │                │
     │   │          │                 │ Canvas (550x270)│                │
     │   │          │                 │                 │                │
     ├───┤          │                 │                 │                │
     │   │  9. User Draws Signature (Touchscreen Events)                │
     │   │  ┌─────────────────────────┐                 │                │
     │   │  │ Touch Down Event        │                 │                │
     │   │  │ → Add Point (x, y)      │                 │                │
     │   │  │ Touch Move Event        │                 │                │
     │   │  │ → Add Points (x1, y1... │                 │                │
     │   │  │ Touch Up Event          │                 │                │
     │   │  │ → End Stroke            │                 │                │
     │   │  └─────────────────────────┘                 │                │
     │   │          │                 │                 │                │
     │   │          │ 10. Signature Complete             │                │
     │   └─────────►│ User clicks SUBMIT                │                │
     │              │                 │                 │                │
     │              │ 11. Convert to SVG                │                │
     │              │     <svg width="550"...            │                │
     │              │     <polyline points=...           │                │
     │              │                 │                 │                │
     │              │ 12. Base64 Encode                 │                │
     │              │                 │                 │                │
     │              │ 13. API Call: POST /api/clock_in_with_signature  │
     │              │────────────────────────────────────────────────►│
     │              │     Payload:                       │                │
     │              │     {                              │                │
     │              │       "rfid_uid":"8144EE19",      │                │
     │              │       "signature":"<svg>..."       │                │
     │              │     }                              │                │
     │              │                 │                 │                │
     │              │                 │ 14. Validate    │                │
     │              │                 │ Check user      │                │
     │              │                 │────────────────►│                │
     │              │                 │                 │                │
     │              │                 │ 15. Insert      │                │
     │              │                 │ attendance      │                │
     │              │                 │ record          │                │
     │              │                 │ WITH signature  │                │
     │              │                 │────────────────►│                │
     │              │                 │                 │                │
     │              │                 │ INSERT INTO     │                │
     │              │                 │ attendance      │                │
     │              │                 │ (user_id,       │                │
     │              │                 │  clock_in,      │                │
     │              │                 │  signature_data)│                │
     │              │                 │                 │                │
     │              │                 │ 16. Response: OK│                │
     │              │                 │◄────────────────┤                │
     │              │                 │                 │                │
     │              │ 17. Display Success Message        │                │
     │              │ "Welcome John Doe!                │                │
     │              │  Clocked In Successfully"          │                │
     │              │                 │                 │                │
     │              │ 18. Return to WAITING_CARD State   │                │
     │              │                 │                 │                │
```

**Tijdschema:**
- Kaart scannen → RFID detect: 50-200ms
- API validatie: 100-300ms
- Signature drawing: 5-30 seconden (user)
- API submit + DB insert: 200-500ms
- **Totaal proces:** ~6-35 seconden

---

## Clock-Out Flow

**Scenario:** Werknemer scant RFID-kaart → Directe uitklok (geen handtekening nodig)

```
┌──────────┐  ┌────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐
│ Employee │  │ RFID Card  │  │ STM32MP157F  │  │  Flask API   │  │   MySQL    │
│          │  │   Reader   │  │   (ImGui)    │  │   (Backend)  │  │ (Database) │
└────┬─────┘  └────────────┘  └──────────────┘  └──────────────┘  └────────────┘
     │              │                 │                 │                │
     │              │1. Scan RFID Card│                 │                │
     │   ┌──────────┼────────────────►│                 │                │
     │   │          │                 │                 │                │
     │   │          │2. Read UID via RC522               │                │
     │   │          │◄────────────────┤                 │                │
     │   │          │                 │                 │                │
     │   │          │3. Forward UID via RPMSG           │                │
     │   │          │────────────────►│                 │                │
     │   │          │                 │                 │                │
     │   │          │4. POST /api/scan                  │                │
     │   │          │────────────────────────────────────────────────►│
     │   │          │                 │                 │                │
     │   │          │                 │5. Query Database                │
     │   │          │                 │   SELECT * FROM attendance      │
     │   │          │                 │   WHERE user_id AND            │
     │   │          │                 │   date=TODAY AND status=pending │
     │   │          │                 │────────────────────────────────►│
     │   │          │                 │                 │                │
     │   │          │                 │  ✓ Found existing clock_in      │
     │   │          │                 │◄────────────────────────────────┤
     │   │          │                 │                 │                │
     │   │          │ 6. Response: action='clock_out'    │                │
     │   │          │◄────────────────────────────────────────────────┤
     │   │          │                 │                 │                │
     │   │          │7. Display: "Goodbye John!          │                │
     │   │          │            Clocked Out"            │                │
     │   │          │                 │                 │                │
     │   │          │ NO signature required!             │                │
     │   │          │                 │                 │                │
     │   │          │ 8. Auto-submit clock_out           │                │
     │   │          │────────────────────────────────────────────────►│
     │   │          │    POST /api/clock_out             │                │
     │   │          │    {"rfid_uid":"8144EE19"}         │                │
     │   │          │                 │                 │                │
     │   │          │                 │ 9. UPDATE attendance            │
     │   │          │                 │    SET clock_out=NOW()          │
     │   │          │                 │    SET status='clocked_out'     │
     │   │          │                 │    SET work_duration=...        │
     │   │          │                 │────────────────────────────────►│
     │   │          │                 │                 │                │
     │   │          │                 │ 10. Response: OK                │
     │   │          │                 │◄────────────────┤                │
     │   │          │                 │                 │                │
     │   │          │ 11. Success msg (2 sec)            │                │
     │   │          │ Return to WAITING_CARD             │                │
     │   │          │                 │                 │                │
```

**Tijdschema:**
- Kaart scannen: 50-200ms
- API validatie + DB update: 200-500ms
- **Totaal:** ~1-2 seconden ✅ (veel sneller dan clock-in!)

---

## Dual-Core RFID Communication

**Scenario:** M4 Firmware ↔ A7 Linux via OpenAMP/RPMSG

```
┌─────────────────┐                              ┌─────────────────┐
│   M4 Core       │                              │   A7 Core       │
│  (RFID Fw)      │                              │  (ImGui)        │
│   200MHz        │                              │   800MHz        │
└────────┬────────┘                              └────────┬────────┘
         │                                               │
         │ 1. MFRC522_Request()                         │
         │    Detect card presence (100ms poll)         │
         │                                               │
         │ 2. MFRC522_Anticoll() + SelectTag()          │
         │    Get UID via SPI5                          │
         │                                               │
         │ 3. Format message                            │
         │    "=== Card Detected ===\r\n"               │
         │    "Card UID: 8144EE19 \r\n"                │
         │    "Card Type: MIFARE_1K\r\n"                │
         │    "=== End ===\r\n"                         │
         │                                               │
         ├─────────────────────────────────────────────►│
         │    VIRT_UART_Transmit()                     │
         │    Via /dev/ttyRPMSG0                        │
         │    (OpenAMP RPMSG channel)                   │
         │    Latency: < 5ms                            │
         │                                               │
         │                                      4. Read from UART
         │                                      qrint("RX: ... ")
         │                                      Parse RFID data
         │                                      │
         │                                      5. POST /api/scan
         │                                      via CURL to API
         │                                      │
         │◄─────────────────────────────────────┤
         │  6. Response: {"action":"clock_in"}  │
         │     via Serial (Virtual UART)         │
         │                                       │
         │  7. qprint(">> Action: clock_in")    │
         │                                       │
         │  (A7 already showing UI)              │
         │  (M4 ready for next scan)             │
         │                                       │
         │ 8. If timeout (30s):                 │
         │    No signature submit                │
         │    Return to WAITING_CARD             │
         │                                       │
         │ 9. On signature submit:               │
         │    A7 sends signature via CURL        │
         │    M4 stays in background polling     │
         │                                       │

Connection Details:
┌──────────────────────────────────────┐
│   RPMSG Channel (/dev/ttyRPMSG0)     │
├──────────────────────────────────────┤
│ Bandwidth: Shared memory (fast)      │
│ Latency: < 5ms per message           │
│ Protocol: Virtual UART over RPMSG    │
│ Baud rate: 115200 (virtual)          │
│ Max message: 256 bytes               │
└──────────────────────────────────────┘
```

---

## Dashboard Real-Time Update

**Scenario:** Web dashboard toont live aanwezigheidsgegevens

```
┌──────────────┐        ┌──────────────┐        ┌──────────────┐        ┌────────────┐
│  Web Browser │        │ ImGui Device │        │  Flask API   │        │   MySQL    │
│ (Dashboard)  │        │   (Device)   │        │  (Backend)   │        │ (Database) │
└──────┬───────┘        └──────────────┘        └──────────────┘        └────────────┘
       │                       │                        │                      │
       │ 1. Load Dashboard     │                        │                      │
       │ (index.html)          │                        │                      │
       │                       │                        │                      │
       │ 2. DOMContentLoaded   │                        │                      │
       │ Call: loadAllData()   │                        │                      │
       │────────────────────────────────────────────────────────────────────────►
       │                       │                GET /api/stats               │
       │                       │◄───────────────────────────────────────────────┤
       │                       │                       │                      │
       │ 3. Render Stats Cards │                       │                      │
       │ - Total checked in    │                       │                      │
       │ - Total checked out   │                       │                      │
       │ - Currently present   │                       │                      │
       │                       │                       │                      │
       │ 4. Load Today         │                       │                      │
       │────────────────────────────────────────────────────────────────────────►
       │                       │                GET /api/attendance/today   │
       │                       │                       │                      │
       │                       │ 5. RFID Scan Happens  │                      │
       │                       │ Device detects card   │                      │
       │                       │────────────────────────────────────────────►│
       │                       │                       │                      │
       │                       │                       │ 6. INSERT attendance│
       │                       │                       │────────────────────►│
       │                       │                       │                      │
       │◄────────────────────────────────────────────────────────────────────┤
       │                       │      Response with updated record            │
       │                       │                       │                      │
       │ 7. Render Table       │                       │                      │
       │ Name | Dept | Clock In│                       │                      │
       │──────┼──────┼─────────│                       │                      │
       │ John | Eng  | 08:30   │                       │                      │
       │ NEW!                  │                       │                      │
       │                       │                       │                      │
       │ 8. setInterval()      │                       │                      │
       │ Every 30 seconds      │                       │                      │
       │ refresh data          │                       │                      │
       │                       │                       │                      │
       ├───────────────────────┬───────────────────────┬───────────────────────┤
       │ [30s interval]        │                       │                       │
       │────────────────────────────────────────────────────────────────────────►
       │                       │                GET /api/attendance/today   │
       │                       │                       │                      │
       │◄────────────────────────────────────────────────────────────────────┤
       │ Updated data          │                       │                      │
       │                       │                       │                      │
       │ 9. User applies filters                       │                      │
       │ "Show only Engineering"                       │                      │
       │ "Date: 2025-01-20"                            │                      │
       │────────────────────────────────────────────────────────────────────────►
       │                       │ GET /api/attendance/filter?              │
       │                       │     user_id=...&start_date=...&end_date=...  │
       │                       │                       │                      │
       │                       │       10. Database query with INDEX            │
       │                       │           Fast lookup (< 100ms)             │
       │                       │                       │                      │
       │◄────────────────────────────────────────────────────────────────────┤
       │ Filtered results       │                       │                      │
       │                       │                       │                      │
       │ 11. Render filtered   │                       │                      │
       │ table only "Eng" dept │                       │                      │
       │                       │                       │                      │
```

**Performance:**
- Initial load: ~500ms (4 API calls parallel)
- Refresh interval: 30s
- Filter query: ~100ms (indexed)
- Dashboard update: < 50ms (canvas render)

---

## PDF Export with Signatures

**Scenario:** Beheerder exporteert attendance rapport met handtekeningen

```
┌──────────────┐  ┌──────────────────┐  ┌──────────────┐  ┌────────────────┐
│  Web Browser │  │   jsPDF Library  │  │  html2canvas │  │    MySQL       │
│ (Dashboard)  │  │   (PDF gen)      │  │ (Screenshot) │  │  (Signatures)  │
└──────┬───────┘  └──────────────────┘  └──────────────┘  └────────────────┘
       │                  │                      │                 │
       │ 1. User clicks   │                      │                 │
       │ "Export PDF"     │                      │                 │
       │                  │                      │                 │
       │ 2. Gather data   │                      │                 │
       │ (State.filtered)  │                      │                 │
       │ Name, Clock in/out│                      │                 │
       │ Signature SVG data│                      │                 │
       │                  │                      │                 │
       │ 3. Initialize    │                      │                 │
       │ jsPDF document   │                      │                 │
       │ A4 format        │                      │                 │
       ├──────────────────┤                      │                 │
       │                  │ 4. Add Title         │                 │
       │                  │ "Attendance Report"  │                 │
       │                  │ "January 2025"       │                 │
       │                  │                      │                 │
       │ 5. Render data   │                      │                 │
       │ to canvas        │                      │                 │
       │ (table in DOM)   ├──────────────────────┤                 │
       │                  │                      │ 6. Screenshot   │
       │                  │                      │ table region    │
       │                  │                      │ as PNG          │
       │                  │                      │                 │
       │ 7. Add image     │                      │                 │
       │ to PDF           │                      │                 │
       │ with title       │                      │                 │
       │                  │                      │                 │
       │ 8. For each record with signature:      │                 │
       │                  │                      │                 │
       │    a) Add new page                      │                 │
       │    b) Add record info:                  │                 │
       │       "John Doe - Engineering"          │                 │
       │       "Clock In: 08:30"                 │                 │
       │       "Clock Out: 17:00"                │                 │
       │                  │                      │                 │
       │    c) Retrieve signature SVG            │                 │
       │       from State.filteredData           │                 │
       │                  │                      │                 │
       │    d) Parse SVG:                        │                 │
       │       <svg width="550">                 │                 │
       │       <polyline points="..."/>          │                 │
       │                  │                      │                 │
       │    e) Render SVG as image in PDF        │                 │
       │       Width: 150mm                      │                 │
       │       Position: Center, below info      │                 │
       │                  │                      │                 │
       │ 9. All pages complete                   │                 │
       │                  │                      │                 │
       │ 10. Download:    │                      │                 │
       │ doc.save(        │                      │                 │
       │   'attendance_   │                      │                 │
       │    report.pdf'   │                      │                 │
       │ )                │                      │                 │
       │                  │                      │                 │
       │ ✓ PDF saved!     │                      │                 │
       │                  │                      │                 │

Generated PDF Structure:
┌─────────────────────────────────────┐
│ Page 1: Title Page                  │
│ ┌─────────────────────────────────┐ │
│ │  ATTENDANCE REPORT              │ │
│ │  January 2025                   │ │
│ │                                 │ │
│ │  Total Records: 23              │ │
│ │  Date Range: 01-01 to 01-31     │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Page 2: Summary Table               │
│ ┌─────────────────────────────────┐ │
│ │ Name    │ Dept      │ Clock In  │ │
│ │ John    │ Engineer  │ 08:30     │ │
│ │ Jane    │ Sales     │ 09:15     │ │
│ │ Bob     │ Engineer  │ 08:00     │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Page 3+: Individual Signatures      │
│ ┌─────────────────────────────────┐ │
│ │ John Doe - Engineering          │ │
│ │ Clock In: 08:30 | Clock Out: 17:00
│ │                                 │ │
│ │    ┌────────────────────────┐   │ │
│ │    │                        │   │ │
│ │    │   [Signature SVG]      │   │ │
│ │    │                        │   │ │
│ │    └────────────────────────┘   │ │
│ │                                 │ │
│ │ Date: 2025-01-24                │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Performance:**
- Large dataset (100 records): ~2-3 seconds
- Each signature render: ~100ms
- PDF file size: 2-5MB (depending on signatures)

---

## Admin User Management

**Scenario:** Beheerder voegt nieuwe gebruiker toe via dashboard

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐
│ Admin User   │  │ Web Dashboard│  │  Flask API   │  │   MySQL    │
│  (Browser)   │  │ (Frontend)   │  │  (Backend)   │  │ (Database) │
└──────┬───────┘  └──────────────┘  └──────────────┘  └────────────┘
       │                │                  │                │
       │ 1. Click       │                  │                │
       │ "➕ Add User"  │                  │                │
       │────────────────┤                  │                │
       │                │ 2. Show modal    │                │
       │                │ form:            │                │
       │                │ - RFID UID       │                │
       │                │ - Name           │                │
       │                │ - Email          │                │
       │                │ - Department     │                │
       │                │                  │                │
       │ 3. Fill form   │                  │                │
       │ RFID: 04A1B2C3 │                  │                │
       │ Name: Alice    │                  │                │
       │ Email: alice@  │                  │                │
       │ Dept: HR       │                  │                │
       │                │                  │                │
       │ 4. Click       │                  │                │
       │ "Create User"  │                  │                │
       │────────────────┤                  │                │
       │                │ 5. Client-side   │                │
       │                │ validation:      │                │
       │                │ - RFID not empty │                │
       │                │ - Name not empty │                │
       │                │ - Valid email    │                │
       │                │                  │                │
       │                │ 6. POST          │                │
       │                │ /api/users       │                │
       │                ├─────────────────►│                │
       │                │   Payload:       │                │
       │                │   {              │                │
       │                │    rfid_uid:     │                │
       │                │    "04A1B2C3",   │                │
       │                │    name: "Alice",│                │
       │                │    email: ...    │                │
       │                │   }              │                │
       │                │                  │                │
       │                │                  │ 7. Validate    │
       │                │                  │ - RFID unique? │
       │                │                  │────────────────┤
       │                │                  │                │
       │                │                  │ SELECT count   │
       │                │                  │ FROM users     │
       │                │                  │ WHERE rfid=..  │
       │                │                  │◄───────────────┤
       │                │                  │                │
       │                │                  │ 8. INSERT new  │
       │                │                  │────────────────┤
       │                │                  │                │
       │                │                  │ INSERT INTO    │
       │                │                  │ users          │
       │                │                  │ (rfid_uid,     │
       │                │                  │  name, email,  │
       │                │                  │  department)   │
       │                │                  │ VALUES (...)   │
       │                │                  │                │
       │                │                  │ ✓ Success      │
       │                │                  │ (user_id: 42)  │
       │                │◄──────────────────────────────────┤
       │                │ 9. Response:     │                │
       │                │ {success: true,  │                │
       │                │  user_id: 42}    │                │
       │                │                  │                │
       │                │ 10. Close modal  │                │
       │                │ Refresh users    │                │
       │                │ table            │                │
       │────────────────┤                  │                │
       │ ✓ User added!  │ 11. GET /api/    │                │
       │ Alice now in   │     users        │                │
       │ user list      ├─────────────────►│                │
       │                │                  │ SELECT all     │
       │                │                  │────────────────┤
       │                │                  │                │
       │                │◄──────────────────────────────────┤
       │                │ [Alice in list]  │                │
       │                │                  │                │
       │ ✅ Done!       │                  │                │
       │                │                  │                │
```

---

## Error Handling & Recovery

**Scenario:** API is onbereikbaar → Device gaat offline → Automatische herconnectie

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐
│ STM32 Device │  │  Flask API   │  │ Network      │  │   MySQL    │
│  (ImGui)     │  │  (Backend)   │  │              │  │ (Database) │
└──────┬───────┘  └──────────────┘  └──────────────┘  └────────────┘
       │                │                  │                │
       │ 1. Device      │                  │                │
       │ working        │                  │                │
       │ normally       │                  │                │
       │                │                  │                │
       │ 2. POST        │                  │                │
       │ /api/scan      ├─────────────────►│                │
       │ RFID: ...      │                  │ TIMEOUT!       │
       │                │                  │ (30 sec)       │
       │                │ ✗ Connection     │                │
       │                │   lost           │                │
       │                │                  │                │
       │ 3. Error:      │                  │                │
       │ "Connection    │                  │                │
       │  failed"       │                  │                │
       │                │                  │                │
       │ 4. Display:    │                  │                │
       │ "Error:        │                  │                │
       │  Server not    │                  │                │
       │  responding.   │                  │                │
       │  Retrying..."  │                  │                │
       │                │                  │                │
       │ [LED: RED]     │                  │                │
       │ [Buzzer: OFF]  │                  │                │
       │                │                  │                │
       │ 5. Retry 1:    │                  │                │
       │ Wait 2 sec     │                  │                │
       │ POST /api/scan ├─────────────────►│                │
       │ RFID: ...      │                  │ TIMEOUT!       │
       │                │                  │                │
       │ 6. Retry 2:    │                  │                │
       │ Wait 4 sec     │                  │ Network         │
       │ (exp backoff)  │                  │ restored!       │
       │ POST /api/scan ├─────────────────►│                │
       │ RFID: ...      │                  ├─────────────────┤
       │                │                  │ ✓ Connection OK │
       │                │                  │                │
       │                │ ✓ Response OK    │                │
       │◄───────────────┤                  │                │
       │ action=        │                  │                │
       │ clock_in       │                  │                │
       │                │                  │                │
       │ 7. Display:    │                  │                │
       │ "Welcome back! │                  │                │
       │  Please sign"  │                  │                │
       │                │                  │                │
       │ [LED: GREEN]   │                  │                │
       │ [Buzzer: BEEP] │                  │                │
       │                │                  │                │
       │ 8. Continue    │                  │                │
       │ normal flow    │                  │                │
       │                │                  │                │
```

**Retry Logic:**
```
Attempt 1: Immediate
Attempt 2: Wait 2^1 = 2 sec
Attempt 3: Wait 2^2 = 4 sec
Attempt 4: Wait 2^3 = 8 sec
Max retries: 5

If all fail:
└─ Queue entry locally (planned feature)
└─ Wait for network recovery
└─ Auto-sync when online
```

---

## Database Transaction Flow

**Scenario:** Clock-in transactie met atomaire integriteit

```
┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐
│  Flask API   │  │ Connection   │  │   MySQL Database       │
│  (Backend)   │  │ Pool         │  │   (Transaction Log)    │
└──────┬───────┘  └──────────────┘  └────────────────────────┘
       │                │                      │
       │ 1. Request     │                      │
       │ arrives        │                      │
       │────────────────┤                      │
       │                │ 2. Get connection   │
       │                │ from pool            │
       │                ├─────────────────────┤
       │                │ ✓ Connection OK     │
       │                │                     │
       │ 3. SQL:        │                      │
       │ BEGIN          ├─────────────────────┤
       │ TRANSACTION    │ Lock tables          │
       │                │                      │
       │ 4. SELECT      │                      │
       │ users WHERE    ├─────────────────────┤
       │ rfid = '...'   │ Read lock            │
       │                │                      │
       │ 5. Validate    │                      │
       │ (client side)  │                      │
       │ User found ✓   │                      │
       │                │                      │
       │ 6. SELECT      │                      │
       │ attendance     ├─────────────────────┤
       │ WHERE user_id  │ Read lock            │
       │ AND date=...   │                      │
       │                │                      │
       │ 7. Check:      │                      │
       │ Not clocked in │                      │
       │ yet ✓          │                      │
       │                │                      │
       │ 8. INSERT      │                      │
       │ attendance     ├─────────────────────┤
       │ new record     │ Write lock           │
       │ (clock_in,     │ INSERT completed     │
       │  date, status) │ (ID: 12345)          │
       │                │                      │
       │ 9. INSERT      │                      │
       │ scan_log       ├─────────────────────┤
       │ audit entry    │ Write lock           │
       │                │ INSERT completed     │
       │                │                      │
       │ 10. All OK?    │                      │
       │ YES!           │                      │
       │                │                      │
       │ 11. COMMIT     ├─────────────────────┤
       │                │ Flush to disk        │
       │                │ Release locks        │
       │                │ Transaction complete│
       │                │                      │
       │ ✓ Success      │                      │
       │ Return: 200    │                      │
       │                │                      │
       │ [Alternative:  │                      │
       │  If error at   │                      │
       │  any step...]  │                      │
       │                │                      │
       │ ROLLBACK       ├─────────────────────┤
       │                │ Undo all changes     │
       │                │ Release locks       │
       │                │ Return to clean state
       │                │                      │
       │ ✗ Error        │                      │
       │ Return: 500    │                      │
       │                │                      │

Transaction Isolation Level: READ COMMITTED
Locks:
├─ Shared locks (SELECT)
├─ Exclusive locks (INSERT/UPDATE)
└─ Deadlock detection enabled

Rollback conditions:
├─ User not found
├─ Duplicate RFID
├─ Invalid user status
├─ Database error
└─ Timeout
```

---

## 📊 Sequence Diagram Legend

```
Actor/Component   → Request/Action
                  ← Response/Return
                  ├─ Parallel process
                  └─ Sequential step

[LED: GREEN]   = Hardware feedback
[Buzzer: BEEP] = Audio signal
✓              = Success
✗              = Error
...            = Continued action
```

---

## 🔄 Integrale Flow (End-to-End)

**Complete user journey:**

```
EMPLOYEE PERSPECTIVE:
1. Walk up to terminal
   └─► See: "Scan your RFID card"
   
2. Scan RFID card (~1 second)
   └─► Device beeps (Buzzer_Beep)
   └─► LED turns green
   
3. Device determines action:
   └─ CLOCK IN? → Show signature screen
   └─ CLOCK OUT? → Show success message
   
4. If CLOCK IN:
   ├─ Draws signature (5-30 sec)
   ├─ Clicks submit
   └─► System confirms
       └─► LED green, buzzer beeps
       └─► "Welcome [Name]! Clocked In"
       
5. System updates:
   ├─► Database: INSERT attendance record
   ├─► Database: STORE signature (SVG)
   ├─► Audit log: INSERT scan entry
   └─► Dashboard: Realtime update (30s refresh)

ADMIN PERSPECTIVE:
1. Open dashboard (browser)
2. See stats (realtime):
   ├─ 23 checked in
   ├─ 18 checked out
   ├─ 5 currently present
3. Filter by date/department
4. Click "Export PDF"
5. Download with signatures embedded
6. Send to manager/HR

SYSTEM PERSPECTIVE:
├─ M4: RFID polling every 100ms
├─ A7: ImGui rendering at 60 FPS
├─ API: Handles requests < 500ms
├─ Database: Queries indexed < 100ms
├─ Dashboard: Auto-refresh every 30s
└─ Error recovery: Exponential backoff
```

---

**Last Updated:** 24 Januari 2026  
**Version:** 1.0  
**Status:** Production Ready
