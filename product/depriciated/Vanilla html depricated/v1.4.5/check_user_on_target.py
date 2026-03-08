import requests

# Login to target website
session = requests.Session()
login_url = 'https://punten.bitsenbytes.net/api/login/BitsGoes1!'
login_resp = session.get(login_url, timeout=10)
print(f'Login status: {login_resp.status_code}')

# Get all users
users_url = 'https://punten.bitsenbytes.net/api/allDeelnemers'
users_resp = session.get(users_url, timeout=10)
users = users_resp.json()

print(f'\nTotal users on target website: {len(users)}')
print('\nSearching for testuserunique...')
found = False
for user in users:
    if 'testuserunique' in user.get('naam', '').lower():
        print(f'✅ Found: {user}')
        found = True
        break

if not found:
    print('❌ testuserunique NOT found on target website')
    print('\nFirst 10 users on target website:')
    for i, user in enumerate(users[:10]):
        print(f'  {i+1}. {user.get("naam")} (ID: {user.get("ID")}, Points: {user.get("punten")})')
