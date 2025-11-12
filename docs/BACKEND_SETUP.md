# Backend Setup Guide

> Complete guide for setting up and configuring the Flask API and PostgreSQL database.

---

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Manual Setup](#manual-setup)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Database Management](#database-management)
- [Troubleshooting](#troubleshooting)

---

## Overview

The backend consists of:
- **Flask API** (`app.py`) - RESTful endpoints for device communication
- **PostgreSQL Database** - Persistent data storage
- **Docker Environment** - Containerized deployment

**Directory Structure**:
```
Database & Dashboard/
├── api/
│   ├── app.py              # Main Flask application
│   ├── Dockerfile          # API container definition
│   └── requirements.txt    # Python dependencies
├── web/                    # Dashboard frontend files
├── docker-compose.yml      # Multi-container orchestration
└── init.sql               # Database initialization script
```

---

## Prerequisites

### Required Software
- **Docker**: Version 20.10+
- **Docker Compose**: Version 1.29+
- **Python**: 3.8+ (for local development)
- **PostgreSQL**: 13+ (if not using Docker)

### System Requirements
- **RAM**: 4GB minimum
- **Storage**: 10GB free space
- **Network**: Internet access for image downloads

---

## Quick Start

### Using Docker Compose (Recommended)

1. **Navigate to backend directory**:
   ```bash
   cd "Product/Database & Dashboard/"
   ```

2. **Start all services**:
   ```bash
   docker-compose up -d
   ```

3. **Verify services are running**:
   ```bash
   docker-compose ps
   ```
   
   Expected output:
   ```
   NAME                COMMAND             STATUS              PORTS
   attendance-api      python app.py       Up                  0.0.0.0:5000->5000/tcp
   attendance-db       postgres            Up                  0.0.0.0:5432->5432/tcp
   ```

4. **Check API health**:
   ```bash
   curl http://localhost:5000/api/health
   ```
   
   Expected response:
   ```json
   {
     "status": "healthy",
     "database": "connected",
     "timestamp": "2024-11-12T14:30:00Z"
   }
   ```

5. **Access dashboard**:
   Open browser to `http://localhost:5000`

---

## Manual Setup

### Step 1: Database Setup

**Install PostgreSQL**:
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# macOS
brew install postgresql
```

**Create database and user**:
```bash
sudo -u postgres psql

CREATE DATABASE attendance_db;
CREATE USER attendance_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE attendance_db TO attendance_user;
\q
```

**Initialize schema**:
```bash
psql -U attendance_user -d attendance_db -f init.sql
```

---

### Step 2: API Setup

**Clone repository** (if not already done):
```bash
git clone <repository-url>
cd "Product/Database & Dashboard/api"
```

**Create virtual environment**:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

**Install dependencies**:
```bash
pip install -r requirements.txt
```

**Configure environment variables**:
```bash
export DATABASE_URL="postgresql://attendance_user:secure_password@localhost:5432/attendance_db"
export FLASK_ENV="development"
export API_PORT="5000"
```

**Run the API**:
```bash
python app.py
```

API should now be running on `http://localhost:5000`

---

## Configuration

### Environment Variables

Create a `.env` file in the `api/` directory:

```env
# Database Configuration
DATABASE_URL=postgresql://attendance_user:password@db:5432/attendance_db
POSTGRES_USER=attendance_user
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=attendance_db

# Flask Configuration
FLASK_ENV=production
FLASK_DEBUG=False
API_PORT=5000
SECRET_KEY=your_secret_key_here

# Optional: CORS settings
CORS_ORIGINS=*

# Optional: Logging
LOG_LEVEL=INFO
LOG_FILE=/var/log/attendance/api.log
```

### Docker Compose Configuration

Edit `docker-compose.yml` for custom settings:

```yaml
version: '3.8'

services:
  db:
    image: postgres:13
    container_name: attendance-db
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    networks:
      - attendance-network

  api:
    build: ./api
    container_name: attendance-api
    environment:
      DATABASE_URL: ${DATABASE_URL}
      FLASK_ENV: ${FLASK_ENV}
    ports:
      - "5000:5000"
    depends_on:
      - db
    networks:
      - attendance-network
    volumes:
      - ./web:/app/web

volumes:
  postgres_data:

networks:
  attendance-network:
    driver: bridge
```

---

## API Endpoints

### Health Check
```http
GET /api/health
```

**Response**:
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2024-11-12T14:30:00Z"
}
```

---

### Clock In
```http
POST /api/checkin
Content-Type: application/json

{
  "rfid_uid": "A1:B2:C3:D4",
  "timestamp": "2024-11-12T09:00:00Z",
  "device_id": "STM32_001"
}
```

**Success Response** (200):
```json
{
  "status": "success",
  "user": {
    "id": 42,
    "name": "John Doe",
    "employee_id": "EMP123"
  },
  "attendance_id": 1001,
  "message": "Clocked in successfully"
}
```

**Error Response** (400):
```json
{
  "status": "error",
  "message": "User already clocked in",
  "code": "ALREADY_CLOCKED_IN"
}
```

---

### Clock Out
```http
POST /api/checkout
Content-Type: application/json

{
  "rfid_uid": "A1:B2:C3:D4",
  "timestamp": "2024-11-12T17:30:00Z",
  "device_id": "STM32_001"
}
```

**Success Response** (200):
```json
{
  "status": "success",
  "attendance_id": 1001,
  "duration": "8h 30m",
  "message": "Clocked out successfully"
}
```

---

### Upload Signature
```http
POST /api/signature
Content-Type: application/json

{
  "attendance_id": 1001,
  "signature_data": "iVBORw0KGgoAAAANS...",
  "format": "png"
}
```

**Success Response** (200):
```json
{
  "status": "success",
  "signature_id": 501
}
```

---

### Get Attendance Records
```http
GET /api/attendance?start_date=2024-11-01&end_date=2024-11-30&user_id=42
```

**Response**:
```json
{
  "status": "success",
  "records": [
    {
      "id": 1001,
      "user_id": 42,
      "user_name": "John Doe",
      "clock_in": "2024-11-12T09:00:00Z",
      "clock_out": "2024-11-12T17:30:00Z",
      "duration": "8h 30m",
      "has_signature": true
    }
  ],
  "total": 1
}
```

[→ Complete API Reference](API.md)

---

## Database Management

### Backup Database

```bash
# Using Docker
docker exec attendance-db pg_dump -U attendance_user attendance_db > backup.sql

# Without Docker
pg_dump -U attendance_user attendance_db > backup.sql
```

### Restore Database

```bash
# Using Docker
docker exec -i attendance-db psql -U attendance_user attendance_db < backup.sql

# Without Docker
psql -U attendance_user attendance_db < backup.sql
```

### View Database Logs

```bash
docker logs attendance-db
```

### Connect to Database

```bash
# Using Docker
docker exec -it attendance-db psql -U attendance_user attendance_db

# Without Docker
psql -U attendance_user attendance_db
```

### Common Queries

**View all users**:
```sql
SELECT * FROM users;
```

**View recent attendance**:
```sql
SELECT u.name, a.clock_in, a.clock_out 
FROM attendance a
JOIN users u ON a.user_id = u.id
ORDER BY a.clock_in DESC
LIMIT 10;
```

**Count attendance by user**:
```sql
SELECT u.name, COUNT(*) as total_days
FROM attendance a
JOIN users u ON a.user_id = u.id
GROUP BY u.name
ORDER BY total_days DESC;
```

[→ Database Schema Documentation](DATABASE_SCHEMA.md)

---

## Troubleshooting

### Issue: API won't start

**Error**: `Connection refused to database`

**Solution**:
```bash
# Check if database is running
docker-compose ps

# View database logs
docker logs attendance-db

# Restart services
docker-compose restart
```

---

### Issue: Database connection timeout

**Error**: `psycopg2.OperationalError: timeout expired`

**Solution**:
1. Check `DATABASE_URL` in `.env`
2. Verify database is accepting connections:
   ```bash
   docker exec attendance-db pg_isready
   ```
3. Check firewall rules (port 5432)

---

### Issue: Port already in use

**Error**: `Bind for 0.0.0.0:5000 failed: port is already allocated`

**Solution**:
```bash
# Find process using port
lsof -i :5000

# Kill process or change port in docker-compose.yml
ports:
  - "5001:5000"  # Use different external port
```

---

### Issue: Permission denied on init.sql

**Error**: `Permission denied while trying to read init.sql`

**Solution**:
```bash
chmod 644 init.sql
```

---

### Issue: Slow query performance

**Solution**:
```sql
-- Create indexes
CREATE INDEX idx_attendance_user_id ON attendance(user_id);
CREATE INDEX idx_attendance_clock_in ON attendance(clock_in);
CREATE INDEX idx_users_rfid_uid ON users(rfid_uid);
```

---

## Development Tips

### Hot Reload for API

For development, enable Flask debug mode:
```bash
export FLASK_ENV=development
export FLASK_DEBUG=True
python app.py
```

### View API Logs

```bash
# Docker logs
docker logs -f attendance-api

# Log to file
python app.py > api.log 2>&1
```

### Test Endpoints

Using `curl`:
```bash
# Test health
curl http://localhost:5000/api/health

# Test clock-in
curl -X POST http://localhost:5000/api/checkin \
  -H "Content-Type: application/json" \
  -d '{"rfid_uid":"A1:B2:C3:D4","timestamp":"2024-11-12T09:00:00Z"}'
```

Using Python:
```python
import requests

response = requests.post('http://localhost:5000/api/checkin', json={
    'rfid_uid': 'A1:B2:C3:D4',
    'timestamp': '2024-11-12T09:00:00Z'
})

print(response.json())
```

---

## Production Deployment

### Security Checklist
- [ ] Change default database password
- [ ] Use strong `SECRET_KEY`
- [ ] Enable SSL/TLS (HTTPS)
- [ ] Set `FLASK_ENV=production`
- [ ] Disable debug mode
- [ ] Implement rate limiting
- [ ] Set up firewall rules
- [ ] Regular database backups
- [ ] Monitor logs for errors

### Performance Optimization
- Use Gunicorn instead of Flask dev server
- Set up Nginx reverse proxy
- Enable database connection pooling
- Implement caching (Redis)
- Set up load balancing for multiple devices

---

## Related Documentation

- [Architecture Overview](ARCHITECTURE.md)
- [API Reference](API.md)
- [Database Schema](DATABASE_SCHEMA.md)
- [Dashboard Guide](DASHBOARD.md)
- [Troubleshooting Guide](TROUBLESHOOTING.md)

---

**Last Updated**: November 2024