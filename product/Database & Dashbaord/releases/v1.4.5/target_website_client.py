#!/usr/bin/env python3
"""
Complete integration script to login and interact with the target website
This script:
1. Tests connectivity to the target website
2. Logs in to get a session token
3. Makes authenticated API calls
4. Demonstrates the full workflow
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, Optional, Tuple

class TargetWebsiteClient:
    def __init__(self, url: str = "https://punten.bitsenbytes.net"):
        self.base_url = url
        self.session = requests.Session()
        self.is_logged_in = False
        self.token = None
        
    def test_connectivity(self) -> Tuple[bool, str]:
        """Test if we can reach the target website"""
        try:
            print(f"🔍 Testing connectivity to {self.base_url}...")
            response = self.session.get(f"{self.base_url}/api/allDeelnemers", timeout=5)
            return True, f"✅ Server is reachable (Status: {response.status_code})"
        except requests.exceptions.ConnectionError:
            return False, f"❌ Cannot connect to {self.base_url} - Server not running"
        except requests.exceptions.Timeout:
            return False, f"❌ Connection timeout to {self.base_url}"
        except Exception as e:
            return False, f"❌ Error: {e}"
    
    def login(self, password: str = "BitsGoes1!") -> Tuple[bool, str]:
        """Login to the target website"""
        try:
            print(f"🔐 Logging in to {self.base_url}/api/login/{password}...")
            
            response = self.session.get(
                f"{self.base_url}/api/login/{password}",
                timeout=5
            )
            
            if response.status_code == 200:
                self.is_logged_in = True
                
                # Print cookies
                print(f"🍪 Cookies received:")
                for cookie_name, cookie_value in self.session.cookies.items():
                    print(f"   {cookie_name}: {cookie_value}")
                    self.token = cookie_value if cookie_name == "login" else self.token
                
                return True, "✅ Successfully logged in!"
            elif response.status_code == 401:
                return False, "❌ Login failed: Invalid credentials"
            else:
                return False, f"❌ Login failed: Server returned {response.status_code}"
                
        except requests.exceptions.ConnectionError:
            return False, f"❌ Cannot connect to {self.base_url}"
        except requests.exceptions.Timeout:
            return False, f"❌ Connection timeout"
        except Exception as e:
            return False, f"❌ Error: {e}"
    
    def validate_token(self) -> Tuple[bool, str]:
        """Validate the current token"""
        if not self.is_logged_in:
            return False, "❌ Not logged in"
        
        try:
            response = self.session.get(
                f"{self.base_url}/api/validatetoken",
                timeout=5
            )
            
            if response.status_code == 200:
                return True, "✅ Token is valid"
            else:
                return False, f"❌ Token validation failed: {response.status_code}"
                
        except Exception as e:
            return False, f"❌ Error: {e}"
    
    def get_all_participants(self) -> Tuple[bool, str, Optional[list]]:
        """Get all participants (deelnemers)"""
        try:
            response = self.session.get(
                f"{self.base_url}/api/allDeelnemers",
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                return True, f"✅ Retrieved {len(data)} participants", data
            else:
                return False, f"❌ Failed to get participants: {response.status_code}", None
                
        except Exception as e:
            return False, f"❌ Error: {e}", None
    
    def logout(self) -> Tuple[bool, str]:
        """Logout from the target website"""
        if not self.is_logged_in:
            return False, "❌ Not logged in"
        
        try:
            response = self.session.get(
                f"{self.base_url}/api/logout",
                timeout=5
            )
            
            if response.status_code == 200:
                self.is_logged_in = False
                self.token = None
                return True, "✅ Successfully logged out"
            else:
                return False, f"❌ Logout failed: {response.status_code}"
                
        except Exception as e:
            return False, f"❌ Error: {e}"

def main():
    """Main test workflow"""
    print("=" * 80)
    print("TARGET WEBSITE LOGIN & INTEGRATION TEST")
    print("=" * 80)
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Create client
    client = TargetWebsiteClient()
    
    # Step 1: Test connectivity
    print("\n[STEP 1] Testing Connectivity")
    print("-" * 80)
    reachable, message = client.test_connectivity()
    print(message)
    
    if not reachable:
        print("\n⚠️  Cannot proceed - target server is not reachable")
        print("    Make sure the target website is running on 10.10.1.6:3000")
        print("    You can start it with: npm install && npm start")
        return False
    
    # Step 2: Login
    print("\n[STEP 2] Attempting Login")
    print("-" * 80)
    logged_in, message = client.login()
    print(message)
    
    if not logged_in:
        print("⚠️  Login failed")
        return False
    
    # Step 3: Validate token
    print("\n[STEP 3] Validating Token")
    print("-" * 80)
    valid, message = client.validate_token()
    print(message)
    
    # Step 4: Get participants
    print("\n[STEP 4] Fetching Participants")
    print("-" * 80)
    success, message, participants = client.get_all_participants()
    print(message)
    
    if success and participants:
        print(f"\n📊 Participants Data:")
        print(json.dumps(participants, indent=2))
    
    # Step 5: Logout
    print("\n[STEP 5] Logging Out")
    print("-" * 80)
    logged_out, message = client.logout()
    print(message)
    
    print("\n" + "=" * 80)
    print("✅ TEST WORKFLOW COMPLETED")
    print("=" * 80)
    
    return True

if __name__ == '__main__':
    success = main()
    exit(0 if success else 1)
