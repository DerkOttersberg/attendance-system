-- Database schema for RFID clock-in/out system

CREATE DATABASE IF NOT EXISTS rfid_attendance;
USE rfid_attendance;

-- Users table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rfid_uid VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    department VARCHAR(50),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_rfid (rfid_uid)
);

-- Attendance records table
CREATE TABLE attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    clock_in TIMESTAMP NOT NULL,
    clock_out TIMESTAMP NULL,
    work_duration INT NULL COMMENT 'Duration in minutes',
    date DATE NOT NULL,
    status ENUM('clocked_in', 'clocked_out') DEFAULT 'clocked_in',
    notes TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_date (user_id, date),
    INDEX idx_date (date),
    INDEX idx_status (status)
);

-- Audit log for all RFID scans
CREATE TABLE scan_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rfid_uid VARCHAR(32) NOT NULL,
    scan_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    action VARCHAR(20),
    success BOOLEAN,
    message TEXT,
    INDEX idx_rfid_time (rfid_uid, scan_time)
);

-- Sample data
INSERT INTO users (rfid_uid, name, email, department) VALUES
('04A1B2C3', 'John Doe', 'john.doe@company.com', 'Engineering'),
('05D4E5F6', 'Jane Smith', 'jane.smith@company.com', 'Marketing'),
('53C991A6', 'Bob Wilson', 'bob.wilson@company.com', 'Engineering');

-- View for current status
CREATE VIEW current_status AS
SELECT 
    u.id,
    u.name,
    u.rfid_uid,
    a.clock_in,
    a.clock_out,
    a.status,
    CASE 
        WHEN a.status = 'clocked_in' THEN TIMESTAMPDIFF(MINUTE, a.clock_in, NOW())
        ELSE a.work_duration
    END as minutes_worked
FROM users u
LEFT JOIN attendance a ON u.id = a.user_id 
    AND a.date = CURDATE()
WHERE u.active = TRUE;
