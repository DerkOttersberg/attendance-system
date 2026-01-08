from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
from mysql.connector import Error
import os
from datetime import datetime, date
import logging
import sys
import traceback


app = Flask(__name__)
CORS(app)  # Enable CORS for web dashboard

# Force logging to stream handler
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s:%(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)




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
    Main endpoint for RFID scan - determines action but doesn't clock in
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
            # CLOCK IN - Don't create record yet, wait for signature
            action = 'clock_in'
            message = f"Welcome {user['name']}! Please sign to clock in."
            
        else:
            # CLOCK OUT - Process immediately
            cursor.execute("""
                UPDATE attendance 
                SET clock_out = NOW(), 
                    status = 'clocked_out',
                    work_duration = TIMESTAMPDIFF(MINUTE, clock_in, NOW())
                WHERE id = %s
            """, (attendance['id'],))
            
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

@app.route('/api/clock_in_with_signature', methods=['POST'])
def clock_in_with_signature():
    """
    Clock in with signature
    Expected JSON: {"rfid_uid": "04A1B2C3", "signature": "<svg>...</svg>"}
    """
    try:
        data = request.get_json()
        
        if not data:
            logging.error("No JSON data received")
            return jsonify({'error': 'No JSON data received'}), 400
            
        logging.info(f"Received data keys: {data.keys()}")
        
        if 'rfid_uid' not in data or 'signature' not in data:
            logging.error(f"Missing required fields. Received: {list(data.keys())}")
            return jsonify({'error': 'Missing rfid_uid or signature'}), 400
        
        rfid_uid = data['rfid_uid'].strip().upper()
        signature_data = data['signature']
        
        logging.info(f"Processing clock-in for RFID: {rfid_uid}")
        logging.info(f"Signature data length: {len(signature_data)} chars")
        
    except Exception as e:
        logging.error(f"Failed to parse request: {e}")
        logging.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({'error': f'Failed to parse request: {str(e)}'}), 400
    
    conn = get_db_connection()
    if not conn:
        logging.error("Database connection failed")
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = conn.cursor(dictionary=True)
        
        # Check if user exists
        cursor.execute("SELECT * FROM users WHERE rfid_uid = %s AND active = TRUE", (rfid_uid,))
        user = cursor.fetchone()
        
        if not user:
            logging.warning(f"User not found for RFID: {rfid_uid}")
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404
        
        logging.info(f"Found user: {user['name']} (ID: {user['id']})")
        
        # Check if already clocked in today
        today = date.today()
        cursor.execute("""
            SELECT * FROM attendance 
            WHERE user_id = %s AND date = %s AND status = 'clocked_in'
        """, (user['id'], today))
        
        existing_record = cursor.fetchone()
        if existing_record:
            logging.warning(f"User {user['name']} already clocked in today")
            return jsonify({
                'success': False,
                'message': 'Already clocked in today'
            }), 400
        
        # Insert attendance record with signature
        logging.info(f"Inserting attendance record for user {user['name']}")
        cursor.execute("""
            INSERT INTO attendance (user_id, clock_in, date, status, signature_data)
            VALUES (%s, NOW(), %s, 'clocked_in', %s)
        """, (user['id'], today, signature_data))
        
        # Log the scan
        log_scan(cursor, rfid_uid, 'clock_in_with_signature', True, f"Clocked in with signature")
        
        conn.commit()
        logging.info(f"Successfully clocked in user {user['name']}")
        
        return jsonify({
            'success': True,
            'message': f'Welcome {user["name"]}! Clocked in successfully.',
            'user': {
                'name': user['name'],
                'department': user['department']
            },
            'timestamp': datetime.now().isoformat()
        })
        
    except Error as e:
        logging.error(f"Database error in clock_in_with_signature: {e}")
        logging.error(f"Error code: {e.errno}")
        logging.error(f"SQL State: {e.sqlstate if hasattr(e, 'sqlstate') else 'N/A'}")
        logging.error(f"Traceback: {traceback.format_exc()}")
        conn.rollback()
        return jsonify({'error': f'Database operation failed: {str(e)}'}), 500
        
    except Exception as e:
        logging.error(f"Unexpected error in clock_in_with_signature: {e}")
        logging.error(f"Traceback: {traceback.format_exc()}")
        conn.rollback()
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500
        
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


@app.route('/api/users', methods=['DELETE'])
def delete_users():
    """Delete users permanently by id list (expects JSON {"ids": [1,2,3]})"""
    data = request.get_json()
    if not data or 'ids' not in data:
        return jsonify({'error': 'Missing ids list'}), 400

    ids = data.get('ids')
    if not isinstance(ids, list) or len(ids) == 0:
        return jsonify({'error': 'ids must be a non-empty list'}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500

    try:
        cursor = conn.cursor()
        # Build placeholder string and execute
        placeholders = ','.join(['%s'] * len(ids))
        query = f"DELETE FROM users WHERE id IN ({placeholders})"
        cursor.execute(query, ids)
        deleted = cursor.rowcount
        conn.commit()
        return jsonify({'success': True, 'deleted_count': deleted})

    except Error as e:
        conn.rollback()
        logging.error(f"Failed to delete users: {e}")
        return jsonify({'error': str(e)}), 500

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

@app.route('/api/attendance/filter', methods=['GET'])
def filter_attendance():
    """
    Get filtered attendance records
    Query params: user_id, start_date, end_date
    """
    user_id = request.args.get('user_id')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = conn.cursor(dictionary=True)
        
        # Build dynamic query
        query = """
            SELECT 
                a.id,
                a.date,
                u.name,
                u.department,
                a.clock_in,
                a.clock_out,
                a.work_duration,
                a.status,
                a.signature_data
            FROM attendance a
            JOIN users u ON a.user_id = u.id
            WHERE 1=1
        """
        params = []
        
        if user_id:
            query += " AND a.user_id = %s"
            params.append(user_id)
        
        if start_date:
            query += " AND a.date >= %s"
            params.append(start_date)
        
        if end_date:
            query += " AND a.date <= %s"
            params.append(end_date)
        
        query += " ORDER BY a.date DESC, a.clock_in DESC"
        
        cursor.execute(query, params)
        records = cursor.fetchall()
        
        # Convert datetime objects to strings
        for record in records:
            if record['clock_in']:
                record['clock_in'] = record['clock_in'].isoformat()
            if record['clock_out']:
                record['clock_out'] = record['clock_out'].isoformat()
            if record['date']:
                record['date'] = record['date'].isoformat()
        
        return jsonify(records)
        
    finally:
        cursor.close()
        conn.close()

@app.route('/api/attendance/all', methods=['GET'])
def all_attendance():
    """Get all attendance records with signatures"""
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT 
                a.id,
                a.date,
                u.name,
                u.department,
                a.clock_in,
                a.clock_out,
                a.status,
                a.work_duration,
                a.signature_data
            FROM attendance a
            JOIN users u ON a.user_id = u.id
            ORDER BY a.date DESC, a.clock_in DESC
            LIMIT 100
        """)
        
        records = cursor.fetchall()
        
        # Convert datetime objects to strings
        for record in records:
            if record['date']:
                record['date'] = record['date'].isoformat()
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


def ensure_departments_table(conn):
    """Create departments table if missing and populate from existing user.department values."""
    try:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS departments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)

        # populate with distinct department names from users
        cursor.execute("SELECT DISTINCT department FROM users WHERE department IS NOT NULL AND department <> ''")
        rows = cursor.fetchall()
        for row in rows:
            name = row[0]
            if not name:
                continue
            try:
                cursor.execute("INSERT IGNORE INTO departments (name) VALUES (%s)", (name,))
            except Exception:
                # ignore duplicate or insertion errors
                pass
        conn.commit()
    finally:
        try:
            cursor.close()
        except Exception:
            pass


@app.route('/api/departments', methods=['GET'])
def list_departments():
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500

    try:
        ensure_departments_table(conn)
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, name FROM departments ORDER BY name ASC")
        depts = cursor.fetchall()
        return jsonify(depts)
    finally:
        cursor.close()
        conn.close()


@app.route('/api/departments', methods=['POST'])
def create_department():
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Missing department name'}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500

    try:
        ensure_departments_table(conn)
        cursor = conn.cursor()
        cursor.execute("INSERT INTO departments (name) VALUES (%s)", (name,))
        conn.commit()
        return jsonify({'success': True, 'id': cursor.lastrowid, 'name': name}), 201
    except Error as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 400
    finally:
        cursor.close()
        conn.close()


@app.route('/api/departments/<int:dept_id>', methods=['DELETE'])
def delete_department(dept_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500

    try:
        ensure_departments_table(conn)
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT name FROM departments WHERE id = %s", (dept_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({'error': 'Department not found'}), 404
        name = row['name']

        # unset department from users that reference this name
        cursor2 = conn.cursor()
        cursor2.execute("UPDATE users SET department = NULL WHERE department = %s", (name,))
        affected = cursor2.rowcount

        cursor.execute("DELETE FROM departments WHERE id = %s", (dept_id,))
        conn.commit()
        return jsonify({'success': True, 'users_cleared': affected})
    except Error as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        try:
            cursor.close()
        except Exception:
            pass
        try:
            cursor2.close()
        except Exception:
            pass
        conn.close()


@app.route('/api/users/<int:user_id>/department', methods=['PUT'])
def set_user_department(user_id):
    data = request.get_json() or {}
    # department may be null/empty
    dept = data.get('department')
    if dept is not None:
        dept = dept.strip()
        if dept == '':
            dept = None

    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500

    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET department = %s WHERE id = %s", (dept, user_id))
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({'error': 'User not found'}), 404
        return jsonify({'success': True})
    except Error as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@app.route('/api/users/<int:user_id>/uid', methods=['PUT'])
def update_user_uid(user_id):
    data = request.get_json() or {}
    new_uid = (data.get('rfid_uid') or '').strip().upper()
    if not new_uid:
        return jsonify({'error': 'Missing rfid_uid'}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500

    try:
        cursor = conn.cursor(dictionary=True)
        # check for duplicate uid on other users
        cursor.execute("SELECT id FROM users WHERE rfid_uid = %s AND id != %s", (new_uid, user_id))
        dup = cursor.fetchone()
        if dup:
            return jsonify({'error': 'RFID UID already in use'}), 400

        cursor = conn.cursor()
        cursor.execute("UPDATE users SET rfid_uid = %s WHERE id = %s", (new_uid, user_id))
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({'error': 'User not found'}), 404
        return jsonify({'success': True})
    except Error as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        try:
            cursor.close()
        except Exception:
            pass
        conn.close()


@app.route('/api/users/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    """Update user fields (name, email, department, rfid_uid) partial update."""
    data = request.get_json() or {}
    allowed = ['name', 'email', 'department', 'rfid_uid']
    updates = {k: (v.strip() if isinstance(v, str) else v) for k, v in data.items() if k in allowed}

    if not updates:
        return jsonify({'error': 'No valid fields to update'}), 400

    # If rfid_uid in updates, normalize
    if 'rfid_uid' in updates and updates['rfid_uid']:
        updates['rfid_uid'] = updates['rfid_uid'].upper()

    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500

    try:
        cursor = conn.cursor()
        # build dynamic SET
        set_parts = []
        params = []
        for k, v in updates.items():
            set_parts.append(f"{k} = %s")
            params.append(v)

        params.append(user_id)
        query = f"UPDATE users SET {', '.join(set_parts)} WHERE id = %s"

        cursor.execute(query, params)
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({'error': 'User not found'}), 404
        return jsonify({'success': True})
    except Error as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        try:
            cursor.close()
        except Exception:
            pass
        conn.close()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)