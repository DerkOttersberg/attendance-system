#!/usr/bin/env python3
"""
Script to find the user ID for 'test' user on the target website
and test the points update functionality
"""

import requests
import json

TARGET_URL = 'https://punten.bitsenbytes.net'

def get_user_id_by_name(session, user_name):
    """Get user ID from the target website by name"""
    try:
        response = session.get(f'{TARGET_URL}/api/allDeelnemers', timeout=5)
        
        if response.status_code == 200:
            users = response.json()
            
            # Search for user by name (case-insensitive)
            for user in users:
                if user['naam'].lower() == user_name.lower():
                    return user.get('ID') or user.get('id')
            
            return None
        return None
    except Exception as e:
        print(f"Error getting users: {e}")
        return None

def login_and_update_points(user_name, points_to_add):
    """Login and update points for a user"""
    try:
        print(f"Testing points update for '{user_name}'")
        print(f"Points to add: {points_to_add}")
        print("=" * 60)
        
        session = requests.Session()
        
        # Step 1: Login
        print("\n1. Logging in...")
        login_response = session.get(f'{TARGET_URL}/api/login/BitsGoes1!', timeout=5)
        
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.status_code}")
            return False
        
        print("✅ Login successful")
        
        # Step 2: Get all users to find the user ID
        print(f"\n2. Finding user '{user_name}'...")
        user_id = get_user_id_by_name(session, user_name)
        
        if user_id:
            print(f"✅ Found user ID: {user_id}")
        else:
            print(f"❌ User '{user_name}' not found")
            print("\n   Available users:")
            response = session.get(f'{TARGET_URL}/api/allDeelnemers', timeout=5)
            users = response.json()
            for user in users:
                print(f"   - {user.get('naam')} (ID: {user.get('ID')})")
            return False
        
        # Step 3: Update points
        print(f"\n3. Updating points for user...")
        
        update_data = {
            'id': user_id,
            'naam': user_name,
            'punten': points_to_add
        }
        
        print(f"   Sending: {json.dumps(update_data)}")
        
        update_response = session.post(
            f'{TARGET_URL}/api/updatePunten',
            json=update_data,
            timeout=5
        )
        
        print(f"   Response status: {update_response.status_code}")
        
        if update_response.status_code == 200:
            print("✅ Points updated successfully!")
            return True
        else:
            print(f"❌ Failed to update points: {update_response.status_code}")
            print(f"   Response: {update_response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == '__main__':
    # Test with the 'test' user
    success = login_and_update_points('test', 1)
    
    if success:
        print("\n" + "=" * 60)
        print("✅ TEST SUCCESSFUL - Points can be updated!")
        print("=" * 60)
