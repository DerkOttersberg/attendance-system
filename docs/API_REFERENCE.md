# API Reference

> Complete documentation of the Flask backend REST API endpoints

---

## Overview

The Flask API runs in Docker on the backend server and handles all attendance, user, and system operations. Default URL: `http://localhost:5000`

**Base URL for all endpoints**: `http://<backend-server>:5000`

---

## Core Endpoints

### Health Check

#### GET `/health`

Verify API is running and database is accessible.

**Request:**
```http
GET /health HTTP/1.1
Host: localhost:5000
```

**Response (Success - 200):**
```json
{
  "status": "ok",
  "timestamp": "2026-01-28T10:30:00Z",
  "database": "connected",
  "version": "1.5.2"
}
```

**Response (Failure - 503):**
```json
{
  "status": "error",
  "message": "Database connection failed"
}
```

**Usage**: Test endpoint before any operations
```bash
curl http://localhost:5000/health
```

---

## Attendance Endpoints

### Scan (Card Detection)

#### POST `/api/scan`

Process a card scan. Returns the next action needed.

**Request:**
```http
POST /api/scan HTTP/1.1
Host: localhost:5000
Content-Type: application/json

{
  "user_id": 12345,
  "timestamp": 1643370600
}
```

**Response (Clock-In with Signature):**
```json
{
  "action": "clock_in",
  "user_id": 12345,
  "name": "John Doe",
  "department": "Production",
  "message": "Please sign in"
}
```

**Response (Clock-Out with Points):**
```json
{
  "action": "clock_out",
  "user_id": 12345,
  "name": "John Doe",
  "points_earned": 8.5,
  "points_total": 127.5,
  "message": "Clocked out. Points updated"
}
```

**Response (Error):**
```json
{
  "status": "error",
  "message": "User not found",
  "user_id": 12345
}
```

**C Example (ImGui):**
```c
#include <curl/curl.h>

void scan_card(const char *user_id) {
    CURL *curl = curl_easy_init();
    if (curl) {
        char url[256];
        sprintf(url, "http://%s:5000/api/scan", API_SERVER_IP);
        
        char json[256];
        sprintf(json, "{\"user_id\": \"%s\"}", user_id);
        
        curl_easy_setopt(curl, CURLOPT_URL, url);
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json);
        curl_easy_setopt(curl, CURLOPT_TIMEOUT, 5L);
        
        CURLcode res = curl_easy_perform(curl);
        if (res != CURLE_OK) {
            fprintf(stderr, "API call failed: %s\n", curl_easy_strerror(res));
        }
        curl_cleanup(curl);
    }
}
```

---

### Clock-In with Signature

#### POST `/api/clock_in_with_signature`

Submit signature after card scan detected a clock-in.

**Request:**
```http
POST /api/clock_in_with_signature HTTP/1.1
Host: localhost:5000
Content-Type: application/json

{
  "user_id": 12345,
  "signature_svg": "M10,10 L20,20 L30,10...",
  "timestamp": 1643370600
}
```

**Response (Success - 200):**
```json
{
  "status": "success",
  "attendance_id": 5678,
  "user_id": 12345,
  "action": "clock_in_complete",
  "time_in": "2026-01-28T10:30:00Z",
  "message": "Clocked in successfully"
}
```

**Response (Signature rejected):**
```json
{
  "status": "error",
  "message": "Signature verification failed - too short or too unclear",
  "min_points": 10,
  "points_received": 5
}
```

**Signature Format**: SVG path data
```
M<start_x>,<start_y> L<x2>,<y2> L<x3>,<y3>...Z
Example: M10,10 L20,20 L30,30
```

---

### Attendance Records

#### GET `/api/attendance`

List all attendance records (paginated).

**Request:**
```http
GET /api/attendance?page=1&per_page=50&user_id=12345 HTTP/1.1
Host: localhost:5000
```

**Query Parameters:**
- `page` (int, default=1) - Page number
- `per_page` (int, default=50) - Records per page
- `user_id` (int, optional) - Filter by user
- `date_from` (ISO8601, optional) - Start date
- `date_to` (ISO8601, optional) - End date

**Response:**
```json
{
  "status": "success",
  "total": 1234,
  "page": 1,
  "per_page": 50,
  "records": [
    {
      "id": 5678,
      "user_id": 12345,
      "user_name": "John Doe",
      "time_in": "2026-01-28T08:00:00Z",
      "time_out": "2026-01-28T16:30:00Z",
      "hours_worked": 8.5,
      "signature_path": "/data/signatures/5678.svg",
      "status": "completed"
    },
    ...
  ]
}
```

---

#### GET `/api/attendance/<id>`

Get specific attendance record.

**Request:**
```http
GET /api/attendance/5678 HTTP/1.1
Host: localhost:5000
```

**Response:**
```json
{
  "status": "success",
  "record": {
    "id": 5678,
    "user_id": 12345,
    "user_name": "John Doe",
    "department": "Production",
    "time_in": "2026-01-28T08:00:00Z",
    "time_out": "2026-01-28T16:30:00Z",
    "hours_worked": 8.5,
    "signature_svg": "M10,10 L20,20...",
    "status": "completed",
    "created_at": "2026-01-28T08:00:05Z"
  }
}
```

---

## User Endpoints

### List Users

#### GET `/api/users`

Get all users.

**Request:**
```http
GET /api/users?active=true HTTP/1.1
Host: localhost:5000
```

**Query Parameters:**
- `active` (bool, default=true) - Filter by active status
- `department` (string, optional) - Filter by department

**Response:**
```json
{
  "status": "success",
  "total": 45,
  "users": [
    {
      "id": 12345,
      "name": "John Doe",
      "employee_id": "EMP001",
      "rfid_uid": "04:3A:B2:C1",
      "department": "Production",
      "role": "worker",
      "active": true,
      "created_at": "2025-06-15T09:00:00Z"
    },
    ...
  ]
}
```

---

### Get User

#### GET `/api/users/<id>`

Get specific user details.

**Request:**
```http
GET /api/users/12345 HTTP/1.1
Host: localhost:5000
```

**Response:**
```json
{
  "status": "success",
  "user": {
    "id": 12345,
    "name": "John Doe",
    "employee_id": "EMP001",
    "rfid_uid": "04:3A:B2:C1",
    "department": "Production",
    "role": "worker",
    "active": true,
    "points_total": 127.5,
    "points_this_month": 45.2,
    "hours_this_week": 40,
    "created_at": "2025-06-15T09:00:00Z",
    "last_scan": "2026-01-28T16:30:00Z"
  }
}
```

---

### Create User

#### POST `/api/users`

Add new user (requires admin credentials).

**Request:**
```http
POST /api/users HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "name": "Jane Smith",
  "employee_id": "EMP002",
  "rfid_uid": "08:4F:C3:D2",
  "department": "Sales",
  "role": "worker"
}
```

**Response (Success):**
```json
{
  "status": "success",
  "user_id": 12346,
  "message": "User created successfully"
}
```

---

### Update User

#### PUT `/api/users/<id>`

Update user information.

**Request:**
```http
PUT /api/users/12345 HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "name": "John D. Smith",
  "department": "Management",
  "active": true
}
```

**Response:**
```json
{
  "status": "success",
  "message": "User updated"
}
```

---

## Department Endpoints

### GET `/api/departments`

List all departments.

**Response:**
```json
{
  "status": "success",
  "departments": [
    {
      "id": 1,
      "name": "Production",
      "manager": "John Doe",
      "user_count": 12,
      "active": true
    },
    {
      "id": 2,
      "name": "Sales",
      "manager": "Jane Smith",
      "user_count": 8,
      "active": true
    }
  ]
}
```

---

## Products/Points Endpoints

### GET `/api/products`

List all products and point values.

**Response:**
```json
{
  "status": "success",
  "products": [
    {
      "id": 101,
      "name": "Standard Shift",
      "points_value": 8.5,
      "active": true
    },
    {
      "id": 102,
      "name": "Overtime (1.5x)",
      "points_value": 12.75,
      "active": true
    }
  ]
}
```

---

## Dashboard Endpoints

### GET `/api/dashboard/stats`

Get statistics for dashboard display.

**Response:**
```json
{
  "status": "success",
  "stats": {
    "today": {
      "clocks_in": 42,
      "clocks_out": 38,
      "pending_clock_out": 4,
      "points_earned": 356.5
    },
    "this_week": {
      "clocks_in": 210,
      "clocks_out": 200,
      "total_hours": 1600,
      "total_points": 1700
    },
    "users": {
      "active": 45,
      "inactive": 2,
      "total": 47
    }
  }
}
```

---

### GET `/api/dashboard/recent-scans`

Get recent card scans for live feed.

**Response:**
```json
{
  "status": "success",
  "scans": [
    {
      "timestamp": "2026-01-28T16:45:30Z",
      "user_name": "John Doe",
      "action": "clock_out",
      "rfid_uid": "04:3A:B2:C1"
    },
    ...
  ]
}
```

---

## Error Responses

All endpoints follow consistent error format:

```json
{
  "status": "error",
  "code": "USER_NOT_FOUND",
  "message": "User with ID 99999 does not exist",
  "timestamp": "2026-01-28T10:30:00Z"
}
```

**Common Error Codes:**

| Code | HTTP | Meaning |
|------|------|---------|
| `INVALID_REQUEST` | 400 | Missing or malformed fields |
| `UNAUTHORIZED` | 401 | Authentication failed |
| `FORBIDDEN` | 403 | Access denied (permission issue) |
| `NOT_FOUND` | 404 | Resource not found |
| `DATABASE_ERROR` | 500 | Database operation failed |
| `SERVICE_UNAVAILABLE` | 503 | Backend service down |

---

## Authentication

**Status**: Currently not implemented in v1.5.2

**Future**: Admin endpoints will require bearer token:
```http
Authorization: Bearer <jwt_token>
```

---

## Testing Endpoints

### With curl

```bash
# Health check
curl http://localhost:5000/health

# Scan a card
curl -X POST http://localhost:5000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"user_id": 12345, "timestamp": 1643370600}'

# Get all users
curl http://localhost:5000/api/users

# Get specific user
curl http://localhost:5000/api/users/12345

# Get attendance records
curl "http://localhost:5000/api/attendance?page=1&per_page=10"
```

### With Python

```python
import requests

# Health check
resp = requests.get('http://localhost:5000/health')
print(resp.json())

# Scan card
data = {'user_id': 12345, 'timestamp': 1643370600}
resp = requests.post('http://localhost:5000/api/scan', json=data)
print(resp.json())

# Get user
resp = requests.get('http://localhost:5000/api/users/12345')
user = resp.json()
print(f"User: {user['user']['name']}")
```

### With JavaScript

```javascript
// Health check
fetch('http://localhost:5000/health')
  .then(r => r.json())
  .then(data => console.log(data));

// Scan card
fetch('http://localhost:5000/api/scan', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({user_id: 12345, timestamp: 1643370600})
})
.then(r => r.json())
.then(data => console.log(data));

// Get user
fetch('http://localhost:5000/api/users/12345')
  .then(r => r.json())
  .then(user => console.log(`User: ${user.user.name}`));
```

---

## Rate Limiting

**Not currently implemented**

Recommended limits for production:
- 100 requests per minute per IP
- 1000 requests per minute total

---

## Versioning

Current API Version: **1.5.2**

Version is returned in health check response. The API maintains backward compatibility within major versions.

---

## See Also

- [BACKEND_SETUP.md](BACKEND_SETUP.md) - Backend deployment and Docker
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Database table definitions
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md#api-issues) - API troubleshooting

---

**Last Updated**: January 28, 2026
