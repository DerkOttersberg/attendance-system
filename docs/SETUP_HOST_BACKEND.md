# Host Setup: Backend Services (Flask + MySQL)

> **Location**: On your laptop/server (NOT on the STM32)

---

## Overview

The backend consists of:
- **Flask API** - Handles attendance logic and device communication
- **MySQL Database** - Stores user data, attendance records, and scan logs
- **Web Dashboard** - Administrative interface for managing attendance
- **Docker Compose** - Orchestrates all services in containers

This guide covers running the backend on your development machine or production server.

### Prerequisites

- Docker & Docker Compose installed
  - See [SETUP_HOST_PREREQUISITES.md](SETUP_HOST_PREREQUISITES.md)
- Port 5000 available (Flask API)
- Port 3306 available (MySQL)
- Port 8080 available (Dashboard)
- 2 GB disk space minimum

---

## Quick Start (10 minutes)

### Step 1: Navigate to Backend Directory

```bash
cd "product/Database & Dashbaord/releases/v1.5.2/My website"

# Or (with correct spacing):
cd product/Database\ \&\ Dashbaord/releases/v1.5.2/My\ website
```

### Step 2: Start Services

```bash
# Start all services in background:
docker-compose up -d

# Watch startup progress:
docker-compose logs -f

# When you see "MySQL ready", press Ctrl+C to exit logs view
```

**Expected Output:**
```
Creating network "my website_default" with the default driver
Creating mysql ... done
Creating api ... done
Creating web ... done
```

### Step 3: Verify Services Are Running

```bash
# Check container status:
docker-compose ps

# Expected output:
# NAME          STATUS
# mysql         Up 2 minutes (healthy)
# api           Up 1 minute
# web           Up 1 minute
```

### Step 4: Test Backend Connectivity

```bash
# Test API health check:
curl http://localhost:5000/health

# Expected response:
# {"status": "ok"}

# Test database connection:
curl http://localhost:5000/api/users

# Expected: JSON list of users (may be empty initially)
```

### Step 5: Access Dashboard

Open your browser and navigate to:

```
http://localhost:8080
```

**Expected**: Web dashboard loads showing:
- Live statistics (users, clocked in/out today)
- Attendance list (empty initially)
- User management interface
- Reports & export options

### Step 6: Verify on STM32 Board

On your STM32 device, test connectivity to backend:

```bash
ssh root@<stm32-ip>

# Test connection (replace <backend-ip> with your server IP):
curl http://<backend-ip>:5000/health

# Expected:
# {"status": "ok"}
```

✅ **Success**: Backend is running and accessible!

---

## Detailed Configuration

### Docker Compose Structure

**File**: `docker-compose.yml`

The compose file defines three services:

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: mysql
    environment:
      MYSQL_ROOT_PASSWORD: root_password
      MYSQL_DATABASE: rfid_attendance
      MYSQL_USER: rfid_user
      MYSQL_PASSWORD: rfid_pass
    ports:
      - "3306:3306"
    volumes:
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
      - mysql_data:/var/lib/mysql

  api:
    build: ./api
    container_name: api
    environment:
      DB_HOST: mysql
      DB_USER: rfid_user
      DB_PASSWORD: rfid_pass
      DB_NAME: rfid_attendance
    ports:
      - "5000:5000"
    depends_on:
      - mysql

  web:
    image: nginx:latest
    container_name: web
    ports:
      - "8080:80"
    volumes:
      - ./web:/usr/share/nginx/html
    depends_on:
      - api
```

### Service Details

#### MySQL Database

| Property | Value |
|----------|-------|
| **Container** | mysql |
| **Port** | 3306 (internal), 3306 (external) |
| **Username** | rfid_user |
| **Password** | rfid_pass |
| **Database** | rfid_attendance |
| **Initial Schema** | `init.sql` |
| **Data Volume** | `mysql_data` (persistent) |

**Access database from your laptop:**
```bash
# Connect with MySQL client:
mysql -h localhost -u rfid_user -p

# Password: rfid_pass
# Then: use rfid_attendance;
# show tables;
```

#### Flask API

| Property | Value |
|----------|-------|
| **Container** | api |
| **Port** | 5000 |
| **Framework** | Flask |
| **Language** | Python 3.8+ |
| **Dockerfile** | `api/Dockerfile` |
| **Source** | `api/app.py` |
| **Dependencies** | `api/requirements.txt` |

**API Endpoints** (all POST):
- `/health` - Server health check
- `/api/scan` - Process RFID scan
- `/api/clock_in_with_signature` - Clock in with signature
- `/api/attendance/*` - Attendance management
- `/api/users/*` - User management
- `/api/departments/*` - Department management
- `/api/products/*` - Product management

See [API.md](API.md) for full reference.

#### Web Dashboard

| Property | Value |
|----------|-------|
| **Container** | web |
| **Port** | 8080 |
| **Server** | Nginx |
| **Files** | `web/` directory |
| **Entry Point** | `web/dashboard.html` |
| **Technology** | HTML5 + JavaScript |

**Features**:
- Real-time attendance view
- User management
- Reports & PDF export
- Manual attendance entry

---

## Service Management

### View Container Status

```bash
# All containers:
docker-compose ps

# With more details:
docker-compose ps -a

# With resource usage:
docker stats
```

### View Logs

```bash
# API logs:
docker-compose logs api

# MySQL logs:
docker-compose logs mysql

# Web server logs:
docker-compose logs web

# All logs (real-time):
docker-compose logs -f

# Last 50 lines:
docker-compose logs --tail=50
```

### Stop Services

```bash
# Stop all services (containers still exist):
docker-compose stop

# Stop specific service:
docker-compose stop api

# Wait for graceful shutdown (30 seconds):
docker-compose stop --timeout=30
```

### Start Services

```bash
# Start all services:
docker-compose start

# Start specific service:
docker-compose start api
```

### Restart Services

```bash
# Restart all:
docker-compose restart

# Restart specific:
docker-compose restart api

# Useful after code changes:
# Rebuild and restart:
docker-compose up -d --build
```

### Remove All Data

```bash
# Stop and remove containers:
docker-compose down

# Also remove volumes (DATABASE WILL BE DELETED):
docker-compose down -v

# WARNING: This deletes all attendance data!
```

---

## Database Management

### Access MySQL Terminal

```bash
# Connect to running MySQL container:
docker-compose exec mysql mysql -u rfid_user -p rfid_attendance

# Password: rfid_pass

# Then you can run SQL:
> SELECT * FROM users;
> SELECT * FROM attendance;
> .quit  # Exit
```

### Backup Database

```bash
# Backup to file:
docker-compose exec -T mysql mysqldump \
  -u rfid_user -p rfid_attendance \
  > backup_$(date +%Y%m%d_%H%M%S).sql

# Password will be prompted (rfid_pass)

# Or with password in command:
docker-compose exec -T mysql mysqldump \
  -u rfid_user -prfid_pass rfid_attendance \
  > backup.sql
```

### Restore Database

```bash
# Restore from backup:
docker-compose exec -T mysql mysql \
  -u rfid_user -prfid_pass rfid_attendance \
  < backup.sql
```

### View Database Schema

```bash
# Connect to MySQL:
docker-compose exec mysql mysql -u rfid_user -p rfid_attendance

# Show tables:
> SHOW TABLES;

# Show table structure:
> DESC users;
> DESC attendance;
> DESC scan_log;

# Show number of records:
> SELECT COUNT(*) FROM users;
> SELECT COUNT(*) FROM attendance;
> SELECT COUNT(*) FROM scan_log;
```

---

## API Testing

### Health Check

```bash
curl http://localhost:5000/health

# Expected: {"status": "ok"}
```

### Scan Processing

```bash
curl -X POST http://localhost:5000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"uid": "A1B2C3D4"}'

# Expected: {"action": "clock_in", "user_id": 1, ...}
```

### Clock In with Signature

```bash
curl -X POST http://localhost:5000/api/clock_in_with_signature \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "A1B2C3D4",
    "signature_svg": "<svg>...</svg>",
    "timestamp": "2024-01-28T10:30:00"
  }'

# Expected: {"status": "success", "attendance_id": 123}
```

### List Users

```bash
curl http://localhost:5000/api/users

# Expected: [{"id": 1, "name": "John", ...}, ...]
```

---

## Configuration & Customization

### Change Database Credentials

**Edit**: `docker-compose.yml`

```yaml
environment:
  MYSQL_USER: your_username        # Change from rfid_user
  MYSQL_PASSWORD: your_password    # Change from rfid_pass
  DB_USER: your_username
  DB_PASSWORD: your_password
```

Then:
```bash
# Rebuild and restart:
docker-compose down -v
docker-compose up -d
```

### Change API Port

**Edit**: `docker-compose.yml`

```yaml
api:
  ports:
    - "5000:5000"  # Change first number (external)
    # Example: "8000:5000"  # Access via http://localhost:8000
```

Then:
```bash
docker-compose restart api
```

### Change Dashboard Port

**Edit**: `docker-compose.yml`

```yaml
web:
  ports:
    - "8080:80"  # Change first number (external)
    # Example: "3000:80"  # Access via http://localhost:3000
```

Then:
```bash
docker-compose restart web
```

### Enable API Logging

**Edit**: `api/app.py`

```python
# Add before app = Flask(__name__):
import logging
logging.basicConfig(level=logging.DEBUG)
```

Then rebuild:
```bash
docker-compose up -d --build api
docker-compose logs -f api
```

---

## Troubleshooting

### Services Won't Start

**Check Docker daemon:**
```bash
docker ps  # Should work without error
docker-compose --version
```

**Check logs for errors:**
```bash
docker-compose up  # Run without -d to see output
# Look for specific error messages
```

### MySQL Connection Refused

**Symptom**: `api` container can't connect to `mysql`

**Check 1 - Is MySQL running:**
```bash
docker-compose ps mysql
# Should show "Up" status
```

**Check 2 - Wait for MySQL to fully initialize:**
```bash
# MySQL takes 10-15 seconds to start
docker-compose logs mysql | tail -20

# Look for "Server is ready for connections"
```

**Check 3 - Restart both services:**
```bash
docker-compose restart mysql api
sleep 10
curl http://localhost:5000/health
```

### Port Already in Use

**Symptom**: `bind: address already in use`

**Solution 1 - Find what's using the port:**
```bash
# Windows:
netstat -ano | findstr :5000

# macOS/Linux:
lsof -i :5000
```

**Solution 2 - Kill the process:**
```bash
# macOS/Linux:
kill -9 <PID>

# Or change port in docker-compose.yml:
# ports:
#   - "5001:5000"  # Use 5001 instead of 5000
```

### Dashboard Not Loading

**Check 1 - Web container running:**
```bash
docker-compose ps web
# Should show "Up"
```

**Check 2 - Verify nginx config:**
```bash
docker-compose logs web | tail -20
```

**Check 3 - Check file permissions:**
```bash
# Verify web files exist:
ls -la web/

# Should show dashboard.html, js/, css/
```

### API Returning Errors

**Check logs:**
```bash
docker-compose logs api

# Common errors:
# - "ModuleNotFoundError": Missing Python package
# - "Connection refused": Database not ready
# - "404 Not Found": Wrong endpoint
```

**Rebuild container:**
```bash
docker-compose up -d --build api
docker-compose logs -f api
```

### Slow Performance

**Check resource usage:**
```bash
docker stats

# If MySQL using high CPU:
# - Rebuild database: docker-compose down -v && up -d
# - Check for long-running queries
```

**Increase memory limit** (edit `docker-compose.yml`):
```yaml
services:
  mysql:
    mem_limit: 2g        # Limit to 2GB
    memswap_limit: 2g
```

---

## Production Considerations

### Database Persistence

By default, MySQL data is stored in a Docker volume:
```bash
docker volume ls | grep mysql

# Data persists even if container is stopped
```

### Backup Strategy

```bash
# Daily automated backup:
# Create backup script:
cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/attendance-db"
mkdir -p $BACKUP_DIR
docker-compose exec -T mysql mysqldump \
  -u rfid_user -prfid_pass rfid_attendance \
  > $BACKUP_DIR/backup_$(date +\%Y\%m\%d_\%H\%M\%S).sql
# Keep only last 30 days
find $BACKUP_DIR -mtime +30 -delete
EOF

chmod +x backup.sh

# Add to crontab for daily 2 AM backup:
# 0 2 * * * /path/to/backup.sh
```

### SSL/HTTPS Setup

For production, enable HTTPS:

```bash
# Install certbot:
sudo apt install certbot python3-certbot-nginx

# Get certificate:
sudo certbot certonly --standalone -d your-domain.com

# Update nginx config to use certificate
# Edit: web/nginx.conf (need to create custom config)
```

### Environment Variables

For sensitive data (passwords), use `.env` file:

```bash
# Create .env file:
cat > .env << 'EOF'
MYSQL_ROOT_PASSWORD=secure_root_pwd
MYSQL_PASSWORD=secure_rfid_pwd
DB_PASSWORD=secure_rfid_pwd
EOF

# Update docker-compose.yml to reference:
# env_file: .env
```

### Resource Limits

**Edit**: `docker-compose.yml`

```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

---

## Monitoring

### View Real-Time Metrics

```bash
# CPU, memory, network usage:
docker stats

# Or with name filter:
docker stats --no-stream mysql api web
```

### Long-Running Database Queries

```bash
# Connect to MySQL and find slow queries:
docker-compose exec mysql mysql -u rfid_user -p rfid_attendance

> SHOW PROCESSLIST;  # Current running queries
> SHOW VARIABLES LIKE 'slow_query%';  # Check slow query log settings
```

### API Request Logging

```bash
# View API logs with timestamps:
docker-compose logs --timestamps api

# Filter for specific time period:
docker-compose logs --since 2024-01-28T10:00:00 api
```

---

## Next Steps

1. **Deploy to STM32:**
   - See [SETUP_HOST_DEPLOY.md](SETUP_HOST_DEPLOY.md)

2. **Configure STM32 to use your backend:**
   - Update API_BASE_URL in ImGui code
   - Rebuild and deploy

3. **Test complete system:**
   - Scan RFID card
   - Verify dashboard updates
   - Check database records

4. **Set up production deployment:**
   - Configure firewall rules
   - Set up SSL/HTTPS
   - Create backup strategy

---

## Related Documentation

- [SETUP_HOST_PREREQUISITES.md](SETUP_HOST_PREREQUISITES.md) - Installation
- [SETUP_HOST_BUILD_GUI.md](SETUP_HOST_BUILD_GUI.md) - Building ImGui
- [SETUP_HOST_DEPLOY.md](SETUP_HOST_DEPLOY.md) - Deployment to STM32
- [API.md](API.md) - API reference
- [DATABASE.md](DATABASE.md) - Database schema
- [DASHBOARD.md](DASHBOARD.md) - Dashboard guide

---

**Last Updated**: January 28, 2026
