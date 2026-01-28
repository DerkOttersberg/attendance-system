# Dashboard & Web UI

> Administrative interface for attendance monitoring and reporting

---

## Overview

The web dashboard is a static HTML/CSS/JavaScript interface served by **Nginx** on the backend server. It connects to the Flask API to display real-time attendance data, user management, and analytics.

**Access**: `http://localhost:8080` (or `http://<server-ip>:8080`)

**Location**: [product/Database & Dashbaord/releases/v1.5.2/web](../product/Database%20%26%20Dashbaord/releases/v1.5.2/web)

**Architecture**:
- **Frontend**: HTML/CSS/JavaScript (single-page app)
- **Web Server**: Nginx
- **Backend API**: Flask (`localhost:5000`)
- **Database**: MySQL (queried via Flask)

---

## Features

### Real-Time Monitoring

#### Active Employees
- List of currently clocked-in employees
- Time elapsed since clock-in
- Departments and roles
- Live updates every 10 seconds

#### Recent Scans
- Card scan log (last 50 scans)
- Timestamp, user name, action (clock-in/out)
- Unknown/unregistered cards highlighted
- Auto-refresh every 5 seconds

#### Daily Statistics
- Total clock-ins today
- Total clock-outs today
- Pending clock-outs (still working)
- Total hours worked
- Total points earned

### Employee Management

- Search by name or employee ID
- Filter by department
- View/edit employee details
- RFID card assignment
- Active/inactive status management

### Reporting

- Daily attendance reports
- Weekly summary (hours & points)
- Monthly trends
- Department analytics
- CSV/PDF export

---

## File Structure

Located at: [product/Database & Dashbaord/releases/v1.5.2/web/](../product/Database%20%26%20Dashbaord/releases/v1.5.2/web/)

```
web/
├── dashboard.html       # Main page
├── css/
│   ├── style.css       # Main stylesheet
│   ├── dashboard.css   # Dashboard specific
│   └── responsive.css  # Mobile responsive
├── js/
│   ├── app.js          # Main app logic
│   ├── api.js          # API communication
│   ├── config.js       # Configuration (API URL)
│   ├── ui.js           # Rendering
│   ├── filters.js      # Filtering & manual entry
│   ├── charts.js       # Chart rendering
│   └── export.js       # PDF/CSV export
├── images/
│   ├── logo.png
│   └── icons/          # UI icons
└── data/
    └── sample.json     # Sample data for testing
```

---

## Configuration

### API Connection

File: `js/config.js`

```javascript
// Configure API server IP
const API_SERVER = 'localhost';  // Change to server IP
const API_PORT = 5000;
const API_BASE_URL = `http://${API_SERVER}:${API_PORT}`;

// Dashboard display settings
const DASHBOARD = {
  refresh_interval: 10000,  // 10 seconds for statistics
  scan_log_size: 50,        // Show last 50 scans
  active_users_limit: 100   // Show max 100 active users
};
```

### Nginx Configuration

File: [docker-compose.yml](../product/Database%20%26%20Dashbaord/releases/v1.5.2/docker-compose.yml)

```yaml
web:
  image: nginx:latest
  ports:
    - "8080:80"
  volumes:
    - ./web:/usr/share/nginx/html:ro
  depends_on:
    - api
```

---

## Usage

### Accessing the Dashboard

**On your laptop/development machine:**
```
http://localhost:8080
```

**From another device** (replace IP with your server's IP):
```
http://192.168.1.100:8080
```

**From STM32 device** (on-device browser):
```bash
# Via command line on STM32:
DISPLAY=:0 firefox http://localhost:8080
```

---

### Main Views

#### Dashboard (Home)

Shows overall attendance statistics:
- Cards clocked in today
- Cards clocked out today
- Pending clock-outs
- Total hours worked today
- Total points earned today

---

#### Active Employees

Live list of currently clocked-in employees:
- Name and employee ID
- Department and role
- Clock-in time
- Time elapsed (updated in real-time)

---

#### Scan Log

Real-time feed of all card scans:

| Time | User | Card UID | Action | Status |
|------|------|----------|--------|--------|
| 16:47 | John Doe | 04:3A:B2:C1 | Clock-in | ✓ Success |
| 16:45 | Jane Smith | 08:4F:C3:D2 | Clock-out | ✓ Success |
| 16:43 | Unknown | FF:FF:FF:FF | Scan | Not registered |

Click unknown cards to register new user.

---

#### Employee Directory

Search and manage employees:
- Search by name or employee ID
- Filter by department
- View employee details:
  - Full name, employee ID, department
  - RFID card UID
  - Points earned this month
  - Hours worked this week
  - Last scan time
  - Active/inactive status

---

#### Reports

**Daily Report:**
- Select date
- View all attendance for that day
- Sort by employee or department
- Export as CSV

**Weekly Report:**
- Select week
- Summary hours and points per employee
- Department comparison
- Export as PDF

**Monthly Report:**
- Select month
- Year-to-date comparison
- Trend analysis
- Export for accounting

---

## API Integration

The dashboard communicates with Flask API endpoints. See [API_REFERENCE.md](API_REFERENCE.md) for complete endpoint documentation.

**Key endpoints used by dashboard:**

```javascript
// Get statistics
GET /api/dashboard/stats

// Get active employees
GET /api/attendance?status=clocked_in

// Get recent scans
GET /api/dashboard/recent-scans

// Get all users
GET /api/users

// Get specific user
GET /api/users/<id>

// Get attendance records
GET /api/attendance?page=1&per_page=50
```

---

## Data Refresh

Dashboard updates automatically:
- **Statistics**: Every 10 seconds
- **Scan log**: Every 5 seconds
- **Active users**: Every 10 seconds

Configure refresh rates in `js/config.js`:

```javascript
const REFRESH_INTERVALS = {
  stats: 10000,        // 10 seconds
  scanLog: 5000,       // 5 seconds
  activeUsers: 10000   // 10 seconds
};
```

---

## Customization

### Change API Server

Edit `js/config.js`:

```javascript
// OLD:
const API_SERVER = 'localhost';

// NEW (for remote server):
const API_SERVER = '192.168.1.50';

// Or with domain:
const API_SERVER = 'api.company.com';
```

Restart dashboard:
```bash
docker-compose up -d web
```

### Change Dashboard Port

Edit [docker-compose.yml](../product/Database%20%26%20Dashbaord/releases/v1.5.2/docker-compose.yml):

```yaml
web:
  ports:
    - "8888:80"  # Use port 8888 instead of 8080
```

```bash
docker-compose up -d
# Access at: http://localhost:8888
```

### Change Refresh Rate

Edit `js/app.js` - reduce for slower connections, increase for real-time:

```javascript
// Slower (save bandwidth):
const REFRESH_INTERVAL = 30000;  // 30 seconds

// Faster (real-time):
const REFRESH_INTERVAL = 5000;   // 5 seconds
```

---

## Troubleshooting

### Dashboard Won't Load

**Check web server:**
```bash
docker-compose ps web
# Should show "Up" status

docker-compose logs web
# Look for error messages
```

**Test web server directly:**
```bash
curl http://localhost:8080
# Should return HTML content
```

---

### API Connection Error

**Dashboard shows: "Cannot connect to API"**

**Check API is running:**
```bash
curl http://localhost:5000/health
# Should return JSON response
```

**Verify API URL in config:**
```bash
cat js/config.js | grep API_SERVER
# Should match your API server IP
```

**Update configuration and restart:**
```bash
nano js/config.js
# Change API_SERVER IP
docker-compose up -d web
```

---

### Slow/Unresponsive Dashboard

**Increase refresh interval** in `js/config.js`:
```javascript
// Change from 5 seconds to 30 seconds
const REFRESH_INTERVAL = 30000;
```

**Check network latency:**
```bash
# From laptop:
ping <server-ip>

# Check API response time:
curl -w "Time: %{time_total}s\n" http://localhost:5000/health
```

---

### Missing Charts or Data

**Check browser console** (F12 → Console tab):
- JavaScript errors
- API call failures
- CORS issues (if dashboard and API on different servers)

**Enable CORS** if needed in `api/app.py`:
```python
from flask_cors import CORS
CORS(app)
```

---

## Security

### Current (v1.5.2)

- **No authentication** - Dashboard is public
- **No password protection** - Anyone with network access can view

### Security Recommendations

1. **Run on private network** - Don't expose to internet
2. **Use firewall** - Restrict access by IP
3. **HTTPS only** - Use reverse proxy with SSL
4. **Authentication layer** - Add admin login
5. **Rate limiting** - Prevent DoS attacks

---

## Performance

Dashboard can handle:
- 50+ simultaneous users
- 100+ scan log entries per second
- 30-day attendance records for 100+ employees

**Optimization:**
- Reduce refresh rate if many concurrent users
- Limit scan log size (show 20 instead of 50)
- Paginate reports (50 rows per page)
- Add API response caching

---

## Kiosk Mode (Full-Screen)

Display dashboard on monitor for all-day viewing:

```bash
# Run in full-screen kiosk mode
DISPLAY=:0 firefox \
  --kiosk \
  http://localhost:8080

# Or with auto-start (add to systemd service):
ExecStart=/usr/bin/firefox --kiosk http://localhost:8080
```

---

## Export & Reporting

### CSV Export

```bash
# Download daily report
curl "http://localhost:8080/api/attendance?date=2026-01-28&format=csv" \
  > attendance_2026-01-28.csv
```

### PDF Export

```bash
# Generate PDF report
curl "http://localhost:8080/api/reports/weekly?format=pdf" \
  > weekly_report.pdf
```

---

## Data Visualization

### Chart Types Supported

- **Bar charts** - Hours worked per day
- **Pie charts** - Points distribution by department
- **Time series** - Attendance trends
- **Heat maps** - Peak hours analysis

All charts update in real-time as data changes.

---

## See Also

- [API_REFERENCE.md](API_REFERENCE.md) - API endpoints
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Database structure
- [BACKEND_SETUP.md](BACKEND_SETUP.md) - Backend deployment
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Troubleshooting

---

**Last Updated**: January 28, 2026
