# Troubleshooting Guide

> Solutions for common issues across the entire system

---

## Quick Reference by Symptom

### Device Issues

| Symptom | Quick Fix |
|---------|-----------|
| Touchscreen not responding | Recalibrate: `/usr/bin/ts_calibrate` |
| RFID not scanning | Check M4 running: `cat /sys/class/remoteproc/remoteproc0/state` |
| ImGui not showing | Verify Wayland: `ps aux \| grep wayland` |
| WiFi drops after few mins | Disable power saving: `iw dev wlan0 set power_save off` |
| No SSH access to board | Check IP: `ip addr show wlan0` on board |

### Backend Issues

| Symptom | Quick Fix |
|---------|-----------|
| API connection timeout | Check backend: `docker-compose ps` |
| Database not ready | Wait 30 seconds, then: `curl http://localhost:5000/health` |
| Dashboard blank | Check web service: `docker-compose logs web` |
| Port already in use | Find process: `lsof -i :5000` and kill |

### Deployment Issues

| Symptom | Quick Fix |
|---------|-----------|
| Binary transfer fails | Verify SSH: `ssh root@<ip> "echo ok"` |
| Service won't start | Check logs: `journalctl -u imgui-app.service -n 20` |
| Build fails on laptop | Update packages: `sudo apt update && sudo apt upgrade` |

---

## STM32 Device Troubleshooting

### WiFi Connection Issues

#### No WiFi Connection

**Check 1: WiFi device exists**
```bash
ip link show wlan0
# Should show: UP status
```

**Check 2: DHCP assigned IP**
```bash
ip addr show wlan0
# Should show: inet 192.168.x.x
```

**Check 3: Restart WiFi services**
```bash
sudo systemctl restart wpa_supplicant@wlan0 udhcpc-wlan0
sleep 5
ip addr show wlan0
```

**Check 4: Verify configuration**
```bash
cat /etc/wpa_supplicant/wpa_supplicant-wlan0.conf
# PSK must be 64 hex characters, SSID must match exactly
```

**Solution: Reconfigure WiFi**
See [SETUP_STM32_WIFI.md](SETUP_STM32_WIFI.md)

---

### M4 Firmware Issues

#### M4 Not Starting

**Check 1: Firmware file exists**
```bash
ls -la /lib/firmware/rproc-m4-fw.elf
file /lib/firmware/rproc-m4-fw.elf  # Should show ELF 32-bit
```

**Check 2: Remoteproc device available**
```bash
ls /sys/class/remoteproc/
cat /sys/class/remoteproc/remoteproc0/name  # Should show: m4
```

**Check 3: Manual start test**
```bash
cd /sys/class/remoteproc/remoteproc0
echo rproc-m4-fw.elf > firmware
echo start > state
cat state  # Should show "running"
```

**Check 4: View kernel messages**
```bash
dmesg | grep -i m4
dmesg | grep -i remoteproc
```

**Solution**: See [SETUP_STM32_M4_FIRMWARE.md](SETUP_STM32_M4_FIRMWARE.md#troubleshooting-m4-firmware)

---

#### M4 Communication Fails

**Symptom**: M4 starts (state = "running") but doesn't respond to commands

**Check 1: RPMSG device exists**
```bash
ls -la /dev/ttyRPMSG*
# Should show: /dev/ttyRPMSG0
```

**Check 2: Test M4 manually**
```bash
cat /dev/ttyRPMSG0 &
echo "test" > /dev/ttyRPMSG0
# M4 should respond (watch for output)
```

**Check 3: Check firmware logs**
```bash
timeout 5 cat /dev/ttyRPMSG0
# May show M4 debug output if firmware logs to RPMSG
```

**Solution**: M4 firmware may have crashed. See [SETUP_STM32_M4_FIRMWARE.md](SETUP_STM32_M4_FIRMWARE.md#m4-crashes-after-start)

---

### ImGui Application Issues

#### ImGui Won't Start

**Check 1: Binary exists and is executable**
```bash
ls -lh /root/imgui_app  # Should show -rwxr-xr-x
file /root/imgui_app    # Should show ELF 32-bit executable
```

**Check 2: M4 firmware running**
```bash
cat /sys/class/remoteproc/remoteproc0/state  # Should be "running"
```

**Check 3: Test manual execution**
```bash
/root/imgui_app
# Watch for errors on console
# Ctrl+C to exit
```

**Check 4: View service logs**
```bash
sudo journalctl -u imgui-app.service -n 50
tail /root/imgui.log
```

**Solution**: See [SETUP_STM32_IMGUI_KIOSK.md](SETUP_STM32_IMGUI_KIOSK.md#troubleshooting)

---

#### ImGui Crashes Repeatedly

**Symptom**: Service starts but stops within seconds (RestartSec kicks in)

**Check logs:**
```bash
tail -50 /root/imgui.log
journalctl -u imgui-app.service -n 100
```

**Common causes and solutions:**

1. **Cannot connect to Wayland**
   ```bash
   # Increase sleep time:
   sudo nano /etc/systemd/system/imgui-app.service
   # Change: ExecStartPre=/bin/sleep 20
   # To:     ExecStartPre=/bin/sleep 30
   sudo systemctl daemon-reload
   sudo systemctl restart imgui-app.service
   ```

2. **Backend not reachable**
   ```bash
   # Verify backend IP in code:
   nano /root/imgui_app  # Can't edit binary directly
   # Must rebuild with correct IP
   # See SETUP_HOST_BUILD_GUI.md for rebuild
   ```

3. **M4 not responding**
   ```bash
   # Check M4 status:
   cat /sys/class/remoteproc/remoteproc0/state
   sudo systemctl restart m4-autostart.service
   sleep 5
   sudo systemctl restart imgui-app.service
   ```

---

#### RFID Scanning Not Working

**Symptom**: ImGui running but card scans don't register

**Check 1: M4 firmware running**
```bash
cat /sys/class/remoteproc/remoteproc0/state  # Must be "running"
```

**Check 2: RPMSG device works**
```bash
cat /dev/ttyRPMSG0 &
echo "help" > /dev/ttyRPMSG0
# M4 should respond
```

**Check 3: Check M4 logs**
```bash
grep -i rfid /root/imgui.log
grep -i card /root/imgui.log
```

**Check 4: Verify RFID reader wiring**
See [HARDWARE_SETUP.md](HARDWARE_SETUP.md#wiring-diagram) - RC522 connections

**Solution**: 
- If wiring is correct, M4 firmware may not be detecting cards
- Check M4 firmware RC522 initialization in `mfrc522.c`

---

#### Touchscreen Not Responding

**Check 1: Touch device exists**
```bash
ls -la /dev/input/event*
```

**Check 2: Recalibrate touchscreen**
```bash
/usr/bin/ts_calibrate
# Follow on-screen prompts
```

**Check 3: Test touch input**
```bash
/usr/bin/ts_test
# Touch screen to verify calibration
```

---

### Hardware Issues

#### Board Won't Power On

**Check 1: USB cable**
- Must be data + power capable (not charge-only)
- Try different cable or USB port

**Check 2: Power LED**
- Should light up when powered
- If no LED, power supply may be faulty

**Check 3: External power**
- Try 5V 2A power adapter instead of USB

---

#### Touchscreen Broken/Unresponsive

**Check 1: Display backlight**
- Should illuminate when powered
- If dark, brightness may be off or connection loose

**Check 2: Damage**
- Physical cracks or water damage
- May require display replacement

**Check 3: Connection**
- Check ribbon cable connections on board
- Ensure not loose

---

## Backend Troubleshooting

### Docker Container Issues

#### Services Won't Start

**Check Docker is running:**
```bash
docker ps
# Should work without error
```

**Check compose file:**
```bash
cd "product/Database & Dashbaord/releases/v1.5.2/My website"
docker-compose config  # Validates syntax
```

**View startup logs:**
```bash
docker-compose up  # Without -d, shows all output
# Look for specific errors
```

---

#### MySQL Connection Refused

**Symptom**: API can't connect to database

**Check 1: MySQL container running**
```bash
docker-compose ps mysql
# Should show "Up" status
```

**Check 2: Wait for initialization**
```bash
# MySQL takes 10-15 seconds to initialize
sleep 15
docker-compose logs mysql | tail -5
# Should show "Server is ready for connections"
```

**Check 3: Restart sequence**
```bash
docker-compose stop mysql api
sleep 2
docker-compose start mysql
sleep 15  # Wait for MySQL to be ready
docker-compose start api
curl http://localhost:5000/health
```

---

#### Port Conflicts

**Symptom**: `bind: address already in use` error

**Find what's using port:**
```bash
# Windows:
netstat -ano | findstr :5000

# macOS/Linux:
lsof -i :5000
```

**Kill the process:**
```bash
kill -9 <PID>
```

**Or use different port** in `docker-compose.yml`:
```yaml
ports:
  - "5001:5000"  # Use 5001 instead
```

---

### API Issues

#### API Returning 500 Errors

**View API logs:**
```bash
docker-compose logs api | tail -100
```

**Common causes:**
1. **Database connection**: Check MySQL is running
2. **Missing package**: Rebuild: `docker-compose up -d --build api`
3. **Syntax error**: Check `api/app.py` for errors

---

#### Slow API Responses

**Check resource usage:**
```bash
docker stats api mysql
# Look for high CPU or memory usage
```

**Increase resources** in `docker-compose.yml`:
```yaml
services:
  api:
    mem_limit: 2g
    memswap_limit: 2g
```

---

### Dashboard Issues

#### Dashboard Won't Load

**Check web container:**
```bash
docker-compose ps web
# Should show "Up"
```

**View web server logs:**
```bash
docker-compose logs web
```

**Verify files exist:**
```bash
ls -la web/
# Should show dashboard.html, js/, css/
```

**Try direct URL:**
```bash
# If http://localhost:8080 doesn't work, try:
# http://127.0.0.1:8080
# Or IP address: http://192.168.1.100:8080
```

---

## Laptop/Development Machine Issues

### Build Failures

#### CMake Not Found

```bash
# Install CMake:
# Linux/WSL:
sudo apt install cmake

# macOS:
brew install cmake

# Verify:
cmake --version
```

---

#### ARM Compiler Not Found

```bash
# Check installation:
which arm-linux-gnueabihf-gcc

# Install:
# Linux/WSL:
sudo apt install gcc-arm-linux-gnueabihf

# macOS:
brew tap ArmCommunityProjects/gnu-embedded-toolchain-arm
brew install arm-none-eabi-gcc

# Verify:
arm-linux-gnueabihf-gcc --version
```

---

#### Build Hangs/Freezes

**Likely cause**: Insufficient resources

**Solution 1 - Reduce parallelism:**
```bash
cd build
make -j2  # Use 2 cores instead of all
```

**Solution 2 - Increase swap:**
```bash
# Linux: Check swap space
free -h
```

**Solution 3 - Clean rebuild:**
```bash
cd ~/imgui_stm32
rm -rf build
mkdir build && cd build
cmake ..
make -j$(nproc)
```

---

### Deployment Issues

#### SSH Connection Fails

**Check network:**
```bash
ping <stm32-ip>
# Should get responses
```

**Check SSH is enabled on board:**
```bash
# From another terminal with board access:
ps aux | grep sshd
# If not running: sudo systemctl start ssh
```

**Try with verbose:**
```bash
ssh -vvv root@<stm32-ip>
# Shows connection details and errors
```

---

#### SCP Transfer Slow or Hangs

**Try sftp instead:**
```bash
sftp root@<stm32-ip>
put imgui_app
quit
```

**Or use base64 encoding** (if network unreliable):
```bash
# Encode:
base64 imgui_app > imgui_app.b64

# Transfer file
scp imgui_app.b64 root@<stm32-ip>:/tmp/

# On STM32, decode:
ssh root@<stm32-ip>
base64 -d /tmp/imgui_app.b64 > /root/imgui_app
chmod +x /root/imgui_app
```

---

## System-Wide Diagnostics

### Complete Health Check Script

```bash
#!/bin/bash

echo "=== STM32 Device Check ==="
ping -c 1 <stm32-ip> && echo "✓ Network reachable" || echo "✗ Network unreachable"

echo ""
echo "=== M4 Firmware Check ==="
ssh root@<stm32-ip> "cat /sys/class/remoteproc/remoteproc0/state" | grep running && echo "✓ M4 running" || echo "✗ M4 not running"

echo ""
echo "=== ImGui Service Check ==="
ssh root@<stm32-ip> "systemctl is-active imgui-app.service" | grep active && echo "✓ ImGui active" || echo "✗ ImGui inactive"

echo ""
echo "=== Backend Check ==="
curl -s http://localhost:5000/health | grep ok && echo "✓ Backend responsive" || echo "✗ Backend not responding"

echo ""
echo "=== Database Check ==="
docker-compose ps mysql | grep Up && echo "✓ MySQL running" || echo "✗ MySQL not running"

echo ""
echo "=== Dashboard Check ==="
curl -s http://localhost:8080 | grep -q "dashboard" && echo "✓ Dashboard loaded" || echo "✗ Dashboard not responding"
```

---

## When All Else Fails

### Factory Reset STM32

```bash
# WARNING: This deletes all data!
# Only do this if nothing else works

# 1. Backup important data (if accessible):
ssh root@<stm32-ip> "tar czf /tmp/backup.tar.gz /root /etc"
scp root@<stm32-ip>:/tmp/backup.tar.gz ./backup.tar.gz

# 2. Reload default software (requires SD card with OS image)
# Follow STMicroelectronics' official reset procedure
```

### Start From Scratch

```bash
# 1. Verify board powers on
# 2. Re-flash OPENstLinux from official image
# 3. Reconfigure WiFi (SETUP_STM32_WIFI.md)
# 4. Redeploy M4 firmware (SETUP_STM32_M4_FIRMWARE.md)
# 5. Redeploy ImGui (SETUP_STM32_IMGUI_KIOSK.md)
# 6. Verify backend accessible
```

---

## Getting Help

### Gather Diagnostic Information

```bash
# On STM32:
mkdir /tmp/diagnostics
dmesg > /tmp/diagnostics/dmesg.log
journalctl -n 1000 > /tmp/diagnostics/journal.log
cat /sys/class/remoteproc/remoteproc0/state > /tmp/diagnostics/m4_state.log
systemctl status m4-autostart.service > /tmp/diagnostics/m4_service.log
systemctl status imgui-app.service > /tmp/diagnostics/imgui_service.log
tail -100 /root/imgui.log > /tmp/diagnostics/imgui_app.log

# Transfer to laptop:
scp -r root@<stm32-ip>:/tmp/diagnostics ./diagnostics/

# Include in bug report
```

### Common Questions

**Q: How do I know which version I'm running?**
```bash
# ImGui version:
grep -r "VERSION" ~/imgui_stm32/main.cpp

# M4 firmware version:
# Check: Product/STMCUBEIDE/dk2/Inc/config.h or README

# Backend version:
# Check: docker-compose.yml or releases folder name
```

**Q: How do I access the database?**
```bash
docker-compose exec mysql mysql -u rfid_user -p rfid_attendance
# Password: rfid_pass
```

**Q: Can I run multiple STM32 boards?**
```bash
Yes! Each board:
1. Gets unique WiFi IP
2. Points to same backend server
3. Can be deployed independently
```

---

## Related Documentation

- [SETUP_STM32_WIFI.md](SETUP_STM32_WIFI.md) - WiFi issues
- [SETUP_STM32_M4_FIRMWARE.md](SETUP_STM32_M4_FIRMWARE.md) - M4 issues
- [SETUP_STM32_IMGUI_KIOSK.md](SETUP_STM32_IMGUI_KIOSK.md) - ImGui issues
- [SETUP_HOST_BACKEND.md](SETUP_HOST_BACKEND.md) - Backend issues
- [HARDWARE_SETUP.md](HARDWARE_SETUP.md) - Hardware wiring

---

**Last Updated**: January 28, 2026
