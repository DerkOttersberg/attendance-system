import requests
import json
from time import sleep

BASE_URL = "http://localhost:5000"

# First, get the user ID
print("Getting users...")
response = requests.get(f"{BASE_URL}/api/users")
users = response.json()
testuserunique = next((u for u in users if u['name'] == 'testuserunique'), None)

if not testuserunique:
    print("❌ testuserunique not found")
    exit(1)

user_id = testuserunique['id']
rfid_uid = testuserunique['rfid_uid']
print(f"✅ Found testuserunique - ID: {user_id}, RFID: {rfid_uid}")

# Simulate clock in
print("\n📥 Simulating clock in...")
clock_in_response = requests.post(
    f"{BASE_URL}/api/scan",
    json={"rfid_uid": rfid_uid}
)
print(f"Clock in response: {clock_in_response.json()}")

# Wait 1 second
sleep(1)

# Simulate clock out immediately (0 minutes)
print("\n📤 Simulating clock out (0 minutes later)...")
clock_out_response = requests.post(
    f"{BASE_URL}/api/scan",
    json={"rfid_uid": rfid_uid}
)
print(f"Clock out response: {clock_out_response.json()}")

# Check points on target website
sleep(2)
print("\n🔍 Checking points on target website...")
import sys
sys.path.insert(0, '/work envoirment2')
from check_user_on_target import *

session = requests.Session()
login_url = 'https://punten.bitsenbytes.net/api/login/BitsGoes1!'
login_resp = session.get(login_url, timeout=10)

users_url = 'https://punten.bitsenbytes.net/api/allDeelnemers'
users_resp = session.get(users_url, timeout=10)
users = users_resp.json()

for user in users:
    if user.get('naam', '').lower() == 'testuserunique':
        print(f"✅ testuserunique points: {user.get('punten')}")
        break
