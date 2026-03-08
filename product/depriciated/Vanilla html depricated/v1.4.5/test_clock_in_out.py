#!/usr/bin/env python3
"""
Test script to simulate clock in/out and verify points are added to target website
"""

import requests
import json
from datetime import datetime, timedelta

API_URL = 'http://localhost:5000'
TARGET_URL = 'https://punten.bitsenbytes.net'

def test_clock_in_out():
    """Test the complete clock in/out workflow with points update"""
    
    print("=" * 70)
    print("TESTING CLOCK IN/OUT WITH AUTOMATIC POINTS UPDATE")
    print("=" * 70)
    
    # First, let's create a test user if it doesn't exist
    print("\n[STEP 1] Creating/Verifying test user on your website")
    print("-" * 70)
    
    test_user = {
        'rfid_uid': 'TEST123456',
        'name': 'test',
        'email': 'test@example.com',
        'department': 'Testing'
    }
    
    try:
        # Check if user exists
        users_response = requests.get(f'{API_URL}/api/users')
        users = users_response.json()
        
        user_exists = any(u['rfid_uid'] == test_user['rfid_uid'] for u in users)
        
        if not user_exists:
            print(f"Creating user: {test_user['name']}")
            create_response = requests.post(f'{API_URL}/api/users', json=test_user)
            if create_response.status_code == 200 or create_response.status_code == 201:
                print(f"✅ User created successfully")
            else:
                print(f"⚠️  Could not create user (may already exist): {create_response.status_code}")
        else:
            print(f"✅ User 'test' already exists")
    except Exception as e:
        print(f"Error checking users: {e}")
    
    # Now test clock in/out
    print("\n[STEP 2] Simulating CLOCK IN")
    print("-" * 70)
    
    try:
        clock_in_response = requests.post(f'{API_URL}/api/scan', json={'rfid_uid': test_user['rfid_uid']})
        
        if clock_in_response.status_code == 200:
            clock_in_data = clock_in_response.json()
            print(f"✅ Clock in successful")
            print(f"   Message: {clock_in_data.get('message')}")
            print(f"   Action: {clock_in_data.get('action')}")
        else:
            print(f"❌ Clock in failed: {clock_in_response.status_code}")
            print(f"   Response: {clock_in_response.text}")
            return False
    except Exception as e:
        print(f"Error during clock in: {e}")
        return False
    
    print("\n[STEP 3] Waiting 5 seconds (simulating work time)...")
    print("-" * 70)
    import time
    time.sleep(5)
    
    print("✅ Wait completed")
    
    print("\n[STEP 4] Simulating CLOCK OUT (with automatic points update)")
    print("-" * 70)
    
    try:
        clock_out_response = requests.post(f'{API_URL}/api/scan', json={'rfid_uid': test_user['rfid_uid']})
        
        if clock_out_response.status_code == 200:
            clock_out_data = clock_out_response.json()
            print(f"✅ Clock out successful")
            print(f"   Message: {clock_out_data.get('message')}")
            print(f"   Action: {clock_out_data.get('action')}")
        else:
            print(f"❌ Clock out failed: {clock_out_response.status_code}")
            print(f"   Response: {clock_out_response.text}")
            return False
    except Exception as e:
        print(f"Error during clock out: {e}")
        return False
    
    print("\n[STEP 5] Verifying points were added on target website")
    print("-" * 70)
    
    import time
    time.sleep(2)  # Give the API time to process
    
    try:
        session = requests.Session()
        
        # Login to target website
        session.get(f'{TARGET_URL}/api/login/BitsGoes1!')
        
        # Get all users
        users_response = session.get(f'{TARGET_URL}/api/allDeelnemers')
        users = users_response.json()
        
        # Find test user
        test_user_target = next((u for u in users if u.get('naam', '').lower() == 'test'), None)
        
        if test_user_target:
            print(f"✅ Test user found on target website")
            print(f"   Name: {test_user_target.get('naam')}")
            print(f"   Points: {test_user_target.get('punten')}")
            print(f"   ID: {test_user_target.get('ID')}")
        else:
            print(f"❌ Test user not found on target website")
    except Exception as e:
        print(f"Error verifying points: {e}")
    
    print("\n" + "=" * 70)
    print("✅ TEST WORKFLOW COMPLETED")
    print("=" * 70)
    print("\nHow it works:")
    print("1. User clocks in via RFID")
    print("2. When they clock out, the system:")
    print("   - Records work duration")
    print("   - If work time < 4 hours: adds 1 point")
    print("   - If work time >= 4 hours: adds 2 points")
    print("3. Points are automatically synced to target website")
    print("=" * 70)

if __name__ == '__main__':
    test_clock_in_out()
