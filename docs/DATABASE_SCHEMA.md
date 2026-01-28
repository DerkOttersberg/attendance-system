# Database Schema

> Complete MySQL database structure for attendance system

---

## Overview

The MySQL database (`rfid_attendance`) stores:
- User accounts and employee information
- Attendance records (clock in/out times)
- Scan logs and signatures
- Departments and products (points)

**Default credentials:**
- Username: `rfid_user`
- Password: `rfid_pass`
- Database: `rfid_attendance`
- Host: `mysql:3306` (Docker) or `localhost:3306` (direct)

---

## Core Tables

### users

Stores employee information and RFID card mappings.

```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  employee_id VARCHAR(50) UNIQUE NOT NULL,
  rfid_uid VARCHAR(17) UNIQUE,
  department_id INT,
  role VARCHAR(50) DEFAULT 'worker',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id)
);
```

**Columns:**
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT | Primary key, auto-increment |
| `name` | VARCHAR(255) | Full name (required) |
| `employee_id` | VARCHAR(50) | Unique employee code |
| `rfid_uid` | VARCHAR(17) | RFID card UID (XX:XX:XX:XX format) |
| `department_id` | INT | Foreign key to departments |
| `role` | VARCHAR(50) | `worker`, `supervisor`, `admin` |
| `active` | BOOLEAN | Soft delete flag |
| `created_at` | TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | Last modification time |

**Indexes:**
```sql
CREATE UNIQUE INDEX idx_employee_id ON users(employee_id);
CREATE UNIQUE INDEX idx_rfid_uid ON users(rfid_uid);
CREATE INDEX idx_department ON users(department_id);
CREATE INDEX idx_active ON users(active);
```

**Example:**
```sql
INSERT INTO users (name, employee_id, rfid_uid, department_id, role)
VALUES ('John Doe', 'EMP001', '04:3A:B2:C1', 1, 'worker');
```

---

### attendance

Stores clock-in and clock-out records per employee.

```sql
CREATE TABLE attendance (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  time_in TIMESTAMP NOT NULL,
  time_out TIMESTAMP NULL,
  status VARCHAR(50) DEFAULT 'clocked_in',
  signature_path VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Columns:**
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT | Primary key |
| `user_id` | INT | Foreign key to users |
| `time_in` | TIMESTAMP | Clock-in time |
| `time_out` | TIMESTAMP | Clock-out time (nullable) |
| `status` | VARCHAR(50) | `clocked_in`, `clocked_out`, `completed` |
| `signature_path` | VARCHAR(255) | Path to SVG signature file |
| `created_at` | TIMESTAMP | Record creation time |

**Status values:**
- `clocked_in` - User is currently clocked in
- `clocked_out` - User has clocked out
- `completed` - Full record finalized (for reports)

**Indexes:**
```sql
CREATE INDEX idx_user_id ON attendance(user_id);
CREATE INDEX idx_time_in ON attendance(time_in);
CREATE INDEX idx_status ON attendance(status);
```

**Example:**
```sql
-- Clock in
INSERT INTO attendance (user_id, time_in, status)
VALUES (1, NOW(), 'clocked_in');

-- Update for clock out
UPDATE attendance SET time_out = NOW(), status = 'clocked_out'
WHERE user_id = 1 AND status = 'clocked_in';
```

**Calculated fields** (in application):
```python
hours_worked = (time_out - time_in).total_seconds() / 3600
```

---

### scan_log

Detailed log of every card scan (debugging/audit trail).

```sql
CREATE TABLE scan_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  rfid_uid VARCHAR(17) NOT NULL,
  user_id INT,
  action VARCHAR(50),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  response_status VARCHAR(50),
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
```

**Columns:**
| Column | Type | Notes |
|--------|------|-------|
| `rfid_uid` | VARCHAR(17) | Card scanned (may not match a user) |
| `user_id` | INT | Matched user (nullable if unknown card) |
| `action` | VARCHAR(50) | `scan_detected`, `clock_in`, `clock_out` |
| `timestamp` | TIMESTAMP | When scan occurred |
| `response_status` | VARCHAR(50) | `success`, `user_not_found`, `error` |
| `ip_address` | VARCHAR(45) | Source IP (for debugging) |
| `created_at` | TIMESTAMP | Log record time |

**Indexes:**
```sql
CREATE INDEX idx_rfid_uid ON scan_log(rfid_uid);
CREATE INDEX idx_user_id ON scan_log(user_id);
CREATE INDEX idx_timestamp ON scan_log(timestamp);
```

**Example:**
```sql
INSERT INTO scan_log (rfid_uid, user_id, action, timestamp, response_status)
VALUES ('04:3A:B2:C1', 1, 'clock_in', NOW(), 'success');
```

---

### departments

Employee departments for organization and reporting.

```sql
CREATE TABLE departments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) UNIQUE NOT NULL,
  manager_id INT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL
);
```

**Columns:**
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT | Primary key |
| `name` | VARCHAR(100) | Department name |
| `manager_id` | INT | User ID of manager |
| `active` | BOOLEAN | Soft delete |
| `created_at` | TIMESTAMP | Creation time |

**Example:**
```sql
INSERT INTO departments (name, manager_id) VALUES ('Production', 1);
INSERT INTO departments (name, manager_id) VALUES ('Sales', 2);
```

---

### products

Predefined products and their point values for attendance rewards.

```sql
CREATE TABLE products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  points_value DECIMAL(8,2) NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Columns:**
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT | Primary key |
| `name` | VARCHAR(255) | Product name |
| `points_value` | DECIMAL(8,2) | Points awarded (8.5 = 8 hours + 30 min) |
| `active` | BOOLEAN | Soft delete |
| `created_at` | TIMESTAMP | Creation time |

**Example:**
```sql
INSERT INTO products (name, points_value) VALUES ('Standard Shift', 8.5);
INSERT INTO products (name, points_value) VALUES ('Overtime (1.5x)', 12.75);
INSERT INTO products (name, points_value) VALUES ('Half Day', 4.25);
```

---

## Query Examples

### User with Current Clocked-In Status

```sql
SELECT 
  u.id, u.name, u.employee_id,
  a.time_in,
  TIMESTAMPDIFF(MINUTE, a.time_in, NOW()) AS minutes_clocked_in,
  a.status
FROM users u
LEFT JOIN attendance a ON u.id = a.user_id 
  AND a.status = 'clocked_in'
WHERE u.active = true
ORDER BY a.time_in DESC;
```

### Daily Attendance Summary

```sql
SELECT 
  DATE(a.time_in) AS date,
  u.name,
  u.employee_id,
  a.time_in,
  a.time_out,
  ROUND((TIMESTAMPDIFF(SECOND, a.time_in, a.time_out) / 3600), 2) AS hours_worked
FROM attendance a
JOIN users u ON a.user_id = u.id
WHERE DATE(a.time_in) = CURDATE()
  AND a.status = 'clocked_out'
ORDER BY u.name;
```

### Weekly Points Summary

```sql
SELECT 
  u.name,
  u.employee_id,
  d.name AS department,
  COUNT(a.id) AS days_worked,
  ROUND(SUM(TIMESTAMPDIFF(SECOND, a.time_in, a.time_out) / 3600), 1) AS total_hours,
  ROUND(SUM(TIMESTAMPDIFF(SECOND, a.time_in, a.time_out) / 3600) * 1.0, 2) AS points_earned
FROM attendance a
JOIN users u ON a.user_id = u.id
JOIN departments d ON u.department_id = d.id
WHERE WEEK(a.time_in) = WEEK(NOW())
  AND a.status = 'clocked_out'
GROUP BY u.id, u.name, d.name
ORDER BY points_earned DESC;
```

### Unknown/Unregistered Cards

```sql
SELECT 
  rfid_uid,
  COUNT(*) AS scan_count,
  MAX(timestamp) AS last_scan
FROM scan_log
WHERE user_id IS NULL
GROUP BY rfid_uid
ORDER BY scan_count DESC;
```

### Users Not Clocked Out (Manual Correction)

```sql
SELECT 
  u.id, u.name,
  a.time_in,
  TIMEDIFF(NOW(), a.time_in) AS time_elapsed
FROM attendance a
JOIN users u ON a.user_id = u.id
WHERE a.status = 'clocked_in'
  AND a.time_in < DATE_SUB(NOW(), INTERVAL 2 DAY);
```

**Manual fix:**
```sql
UPDATE attendance 
SET time_out = '2026-01-27 16:30:00', status = 'clocked_out'
WHERE id = 123;
```

---

## Database Maintenance

### Backup

```bash
# Using Docker:
docker-compose exec mysql mysqldump -u rfid_user -p rfid_attendance > backup.sql
# (enter password: rfid_pass)

# Or direct:
mysqldump -h localhost -u rfid_user -p rfid_attendance > backup.sql
```

### Restore

```bash
# Using Docker:
docker-compose exec mysql mysql -u rfid_user -p rfid_attendance < backup.sql

# Or direct:
mysql -h localhost -u rfid_user -p rfid_attendance < backup.sql
```

### Cleanup Old Records

```sql
-- Delete scan logs older than 90 days
DELETE FROM scan_log 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);

-- Mark old attendance as archived (don't delete, keep for auditing)
-- No automatic cleanup; use manual review instead
SELECT * FROM attendance 
WHERE time_in < DATE_SUB(NOW(), INTERVAL 1 YEAR);
```

---

## Integrity Constraints

### Foreign Key Relationships

- `users.department_id` → `departments.id` (ON DELETE SET NULL)
- `attendance.user_id` → `users.id` (ON DELETE CASCADE)
- `scan_log.user_id` → `users.id` (ON DELETE SET NULL)
- `departments.manager_id` → `users.id` (ON DELETE SET NULL)

### Cascading Deletes

If a user is deleted:
- All `attendance` records are **deleted** (cascade)
- All `scan_log` entries reference the user as NULL

If a department is deleted:
- All users in that department have `department_id` set to **NULL**

---

## Performance Optimization

### Recommended Indexes (Already Created)

```sql
-- Attendance queries
CREATE INDEX idx_attendance_user_date ON attendance(user_id, time_in);

-- Scan log lookups
CREATE INDEX idx_scan_user_time ON scan_log(user_id, timestamp);

-- Dashboard stats
CREATE INDEX idx_attendance_status_time ON attendance(status, time_in);

-- User lookups
CREATE INDEX idx_user_rfid ON users(rfid_uid);
```

### Query Optimization Tips

1. **Always filter by date range** when querying `attendance` or `scan_log`
2. **Use indexes** in WHERE clauses: `user_id`, `timestamp`, `rfid_uid`
3. **Avoid SELECT * ** - specify exact columns needed
4. **Use LIMIT** for dashboard queries to prevent timeout

---

## Access Control

### Docker MySQL Access

```bash
# Via Docker:
docker-compose exec mysql mysql -u rfid_user -p rfid_attendance

# Direct (if port exposed):
mysql -h 127.0.0.1 -P 3306 -u rfid_user -p rfid_attendance
```

### User Permissions

```sql
-- What rfid_user has (created by docker-compose):
-- All privileges on rfid_attendance database only

-- To verify:
SHOW GRANTS FOR 'rfid_user'@'%';
```

---

## Migration History

| Version | Changes | Date |
|---------|---------|------|
| 1.0 | Initial schema | 2025-06-15 |
| 1.1 | Added `signature_path` column | 2025-08-20 |
| 1.2 | Added `scan_log` table | 2025-09-10 |
| 1.3 | Added indexes for performance | 2025-10-15 |
| 1.5.2 | Current (January 2026) | 2026-01-28 |

Schema is defined in `releases/*/init.sql` - apply to new MySQL instances with:
```bash
docker-compose exec mysql mysql -u root -p < init.sql
```

---

## See Also

- [BACKEND_SETUP.md](BACKEND_SETUP.md) - Backend deployment
- [API_REFERENCE.md](API_REFERENCE.md) - API endpoints
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md#backend-troubleshooting) - Database issues

---

**Last Updated**: January 28, 2026
