# STM32MP157F-DK2: ImGui Kiosk Mode Setup

> **Location**: Deploy on STM32MP157F-DK2 after building on your laptop

---

## Overview

The ImGui application runs in **kiosk mode** (full-screen, no desktop) on the Cortex-A7 Linux core. This guide covers deploying the pre-compiled ImGui application and setting it to auto-start at boot via systemd.

### Prerequisites

- ImGui binary already compiled on your laptop: `~/imgui_stm32/build/bin/imgui_app`
  - If not built yet, see [SETUP_HOST_BUILD_GUI.md](SETUP_HOST_BUILD_GUI.md)
- SSH access to STM32MP157F-DK2 board
- M4 firmware already deployed
  - If not done yet, see [SETUP_STM32_M4_FIRMWARE.md](SETUP_STM32_M4_FIRMWARE.md)
- WiFi or Ethernet connectivity configured
  - If not done yet, see [SETUP_STM32_WIFI.md](SETUP_STM32_WIFI.md)

---

## Quick Start (5 minutes)

### Step 1: Transfer ImGui Binary (On Your Laptop)

Copy the compiled ImGui application to the STM32 board:

```bash
# From your laptop (where you built ImGui):
scp ~/imgui_stm32/build/bin/imgui_app root@<stm32-ip>:/root/

# Replace <stm32-ip> with your board's IP address
```

### Step 2: Make Binary Executable (On STM32 Board)

SSH into the board and set permissions:

```bash
ssh root@<stm32-ip>

# Make binary executable
chmod +x /root/imgui_app

# Verify
ls -lh /root/imgui_app  # Should show -rwxr-xr-x
file /root/imgui_app    # Should show ELF 32-bit executable
```

### Step 3: Test Manual Execution (On STM32 Board)

Run ImGui application manually to verify it works:

```bash
# First, ensure M4 firmware is running:
cat /sys/class/remoteproc/remoteproc0/state  # Should show "running"

# Run ImGui (will display on touchscreen):
/root/imgui_app

# Expected: Touchscreen shows ImGui interface
# Press Ctrl+C to stop (or on-screen exit button)
```

✅ **Success**: ImGui displays on the touchscreen!

### Step 4: Create systemd Service File (On STM32 Board)

Create the service for auto-start:

```bash
sudo nano /etc/systemd/system/imgui-app.service
```

**Copy this configuration:**

```ini
[Unit]
Description=IMGUI Application
After=m4-autostart.service graphical.target
Requires=graphical.target

[Service]
Type=simple
User=root
WorkingDirectory=/root
ExecStartPre=/bin/sleep 20
ExecStart=/root/imgui_app
Restart=always
RestartSec=10

Environment=WAYLAND_DISPLAY=wayland-0
Environment=XDG_RUNTIME_DIR=/run/user/1000

StandardOutput=append:/root/imgui.log
StandardError=append:/root/imgui.log

[Install]
WantedBy=multi-user.target
```

**Save**: `Ctrl + O` → `Enter` → `Ctrl + X`

### Step 5: Enable & Start ImGui Service (On STM32 Board)

```bash
# Reload systemd daemon
sudo systemctl daemon-reload

# Enable auto-start at boot
sudo systemctl enable imgui-app.service

# Start the service now
sudo systemctl start imgui-app.service

# Verify it's running
sudo systemctl status imgui-app.service
```

**Expected Output**:
```
● imgui-app.service - IMGUI Application
     Loaded: loaded (...; enabled; ...)
     Active: active (running) since ...
```

### Step 6: Verify on Touchscreen (On STM32)

The touchscreen should now display the ImGui application within 30 seconds. You should see:
- Clock-in/out screen
- Ready to scan RFID cards
- Green/red LED feedback
- Touch input responsive

### Step 7: Test RFID Integration (On STM32)

```bash
# Scan an RFID card near the reader
# ImGui should display:
# - Card UID detected
# - "Awaiting signature" prompt
# - Signature area ready for touch input

# Check application logs:
tail /root/imgui.log

# Expected output shows API calls and RFID data
```

### Step 8: Reboot and Verify (On STM32 Board)

Test that ImGui auto-starts after reboot:

```bash
sudo reboot

# After reboot (wait 50 seconds for M4 + ImGui to start):
ssh root@<stm32-ip>

# Verify service is running:
systemctl status imgui-app.service

# Check logs:
tail /root/imgui.log
```

✅ **Success**: ImGui is running and auto-starting!

---

## Detailed Configuration

### systemd Service Breakdown

**Service File**: `/etc/systemd/system/imgui-app.service`

| Parameter | Purpose | Value |
|-----------|---------|-------|
| `Description` | Service name in logs | IMGUI Application |
| `After=m4-autostart.service` | Wait for M4 to start first | Ensures RFID is ready |
| `After=graphical.target` | Wait for graphics initialized | Required for Wayland |
| `Requires=graphical.target` | Hard requirement for graphics | Fail if graphics unavailable |
| `Type=simple` | Service stays running | (vs `oneshot`) |
| `User=root` | Run as root | Needed for hardware access |
| `WorkingDirectory=/root` | Set working directory | For relative paths |
| `ExecStartPre=/bin/sleep 20` | Wait 20 seconds before start | Allow M4 + graphics to initialize |
| `ExecStart=/root/imgui_app` | Command to run | Path to compiled binary |
| `Restart=always` | Auto-restart on crash | Keeps kiosk running |
| `RestartSec=10` | Wait 10 sec between restarts | Avoid restart storms |
| `WAYLAND_DISPLAY=wayland-0` | Use Wayland display server | Modern graphics stack |
| `XDG_RUNTIME_DIR=/run/user/1000` | Wayland runtime directory | Required by Wayland |
| `StandardOutput=append:/root/imgui.log` | Redirect stdout | Log file at `/root/imgui.log` |
| `StandardError=append:/root/imgui.log` | Redirect stderr | Captures errors |
| `WantedBy=multi-user.target` | Enable at boot | Auto-start enabled |

### Boot Sequence

When you reboot the STM32, this is what happens:

```
Time    Event                                      Service
───────────────────────────────────────────────────────────
0s      Power-on → u-Boot → Kernel loading       (kernel)
20s     Cortex-A7 Linux kernel ready             (multi-user.target)
25s     m4-autostart.service starts               m4-autostart
        └─ M4 core loads & initializes           
27s     M4 firmware fully running                 (M4 ready)
28s     graphical.target reaches (Wayland init)  (graphics)
35s     imgui-app.service starts                 imgui-app
        └─ Wait 20 sec for M4 + graphics
55s     ImGui application displays on touchscreen ✅ Ready!
```

---

## Service Management

### View Service Status

```bash
# Current status:
sudo systemctl status imgui-app.service

# Auto-start enabled?
systemctl is-enabled imgui-app.service  # Should output: enabled

# View service dependencies:
sudo systemctl list-dependencies imgui-app.service

# View activation time:
sudo systemctl show imgui-app.service -p ActiveEnterTimestamp
```

### Control ImGui Service

```bash
# Start service:
sudo systemctl start imgui-app.service

# Stop service:
sudo systemctl stop imgui-app.service

# Restart service (useful after updates):
sudo systemctl restart imgui-app.service

# View real-time logs:
journalctl -u imgui-app.service -f

# View last 50 lines:
journalctl -u imgui-app.service -n 50
```

### Enable/Disable Auto-Start

```bash
# Enable auto-start (default):
sudo systemctl enable imgui-app.service

# Disable auto-start (manual start only):
sudo systemctl disable imgui-app.service

# Check current state:
systemctl is-enabled imgui-app.service
# Output: enabled or disabled
```

---

## Logs & Debugging

### View Application Logs

The ImGui application logs to `/root/imgui.log`:

```bash
# View all logs:
cat /root/imgui.log

# View last 100 lines:
tail -100 /root/imgui.log

# Follow logs in real-time:
tail -f /root/imgui.log

# Watch for new events:
watch -n 1 'tail -10 /root/imgui.log'
```

### Expected Log Output

```
[INIT] ImGui application starting...
[INIT] Initializing Wayland display...
[INIT] Loading ImGui context...
[RPMSG] Connecting to M4 firmware via /dev/ttyRPMSG0...
[RPMSG] M4 firmware handshake received
[API] Backend URL: http://192.168.1.50:5000
[API] Connected to Flask API
[RENDER] Starting render loop at 60 FPS...
[RFID] Ready for card scan
```

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `Cannot connect to /dev/ttyRPMSG0` | M4 not running | Run `systemctl status m4-autostart.service` |
| `Wayland connection failed` | Graphics not ready | Increase `ExecStartPre` sleep time to 30s |
| `Address already in use` | ImGui running twice | Check: `ps aux \| grep imgui_app` |
| `Cannot open touchscreen` | Wrong device | Verify: `ls -la /dev/input/event*` |
| `API connection timeout` | Backend unreachable | Verify backend is running: `curl http://backend-ip:5000/health` |

---

## Updating ImGui Application

### When You Modify ImGui Code

1. **On your laptop**, rebuild:
   ```bash
   cd ~/imgui_stm32/build
   make -j$(nproc)
   ```

2. **Transfer new binary:**
   ```bash
   scp bin/imgui_app root@<stm32-ip>:/root/
   ```

3. **On STM32, restart service:**
   ```bash
   sudo systemctl restart imgui-app.service
   ```

4. **Verify:**
   ```bash
   systemctl status imgui-app.service
   tail /root/imgui.log
   ```

### Deployment Workflow

```
Laptop               STM32 Board
───────────────────────────────
Edit code   
│
Build       
│
Test        
│
Transfer ──────► /root/imgui_app
│
           Restart service
           │
           Check logs
           │
         ✅ Running
```

---

## Kiosk Mode Features

### Full-Screen Display

ImGui displays full-screen without desktop:
- No taskbar, no menu bar
- Maximized window
- Touchscreen captures all input
- Exits only via application logic

### On-Screen Controls

Users can:
- Scan RFID cards
- Sign on touchscreen (capture signature)
- View clock-in/out status
- Access admin menu (with PIN)
- Trigger LED/buzzer feedback

### Auto-Restart on Crash

If ImGui crashes:
- systemd automatically restarts it (within 10 seconds)
- Users don't need to manually recover
- Logs all crashes for debugging

### Multiple Instances Prevention

Only one ImGui instance can run:
```bash
# Check how many instances running:
ps aux | grep imgui_app

# If stuck, kill manually:
sudo killall imgui_app
# Service will auto-restart
```

---

## Advanced Configuration

### Adjust Sleep Delay Before Start

If M4 takes longer to initialize, increase sleep time:

```bash
# Edit service:
sudo nano /etc/systemd/system/imgui-app.service

# Change this line:
ExecStartPre=/bin/sleep 20    # Change 20 to 30 or more

# Reload and restart:
sudo systemctl daemon-reload
sudo systemctl restart imgui-app.service
```

### Change Backend API URL

If your backend is on a different IP:

**Option 1 - Edit in code and rebuild** (recommended):
```cpp
// In main.cpp:
#define API_BASE_URL "http://192.168.1.50:5000"
// Rebuild and redeploy
```

**Option 2 - Environment variable** (if supported):
```bash
# Edit service file:
sudo nano /etc/systemd/system/imgui-app.service

# Add environment variable:
Environment=API_BASE_URL=http://192.168.1.50:5000

# Reload and restart:
sudo systemctl daemon-reload
sudo systemctl restart imgui-app.service
```

### Capture Output to File

To log all output (stdout + stderr):

```bash
# Already configured in service:
StandardOutput=append:/root/imgui.log
StandardError=append:/root/imgui.log

# View logs:
tail -f /root/imgui.log
```

---

## Troubleshooting

### ImGui Won't Start

**Check 1 - Binary exists and is executable:**
```bash
ls -la /root/imgui_app
# Should show: -rwxr-xr-x (executable bit set)
```

**Check 2 - Test manual run:**
```bash
# Verify M4 is running first:
cat /sys/class/remoteproc/remoteproc0/state  # Should show "running"

# Try running directly:
/root/imgui_app

# Watch for errors on console
# Ctrl+C to stop
```

**Check 3 - Check service logs:**
```bash
sudo journalctl -u imgui-app.service -n 50
sudo systemctl status imgui-app.service

# View application logs:
tail /root/imgui.log
```

**Check 4 - Verify dependencies:**
```bash
# Check required libraries:
ldd /root/imgui_app

# Should show: libglfw3.so, libGLESv2.so.2, libEGL.so.1
# If any are missing, rebuild ImGui with correct libraries
```

### ImGui Crashes Immediately

**Symptom**: Service starts but stops within a few seconds

**Check logs:**
```bash
tail -20 /root/imgui.log

# Common causes:
# - Cannot connect to Wayland
# - Missing touchscreen device
# - Backend API unreachable
# - Out of memory
```

**Solution:**
```bash
# Increase sleep time for graphics initialization:
sudo nano /etc/systemd/system/imgui-app.service
# Change: ExecStartPre=/bin/sleep 20
# To:     ExecStartPre=/bin/sleep 30

sudo systemctl daemon-reload
sudo systemctl restart imgui-app.service
```

### ImGui Won't Display on Touchscreen

**Check 1 - Graphics initialized:**
```bash
# Verify Wayland is running:
ps aux | grep wayland
ps aux | grep weston  # Alternative graphics server

# Or check:
ls /run/user/1000/wayland-0  # Should exist
```

**Check 2 - Display device:**
```bash
# Check for display devices:
ls /dev/dri/
ls /dev/fb*

# Verify FRAMEBUFFER or DISPLAY env var if needed
```

**Check 3 - Manual test:**
```bash
# Run with explicit display (if needed):
export WAYLAND_DISPLAY=wayland-0
export XDG_RUNTIME_DIR=/run/user/1000
/root/imgui_app
```

### ImGui Scanning RFID Not Working

**Check 1 - M4 firmware running:**
```bash
cat /sys/class/remoteproc/remoteproc0/state  # Should show "running"
```

**Check 2 - RPMSG device:**
```bash
ls -la /dev/ttyRPMSG*  # Should show /dev/ttyRPMSG0
```

**Check 3 - Test M4 directly:**
```bash
cat /dev/ttyRPMSG0 &
echo "test" > /dev/ttyRPMSG0
# M4 should respond
```

**Check 4 - Check ImGui logs for RPMSG errors:**
```bash
grep -i rpmsg /root/imgui.log
grep -i card /root/imgui.log
```

### Service Restart Loop

**Symptom**: ImGui keeps restarting every 10 seconds (in a loop)

**Cause**: ImGui crashes immediately and systemd restarts it

**Check logs:**
```bash
tail -100 /root/imgui.log  # Look for specific error
journalctl -u imgui-app.service -n 100
```

**Temporary fix - disable auto-restart:**
```bash
sudo systemctl stop imgui-app.service

# Edit service to disable restart:
sudo nano /etc/systemd/system/imgui-app.service
# Change: Restart=always
# To:     Restart=no

sudo systemctl daemon-reload

# Now try to run manually and capture full error:
/root/imgui_app 2>&1 | tee /tmp/imgui_error.log
```

---

## Next Steps

1. **Test complete system:**
   ```bash
   # Scan RFID card on device
   # Verify ImGui receives UID
   # Check backend receives API call
   ```

2. **Configure backend API URL** if on different server

3. **Test RFID workflow:**
   - Scan card
   - Capture signature on touchscreen
   - Verify attendance recorded in database

4. **Access web dashboard:**
   - Open http://backend-ip:8080 in browser
   - Verify attendance record appears

---

## Related Documentation

- [SETUP_STM32_WIFI.md](SETUP_STM32_WIFI.md) - WiFi configuration
- [SETUP_STM32_M4_FIRMWARE.md](SETUP_STM32_M4_FIRMWARE.md) - M4 firmware deployment
- [SETUP_HOST_BUILD_GUI.md](SETUP_HOST_BUILD_GUI.md) - Building ImGui on laptop
- [HARDWARE_SETUP.md](HARDWARE_SETUP.md) - Touchscreen & hardware
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Additional help
- [GUI_IMGUI.md](GUI_IMGUI.md) - ImGui application internals

---

**Last Updated**: January 28, 2026
