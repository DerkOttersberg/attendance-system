# Host Setup: Deployment to STM32

> **Location**: Deploy from your laptop to STM32MP157F-DK2

---

## Overview

This guide covers deploying all components (ImGui app and backend configuration) from your development machine to the STM32 device.

### Prerequisites

- M4 firmware deployed (see [SETUP_STM32_M4_FIRMWARE.md](SETUP_STM32_M4_FIRMWARE.md))
- ImGui binary built (see [SETUP_HOST_BUILD_GUI.md](SETUP_HOST_BUILD_GUI.md))
- Backend running (see [SETUP_HOST_BACKEND.md](SETUP_HOST_BACKEND.md))
- SSH access to STM32 device
- STM32 IP address

---

## Quick Deployment (5 minutes)

### Step 1: Verify STM32 is Accessible

```bash
# On your laptop:
ping <stm32-ip>

# Should get responses:
# PING 192.168.1.100: 56 data bytes
# 64 bytes from 192.168.1.100: icmp_seq=0 ttl=64 time=2.5 ms
```

### Step 2: Transfer ImGui Binary

```bash
# From your laptop:
scp ~/imgui_stm32/build/bin/imgui_app root@<stm32-ip>:/root/

# Make executable:
ssh root@<stm32-ip> chmod +x /root/imgui_app
```

### Step 3: Restart ImGui Service

```bash
# SSH into board:
ssh root@<stm32-ip>

# Restart service:
sudo systemctl restart imgui-app.service

# Verify it's running:
systemctl status imgui-app.service

# Check logs:
tail /root/imgui.log
```

### Step 4: Test Complete System

**On the touchscreen:**
- ImGui should be displaying
- Ready to scan RFID cards

**On your laptop:**
- Test backend connectivity from STM32:
  ```bash
  ssh root@<stm32-ip>
  curl http://<your-backend-ip>:5000/health
  # Should return: {"status": "ok"}
  ```

✅ **Success**: System is deployed and working!

---

## Full Deployment Process

### Deployment Checklist

Before deploying, verify these prerequisites are complete:

**M4 Firmware:**
- [ ] Compiled in STM32CubeIDE
- [ ] Transferred to `/lib/firmware/rproc-m4-fw.elf` on STM32
- [ ] Running: `cat /sys/class/remoteproc/remoteproc0/state` shows "running"

**ImGui Application:**
- [ ] Built on laptop: `~/imgui_stm32/build/bin/imgui_app` exists
- [ ] Verified as ARM binary: `file` command shows "ELF 32-bit"
- [ ] API_BASE_URL set to correct backend IP in code

**Backend Services:**
- [ ] Running on laptop/server with Docker
- [ ] Accessible: `curl http://localhost:5000/health` returns `{"status": "ok"}`
- [ ] Database initialized with schema

**Network:**
- [ ] STM32 has IP address: `ip addr show wlan0` shows `inet`
- [ ] STM32 can reach backend: `ping <backend-ip>` works
- [ ] Backend can reach STM32 (optional, for future notifications)

### Step-by-Step Deployment

#### 1. Configure Backend URL (On Your Laptop)

**Edit ImGui source** if backend IP has changed:

```bash
# Edit main.cpp:
cd ~/imgui_stm32
nano main.cpp

# Find this line:
#define API_BASE_URL "http://YOUR_BACKEND_IP:5000"

# Replace with actual IP (e.g., 192.168.1.50):
#define API_BASE_URL "http://192.168.1.50:5000"

# Save (Ctrl+O, Enter, Ctrl+X)
```

#### 2. Rebuild ImGui (If Needed)

```bash
# Only needed if you changed the code:
cd ~/imgui_stm32/build
make -j$(nproc)

# Verify:
ls -lh bin/imgui_app
```

#### 3. Transfer ImGui to STM32

```bash
# On your laptop:
scp ~/imgui_stm32/build/bin/imgui_app root@<stm32-ip>:/root/

# Verify transfer:
ssh root@<stm32-ip> ls -lh /root/imgui_app

# Should show the binary with correct size
```

#### 4. Make Binary Executable

```bash
# SSH into STM32:
ssh root@<stm32-ip>

# Set execute permission:
chmod +x /root/imgui_app

# Verify:
ls -la /root/imgui_app
# Should show: -rwxr-xr-x
```

#### 5. Restart ImGui Service

```bash
# Still on STM32:
sudo systemctl restart imgui-app.service

# Wait a few seconds for startup:
sleep 3

# Check status:
systemctl status imgui-app.service
```

#### 6. Verify Service Is Running

```bash
# Check service status:
sudo systemctl status imgui-app.service
# Should show "active (running)"

# Or check process:
ps aux | grep imgui_app

# View logs:
tail -20 /root/imgui.log
```

#### 7. Test on Touchscreen

The touchscreen should now display ImGui. Verify:
- GUI is visible and responsive
- Ready for RFID scan
- Touchscreen works (try tapping buttons)

#### 8. Test API Connectivity

```bash
# On STM32, test backend connection:
curl http://<backend-ip>:5000/health

# Expected: {"status": "ok"}

# Test API call simulation:
curl -X POST http://<backend-ip>:5000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"uid": "TEST123"}'

# Expected: {"action": "...", ...}
```

#### 9. Test Complete RFID Workflow

1. **Scan RFID card** near the reader on STM32
2. **ImGui should display** the card UID
3. **Signature prompt** appears (touchscreen)
4. **Sign on touchscreen** with finger
5. **Confirm submission**
6. **Check dashboard** at `http://backend-ip:8080` for attendance record

✅ **Complete**: System is fully deployed!

---

## Updating Deployments

### Update ImGui Application

When you make changes to ImGui code:

```bash
# 1. On laptop, edit code:
nano ~/imgui_stm32/main.cpp

# 2. Rebuild:
cd ~/imgui_stm32/build
make -j$(nproc)

# 3. Verify binary:
file bin/imgui_app

# 4. Transfer to STM32:
scp bin/imgui_app root@<stm32-ip>:/root/

# 5. On STM32, restart:
ssh root@<stm32-ip> systemctl restart imgui-app.service

# 6. Verify:
ssh root@<stm32-ip> systemctl status imgui-app.service
```

### Update Backend

When you update Flask code or database schema:

```bash
# On your laptop/server:
cd "product/Database & Dashbaord/releases/v1.5.2/My website"

# Option 1: Restart to reload code
docker-compose restart api

# Option 2: Rebuild with latest code
docker-compose up -d --build api

# Verify:
curl http://localhost:5000/health
```

### Update M4 Firmware

When you modify M4 firmware code:

```bash
# 1. On laptop in STM32CubeIDE:
#    - Edit code
#    - Build → Release version
#    - Verify no errors

# 2. Transfer .elf file:
scp Release/YourFirmware.elf root@<stm32-ip>:/lib/firmware/

# 3. On STM32, update symlink:
ssh root@<stm32-ip>
cd /lib/firmware
ln -sf YourFirmware.elf rproc-m4-fw.elf

# 4. Restart M4:
sudo systemctl restart m4-autostart.service

# 5. Verify:
cat /sys/class/remoteproc/remoteproc0/state  # Should show "running"
```

---

## Deployment Verification Tests

### Network Connectivity Test

```bash
# From your laptop:
ping <stm32-ip>
ssh root@<stm32-ip> "echo 'SSH works'"
scp <local-file> root@<stm32-ip>:/tmp/  # Should not error

# From STM32:
ping <backend-ip>
ping google.com
```

### M4 Firmware Test

```bash
# From STM32:
cat /sys/class/remoteproc/remoteproc0/state  # Should be "running"
cat /dev/ttyRPMSG0 &
echo "test" > /dev/ttyRPMSG0
# Should see response from M4
```

### ImGui Application Test

```bash
# From STM32:
systemctl status imgui-app.service  # Should be active
tail /root/imgui.log                # Should show no errors
ps aux | grep imgui_app             # Should show process running
```

### Backend Connectivity Test

```bash
# From STM32:
curl http://<backend-ip>:5000/health
curl http://<backend-ip>:8080        # Dashboard
```

### Dashboard Access Test

```bash
# From your laptop browser:
http://<backend-ip>:8080

# Should load dashboard showing:
# - Empty attendance list initially
# - User management interface
# - Reports section
```

---

## Troubleshooting Deployment Issues

### ImGui Binary Doesn't Transfer

```bash
# Check binary exists on laptop:
ls -lh ~/imgui_stm32/build/bin/imgui_app

# Check SSH connectivity:
ssh root@<stm32-ip> "ls /"

# If transfer fails, try alternate method:
# Connect via serial console and use FTP/SFTP
```

### ImGui Starts Then Crashes

```bash
# Check M4 is running first:
ssh root@<stm32-ip> cat /sys/class/remoteproc/remoteproc0/state

# If M4 not running, restart it:
ssh root@<stm32-ip> sudo systemctl restart m4-autostart.service
sleep 5

# Restart ImGui:
ssh root@<stm32-ip> sudo systemctl restart imgui-app.service

# View logs:
ssh root@<stm32-ip> tail /root/imgui.log
```

### API Connection Fails

```bash
# From STM32, test backend:
ssh root@<stm32-ip>
curl -v http://<backend-ip>:5000/health

# If timeout:
# 1. Verify backend IP is correct
# 2. Verify backend is running: curl http://localhost:5000/health (from your laptop)
# 3. Check firewall isn't blocking port 5000
# 4. Verify STM32 has internet access: ping google.com
```

### RFID Not Scanning

```bash
# Check M4 firmware is running:
ssh root@<stm32-ip> cat /sys/class/remoteproc/remoteproc0/state

# Check RPMSG device exists:
ssh root@<stm32-ip> ls -la /dev/ttyRPMSG*

# Test M4 communication:
ssh root@<stm32-ip>
cat /dev/ttyRPMSG0 &
echo "status" > /dev/ttyRPMSG0

# Should see M4 response
```

### Touchscreen Not Working

```bash
# Check touchscreen device exists:
ssh root@<stm32-ip> ls -la /dev/input/event*

# Try manual calibration:
ssh root@<stm32-ip> /usr/bin/ts_calibrate

# Test touch input:
ssh root@<stm32-ip> /usr/bin/ts_test
```

---

## Rollback Deployment

If deployment causes issues, rollback to previous version:

### Rollback ImGui

```bash
# If you have backup of previous binary:
scp ~/backup/imgui_app root@<stm32-ip>:/root/

# Or rebuild previous version from git:
cd ~/imgui_stm32
git log --oneline
git checkout <previous-commit>
cd build && make -j$(nproc)
scp bin/imgui_app root@<stm32-ip>:/root/

# Restart service:
ssh root@<stm32-ip> systemctl restart imgui-app.service
```

### Rollback M4 Firmware

```bash
# Update symlink to previous firmware version:
ssh root@<stm32-ip>
cd /lib/firmware
ln -sf m4_firmware_v1.0.0.elf rproc-m4-fw.elf  # Use previous version

# Restart M4:
sudo systemctl restart m4-autostart.service

# Verify:
cat /sys/class/remoteproc/remoteproc0/state
```

### Rollback Backend

```bash
# On your laptop:
cd "product/Database & Dashbaord/releases/v1.5.2/My website"

# Rollback database (if schema changed):
docker-compose down -v
docker-compose up -d

# Or restore backup:
docker-compose exec -T mysql mysql \
  -u rfid_user -prfid_pass rfid_attendance \
  < backup_previous.sql
```

---

## Production Deployment

### Pre-Production Checklist

- [ ] All code changes tested on development system
- [ ] Backup of current production database created
- [ ] Backup of current production binaries created
- [ ] Change log documented
- [ ] Rollback plan prepared
- [ ] Notification to users (if applicable)

### Deployment Steps

```bash
# 1. Create backup
ssh root@<production-stm32>
cp /root/imgui_app /root/imgui_app.backup
cp -r /lib/firmware /lib/firmware.backup

# 2. Deploy new version
# Follow steps from "Update ImGui Application" section above

# 3. Monitor
tail -f /root/imgui.log

# 4. Test thoroughly
# Scan multiple RFID cards
# Check dashboard records
# Verify all features work

# 5. If issues arise, rollback:
cp /root/imgui_app.backup /root/imgui_app
systemctl restart imgui-app.service
```

---

## Related Documentation

- [SETUP_HOST_BUILD_GUI.md](SETUP_HOST_BUILD_GUI.md) - Building ImGui
- [SETUP_HOST_BACKEND.md](SETUP_HOST_BACKEND.md) - Backend services
- [SETUP_STM32_M4_FIRMWARE.md](SETUP_STM32_M4_FIRMWARE.md) - M4 firmware
- [SETUP_STM32_IMGUI_KIOSK.md](SETUP_STM32_IMGUI_KIOSK.md) - ImGui deployment
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues

---

**Last Updated**: January 28, 2026
