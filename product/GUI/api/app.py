from flask import Flask, request, jsonify
import mysql.connector
from mysql.connector import Error
import os
from datetime import datetime, date
import logging

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USER', 'rfid_user'),
    'password': os.getenv('DB_PASSWORD', 'rfid_pass'),
    'database': os.getenv('DB_NAME', 'rfid_attendance')
}

def get_db_connection():
    """Create database connection"""
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        return connection
    except Error as e:
        logging.error(f"Database connection error: {e}")
        return None

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'timestamp': datetime.now().isoformat()})

@app.route('/api/scan', methods=['POST'])
def handle_scan():
    """
    Main endpoint for RFID scan
    Expected JSON: {"rfid_uid": "04A1B2C3"}
    """
    data = request.get_json()
    
    if not data or 'rfid_uid' not in data:
        return jsonify({'error': 'Missing rfid_uid'}), 400
    
    rfid_uid = data['rfid_uid'].strip().upper()
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = conn.cursor(dictionary=True)
        
        # Check if user exists
        cursor.execute("SELECT * FROM users WHERE rfid_uid = %s AND active = TRUE", (rfid_uid,))
        user = cursor.fetchone()
        
        if not user:
            log_scan(cursor, rfid_uid, 'unknown', False, 'User not found')
            conn.commit()
            return jsonify({
                'success': False,
                'message': 'RFID card not registered',
                'rfid_uid': rfid_uid
            }), 404
        
        # Check today's attendance record
        today = date.today()
        cursor.execute("""
            SELECT * FROM attendance 
            WHERE user_id = %s AND date = %s
            ORDER BY id DESC LIMIT 1
        """, (user['id'], today))
        
        attendance = cursor.fetchone()
        
        if not attendance or attendance['status'] == 'clocked_out':
            # Clock IN
            cursor.execute("""
                INSERT INTO attendance (user_id, clock_in, date, status)
                VALUES (%s, NOW(), %s, 'clocked_in')
            """, (user['id'], today))
            
            action = 'clock_in'
            message = f"Welcome {user['name']}! Clocked in successfully."
            
        else:
            # Clock OUT
            cursor.execute("""
                UPDATE attendance 
                SET clock_out = NOW(), 
                    status = 'clocked_out',
                    work_duration = TIMESTAMPDIFF(MINUTE, clock_in, NOW())
                WHERE id = %s
            """, (attendance['id'],))
            
            # Calculate work duration
            duration_minutes = cursor.execute("""
                SELECT TIMESTAMPDIFF(MINUTE, clock_in, clock_out) as duration
                FROM attendance WHERE id = %s
            """, (attendance['id'],))
            cursor.fetchone()
            
            action = 'clock_out'
            message = f"Goodbye {user['name']}! Clocked out successfully."
        
        # Log the scan
        log_scan(cursor, rfid_uid, action, True, message)
        
        conn.commit()
        
        return jsonify({
            'success': True,
            'action': action,
            'message': message,
            'user': {
                'name': user['name'],
                'department': user['department']
            },
            'timestamp': datetime.now().isoformat()
        })
        
    except Error as e:
        logging.error(f"Database error: {e}")
        conn.rollback()
        return jsonify({'error': 'Database operation failed'}), 500
        
    finally:
        cursor.close()
        conn.close()

@app.route('/api/status/<rfid_uid>', methods=['GET'])
def get_user_status(rfid_uid):
    """Get current status of a user"""
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT * FROM current_status WHERE rfid_uid = %s
        """, (rfid_uid.upper(),))
        
        status = cursor.fetchone()
        
        if not status:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'name': status['name'],
            'status': status['status'],
            'clock_in': status['clock_in'].isoformat() if status['clock_in'] else None,
            'clock_out': status['clock_out'].isoformat() if status['clock_out'] else None,
            'minutes_worked': status['minutes_worked']
        })
        
    finally:
        cursor.close()
        conn.close()

@app.route('/api/users', methods=['GET'])
def list_users():
    """List all users"""
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, rfid_uid, name, email, department, active FROM users")
        users = cursor.fetchall()
        return jsonify(users)
        
    finally:
        cursor.close()
        conn.close()

@app.route('/api/users', methods=['POST'])
def add_user():
    """Add new user"""
    data = request.get_json()
    
    required_fields = ['rfid_uid', 'name']
    if not all(field in data for field in required_fields):
        return jsonify({'error': 'Missing required fields'}), 400
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO users (rfid_uid, name, email, department)
            VALUES (%s, %s, %s, %s)
        """, (
            data['rfid_uid'].upper(),
            data['name'],
            data.get('email'),
            data.get('department')
        ))
        conn.commit()
        
        return jsonify({
            'success': True,
            'message': 'User added successfully',
            'user_id': cursor.lastrowid
        }), 201
        
    except Error as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 400
        
    finally:
        cursor.close()
        conn.close()

@app.route('/api/attendance/today', methods=['GET'])
def today_attendance():
    """Get all attendance records for today"""
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT 
                u.name,
                u.department,
                a.clock_in,
                a.clock_out,
                a.status,
                a.work_duration
            FROM attendance a
            JOIN users u ON a.user_id = u.id
            WHERE a.date = CURDATE()
            ORDER BY a.clock_in DESC
        """)
        
        records = cursor.fetchall()
        
        # Convert datetime objects to strings
        for record in records:
            if record['clock_in']:
                record['clock_in'] = record['clock_in'].isoformat()
            if record['clock_out']:
                record['clock_out'] = record['clock_out'].isoformat()
        
        return jsonify(records)
        
    finally:
        cursor.close()
        conn.close()

def log_scan(cursor, rfid_uid, action, success, message):
    """Helper function to log scans"""
    cursor.execute("""
        INSERT INTO scan_log (rfid_uid, action, success, message)
        VALUES (%s, %s, %s, %s)
    """, (rfid_uid, action, success, message))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
