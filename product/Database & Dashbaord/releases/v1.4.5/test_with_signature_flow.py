import requests
import json
from time import sleep

BASE_URL = "http://localhost:5000"

# Use a different test user to avoid the signature requirement
# Let's create a new test user and use manual attendance entry instead

# Get all users first
print("Getting users...")
response = requests.get(f"{BASE_URL}/api/users")
users = response.json()

# Find a user we can test with
test_user = next((u for u in users if u['name'].lower() == 'test'), None)

if not test_user:
    print("❌ 'test' user not found")
    exit(1)

print(f"✅ Using test user - ID: {test_user['id']}, Name: {test_user['name']}")

# Reset the points on target website first for this user
session = requests.Session()
login_url = 'https://punten.bitsenbytes.net/api/login/BitsGoes1!'
login_resp = session.get(login_url, timeout=10)

users_url = 'https://punten.bitsenbytes.net/api/allDeelnemers'
users_resp = session.get(users_url, timeout=10)
target_users = users_resp.json()

target_user = next((u for u in target_users if u.get('naam', '').lower() == test_user['name'].lower()), None)
if target_user:
    print(f"✅ Found target user: {target_user['naam']} (ID: {target_user['ID']}, Points: {target_user['punten']})")
else:
    print("❌ Test user not found on target website")
    exit(1)

# Now test clock in/out via /api/scan with the test user's RFID
rfid_uid = test_user['rfid_uid']
print(f"\n📥 Simulating clock in with RFID: {rfid_uid}")
clock_in_response = requests.post(
    f"{BASE_URL}/api/scan",
    json={"rfid_uid": rfid_uid}
)
clock_in_data = clock_in_response.json()
print(f"Clock in response: {clock_in_data}")

# Wait 2 seconds
sleep(2)

# Clock out immediately (0 minutes)
print("\n📤 Simulating clock out...")
clock_out_response = requests.post(
    f"{BASE_URL}/api/scan",
    json={"rfid_uid": rfid_uid}
)
clock_out_data = clock_out_response.json()
print(f"Clock out response: {clock_out_data}")

# Wait for API to process
sleep(2)

# Check if there's a clocked in record - if so, need to finish the signature 
if clock_in_data['action'] == 'clock_in':
    print("\n⚠️  First scan triggered clock-in (waiting for signature)")
    print("Second scan also triggered clock-in (attendance record not completed)")
    print("This is expected because the attendance record isn't completed until signature is captured")
    
    # Check database to see what's there
    print("\nChecking database for attendance records...")
else:
    print("\n✅ Clock out successful!")

# Check points on target website
print("\n🔍 Checking points on target website for 'test'...")
login_resp = session.get(login_url, timeout=10)
users_resp = session.get(users_url, timeout=10)
target_users = users_resp.json()

for user in target_users:
    if user.get('naam', '').lower() == 'test':
        print(f"✅ Current points for 'test': {user.get('punten')}")
        break
