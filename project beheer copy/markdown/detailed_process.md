# Detailed Time Tracking System Process

## Phase 1: Initial RFID Card Validation

### Step 1: Card Detection
- **STM32 Action**: RFID reader detects card presence
- **Display Update**: Show "Processing..." message
- **Data Capture**: Read unique card ID (e.g., "ABC123456789")

### Step 2: Server Communication - Status Check
**STM32 → Server HTTP Request:**
```http
POST /api/check-status HTTP/1.1
Content-Type: application/json

{
    "rfid_card_id": "ABC123456789",
    "timestamp": "2024-01-15T08:30:00Z",
    "device_id": "STM32_001"
}
```

### Step 3: Database User Validation
**Server Database Query #1:**
```sql
SELECT 
    user_id, 
    first_name, 
    last_name, 
    is_active 
FROM users 
WHERE rfid_card_id = 'ABC123456789';
```

**Possible Outcomes:**
- **No rows returned**: Invalid card → Return error
- **User found but is_active = FALSE**: Inactive user → Return error
- **User found and is_active = TRUE**: Continue to step 4

### Step 4: Clock Status Determination
**Server Database Query #2:**
```sql
SELECT 
    entry_id,
    clock_in_time,
    clock_out_time,
    is_complete
FROM time_entries 
WHERE user_id = 123 
    AND entry_date = CURDATE() 
    AND is_complete = FALSE
LIMIT 1;
```

**Logic Decision:**
- **No incomplete entries**: User needs to CLOCK IN
- **One incomplete entry found**: User needs to CLOCK OUT

### Step 5: Server Response
**For Clock In:**
```json
{
    "status": "success",
    "action": "clock_in",
    "user_id": 123,
    "user_name": "John Doe",
    "department": "Engineering"
}
```

**For Clock Out:**
```json
{
    "status": "success",
    "action": "clock_out",
    "user_id": 123,
    "user_name": "John Doe",
    "entry_id": 456,
    "clock_in_time": "08:30:00"
}
```

## Phase 2A: Clock In Process

### Step 6A: Signature Collection
- **STM32 Action**: Parse server response indicating clock_in
- **Display Update**: Show "Welcome [User Name] - Please sign below"
- **UI Initialization**: 
  - Clear signature canvas
  - Enable touch input
  - Initialize coordinate tracking arrays

### Step 7A: Signature Capture
**Touch Event Handling:**
```javascript
// Pseudocode for signature capture
signature_data = {
    strokes: [],
    canvas_size: {width: 320, height: 240},
    start_time: current_timestamp()
}

on_touch_start(x, y) {
    current_stroke = {
        points: [{x: x, y: y, timestamp: millis()}]
    }
}

on_touch_move(x, y) {
    current_stroke.points.push({
        x: x, y: y, timestamp: millis()
    })
}

on_touch_end() {
    signature_data.strokes.push(current_stroke)
}
```

### Step 8A: Signature Validation & Transmission
- **Local Validation**: Ensure signature has at least 10 points
- **JSON Conversion**: Convert signature object to JSON string
- **Compression**: Optional - compress JSON for transmission

**STM32 → Server HTTP Request:**
```http
POST /api/clock-in HTTP/1.1
Content-Type: application/json

{
    "user_id": 123,
    "signature_json": "{\"strokes\":[{\"points\":[{\"x\":150,\"y\":200,\"timestamp\":1642234800}]}]}",
    "timestamp": "2024-01-15T08:30:15Z",
    "device_id": "STM32_001"
}
```

### Step 9A: Database Clock In Transaction
**Server Database Transaction:**
```sql
BEGIN TRANSACTION;

INSERT INTO time_entries (
    user_id,
    entry_date,
    clock_in_time,
    signature_json,
    is_complete,
    created_at
) VALUES (
    123,
    CURDATE(),
    NOW(),
    '{"strokes":[{"points":[{"x":150,"y":200}]}]}',
    FALSE,
    NOW()
);

-- Get the inserted entry_id
SET @entry_id = LAST_INSERT_ID();

COMMIT;
```

**Error Handling:**
- **Duplicate entry**: Check for existing incomplete entry
- **JSON validation**: Ensure signature_json is valid
- **Database constraints**: Handle foreign key violations

### Step 10A: Success Response & Display
**Server Response:**
```json
{
    "status": "success",
    "message": "Clocked in successfully",
    "entry_id": 789,
    "clock_in_time": "08:30:15",
    "timestamp": "2024-01-15T08:30:15Z"
}
```

**STM32 Display Update:**
- Show: "Clock In Successful"
- Show: "Time: 08:30:15"
- Show: "Have a great day, John!"
- Wait 3 seconds → Return to idle

## Phase 2B: Clock Out Process

### Step 6B: Clock Out Confirmation
- **STM32 Action**: Parse server response indicating clock_out
- **Display Update**: Show confirmation screen
  - "John Doe"
  - "Clocked in at: 08:30:15"
  - "Ready to clock out?"
- **Auto-proceed**: After 5 seconds or immediate if card removed

### Step 7B: Clock Out Transmission
**STM32 → Server HTTP Request:**
```http
POST /api/clock-out HTTP/1.1
Content-Type: application/json

{
    "entry_id": 456,
    "user_id": 123,
    "timestamp": "2024-01-15T17:30:45Z",
    "device_id": "STM32_001"
}
```

### Step 8B: Database Clock Out Transaction
**Server Database Transaction:**
```sql
BEGIN TRANSACTION;

-- Update the existing entry
UPDATE time_entries 
SET 
    clock_out_time = NOW(),
    is_complete = TRUE,
    updated_at = NOW()
WHERE entry_id = 456 
    AND user_id = 123 
    AND is_complete = FALSE;

-- Verify update was successful
SELECT ROW_COUNT() as affected_rows;

-- Calculate hours worked
SELECT 
    clock_in_time,
    clock_out_time,
    TIMESTAMPDIFF(MINUTE, clock_in_time, clock_out_time) as minutes_worked
FROM time_entries 
WHERE entry_id = 456;

COMMIT;
```

### Step 9B: Success Response & Display
**Server Response:**
```json
{
    "status": "success",
    "message": "Clocked out successfully",
    "clock_out_time": "17:30:45",
    "hours_worked": "8.5",
    "total_minutes": 510
}
```

**STM32 Display Update:**
- Show: "Clock Out Successful"
- Show: "Time: 17:30:45"
- Show: "Hours worked: 8.5"
- Show: "Good bye, John!"
- Wait 5 seconds → Return to idle

## Error Handling Scenarios

### Database Errors
1. **Connection Timeout**: Retry 3 times, then show "Server unavailable"
2. **Constraint Violations**: Log error, show "System error, try again"
3. **Transaction Deadlocks**: Automatic retry with exponential backoff

### STM32 Device Errors
1. **Network Disconnection**: Queue entry locally, sync when reconnected
2. **Invalid Signature**: "Please sign again" prompt
3. **Memory Full**: Clear old cached data

### Data Integrity Checks
1. **Duplicate Clock-in**: Prevent if user already clocked in today
2. **Clock-out without Clock-in**: Handle gracefully, log anomaly
3. **Timestamp Validation**: Ensure reasonable time differences

## Database State Management

### Complete Entry Lifecycle:
```sql
-- 1. Initial state (user clocks in)
INSERT: is_complete = FALSE, clock_out_time = NULL

-- 2. Clock out
UPDATE: is_complete = TRUE, clock_out_time = NOW()

-- 3. Query for status (next day)
SELECT: WHERE entry_date = CURDATE() AND is_complete = FALSE
-- Returns no results = ready for new clock in
```

### Data Consistency Rules:
1. Only one incomplete entry per user per day
2. Clock out time must be after clock in time  
3. Signature required for all clock ins
4. Entry date automatically set to current date