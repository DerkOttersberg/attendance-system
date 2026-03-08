#!/usr/bin/env python3
"""
Script to seed dummy attendance data for testing
Generates 100 attendance records with dummy signatures for various users
"""

import mysql.connector
from mysql.connector import Error
from datetime import datetime, timedelta
import random
import json

# Database connection config
db_config = {
    'host': 'localhost',
    'user': 'root',
    'password': 'rootpassword',
    'database': 'rfid_attendance'
}

def get_db_connection():
    try:
        return mysql.connector.connect(**db_config)
    except Error as e:
        print(f"Error connecting to database: {e}")
        return None

def generate_dummy_signature():
    """Generate a dummy SVG signature"""
    # Simple wavy line signature
    return '<svg viewBox="0 0 550 270" xmlns="http://www.w3.org/2000/svg"><path d="M 50 150 Q 100 100 150 150 T 250 150 T 350 150 T 450 150" stroke="black" stroke-width="3" fill="none" stroke-linecap="round"/></svg>'

def seed_dummy_data():
    conn = get_db_connection()
    if not conn:
        print("Failed to connect to database")
        return
    
    try:
        cursor = conn.cursor(dictionary=True)
        
        # Get all users
        cursor.execute("SELECT id FROM users WHERE active = 1")
        users = cursor.fetchall()
        
        if not users:
            print("No active users found. Please add some users first.")
            conn.close()
            return
        
        user_ids = [u['id'] for u in users]
        print(f"Found {len(user_ids)} active users")
        
        # Generate 100 dummy records
        records = []
        base_date = datetime.now() - timedelta(days=60)  # Start 60 days ago
        
        for i in range(100):
            user_id = random.choice(user_ids)
            # Spread records across different dates
            record_date = base_date + timedelta(days=random.randint(0, 59))
            
            # Skip weekends (5=Saturday, 6=Sunday)
            while record_date.weekday() >= 5:
                record_date = record_date + timedelta(days=1)
            
            # Random work times
            clock_in_hour = random.randint(6, 9)  # 6am to 9am
            clock_in_minute = random.randint(0, 59)
            clock_in = record_date.replace(hour=clock_in_hour, minute=clock_in_minute, second=0)
            
            # Work duration between 3 to 8 hours
            work_duration_minutes = random.randint(180, 480)
            clock_out = clock_in + timedelta(minutes=work_duration_minutes)
            
            # Generate dummy signature
            signature_data = generate_dummy_signature()
            
            records.append({
                'user_id': user_id,
                'date': record_date.date(),
                'clock_in': clock_in,
                'clock_out': clock_out,
                'work_duration': work_duration_minutes,
                'status': 'clocked_out',
                'signature_data': signature_data
            })
        
        # Insert records
        cursor_insert = conn.cursor()
        insert_query = """
            INSERT INTO attendance 
            (user_id, date, clock_in, clock_out, work_duration, status, signature_data)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        
        for record in records:
            cursor_insert.execute(insert_query, (
                record['user_id'],
                record['date'],
                record['clock_in'],
                record['clock_out'],
                record['work_duration'],
                record['status'],
                record['signature_data']
            ))
        
        conn.commit()
        print(f"✅ Successfully inserted {len(records)} dummy attendance records!")
        print(f"   - Records span the last 60 days")
        print(f"   - Work durations: 3-8 hours")
        print(f"   - All records have dummy signatures")
        
    except Error as e:
        print(f"Error inserting data: {e}")
        conn.rollback()
    finally:
        try:
            cursor.close()
            cursor_insert.close()
        except:
            pass
        conn.close()

if __name__ == '__main__':
    print("🌱 Seeding dummy attendance data...")
    seed_dummy_data()
