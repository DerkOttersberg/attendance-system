# STM32MP157F-DK2: WiFi Configuration

> **Location**: On the STM32MP157F-DK2 device (Cortex-A7 Linux core)

---

## Overview

The STM32MP157F-DK2 includes a built-in WiFi module connected to the Cortex-A7 Linux core. This guide covers connecting to a WiFi network using `wpa_supplicant` with secure PSK authentication.

### Prerequisites

- SSH access to the STM32MP157F-DK2 board (via Ethernet or serial console)
- WiFi network SSID and password
- Board running OPENstLinux with WiFi drivers installed
- `wpa_supplicant` tool (usually pre-installed)

---

## Quick Start (5 minutes)

### Step 1: Generate Secure PSK Hash

On the **STM32 board** via SSH, generate a secure password hash:

```bash
ssh root@<stm32-ip>

# Generate PSK (replace with your WiFi credentials)
wpa_passphrase "BitsEnBytes" "WLanVanBitsEnBytes"
```

**Expected Output**:
```
network={
    ssid="BitsEnBytes"
    #psk="WLanVanBitsEnBytes"
    psk=e1eea16c4e9e3e9a4c5c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f
}
```

> **Note**: Copy the `psk=` hex string (64 characters). The `#psk=` line with plain password is just for reference and should NOT be used.

### Step 2: Update WiFi Configuration File

Edit the WiFi configuration on the STM32:

```bash
sudo nano /etc/wpa_supplicant/wpa_supplicant-wlan0.conf
```

Replace or add your network:

```ini
network={
    ssid="BitsEnBytes"
    psk=e1eea16c4e9e3e9a4c5c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f
}
```

**In nano editor:**
1. Find existing `network={}` block (or add new one)
2. Update `ssid` to your network name
3. Replace `psk=` with your generated hash
4. Remove or comment out any `#psk=` plain text line
5. Save: `Ctrl + O` → `Enter` → `Ctrl + X`

### Step 3: Restart WiFi Services

Apply the configuration:

```bash
sudo systemctl restart wpa_supplicant@wlan0
sudo systemctl restart udhcpc-wlan0
```

Wait 5-10 seconds for services to initialize.

### Step 4: Verify Connection

Check if you have an IP address:

```bash
ip addr show wlan0
```

**Expected Output** (you need an `inet` line):
```
3: wlan0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500
    inet 192.168.1.100/24 brd 192.168.1.255 scope global wlan0
    valid_lft forever preferred_lft forever
```

✅ **Success**: You have an IP address (e.g., `192.168.1.100`)

### Step 5: Test Internet Connectivity

```bash
ping -c 3 google.com
```

**Expected Output**:
```
PING google.com (142.250.185.46) 56(84) bytes of data.
64 bytes from 142.250.185.46: icmp_seq=1 ttl=119 time=25.4 ms
64 bytes from 142.250.185.46: icmp_seq=2 ttl=119 time=24.8 ms
64 bytes from 142.250.185.46: icmp_seq=3 ttl=119 time=25.1 ms

--- google.com statistics ---
3 packets transmitted, 3 received, 0% packet loss
```

✅ **Success**: WiFi is working!

---

## Make WiFi Persistent at Boot

To auto-connect on every restart:

```bash
sudo systemctl enable wpa_supplicant@wlan0
sudo systemctl enable udhcpc-wlan0
```

Verify:
```bash
systemctl is-enabled wpa_supplicant@wlan0   # Should output: enabled
systemctl is-enabled udhcpc-wlan0           # Should output: enabled
```

Reboot to test:
```bash
sudo reboot

# After reboot:
ip addr show wlan0  # Should have IP immediately
```

---

## Detailed Configuration

### Understanding the Configuration File

**File location:**
```
/etc/wpa_supplicant/wpa_supplicant-wlan0.conf
```

**Network block format:**
```ini
network={
    ssid="Your Network Name"      # Your WiFi SSID (must match exactly)
    psk=HEXSTRING               # 64-character hex PSK (NOT plain password)
}
```

### Multiple Networks

To store multiple networks (board will auto-connect to first available):

```ini
network={
    ssid="Network1"
    psk=HEX1
    priority=2
}

network={
    ssid="Network2"
    psk=HEX2
    priority=1
}
```

Higher `priority` value connects first.

### Advanced Options

For enterprise networks (WPA2-Enterprise):

```ini
network={
    ssid="CorporateNetwork"
    scan_ssid=1
    key_mgmt=WPA-EAP
    eap=PEAP
    identity="username"
    password="password"
}
```

---

## Troubleshooting

### Issue: No IP Address Assigned

**Symptom**: `ip addr show wlan0` shows no `inet` line

**Solution 1 - Check WiFi device is up:**
```bash
ip link show wlan0
# Should show: BROADCAST,MULTICAST,UP,LOWER_UP
```

**Solution 2 - Check DHCP logs:**
```bash
journalctl -u udhcpc-wlan0 -n 20
```

**Solution 3 - Manually reconnect:**
```bash
wpa_cli -i wlan0 reconnect
sleep 5
ip addr show wlan0
```

**Solution 4 - Restart services:**
```bash
sudo systemctl stop wpa_supplicant@wlan0 udhcpc-wlan0
sudo systemctl start wpa_supplicant@wlan0
sleep 2
sudo systemctl start udhcpc-wlan0
sleep 5
ip addr show wlan0
```

### Issue: WPA Handshake Failure

**Symptom**: Connection fails, system log shows WPA errors

**Check 1 - Verify configuration syntax:**
```bash
cat /etc/wpa_supplicant/wpa_supplicant-wlan0.conf
# PSK should be 64 hex characters, SSID should match exactly
```

**Check 2 - Regenerate PSK hash:**
```bash
wpa_passphrase "YourSSID" "YourPassword"
# Verify you copied the entire hex string correctly
```

**Check 3 - Test with manual wpa_cli:**
```bash
wpa_cli -i wlan0
> scan
> scan_results          # Find your SSID
> add_network
> set_network 0 ssid "YourSSID"
> set_network 0 psk YOURHEXSTRING
> enable_network 0
> status               # Check connection state
> quit
```

### Issue: Connection Works, Then Drops

**Symptom**: Initial connection succeeds, but WiFi drops after a few minutes

**Solution 1 - Check power management:**
```bash
# Disable WiFi power saving:
iw dev wlan0 set power_save off
```

**Solution 2 - Make permanent:**
Add to `/etc/wpa_supplicant/wpa_supplicant-wlan0.conf`:
```ini
network={
    ssid="YourNetwork"
    psk=HEXSTRING
    disabled=0
}
```

**Solution 3 - Check interface flapping:**
```bash
# Monitor in real-time:
journalctl -u wpa_supplicant@wlan0 -f
```

### Issue: Forgot WiFi Password

You can view the plaintext password if needed:

```bash
# The hash alone is useless without the original password
# You must re-run wpa_passphrase with the correct password
wpa_passphrase "SSID" "ActualPassword"
```

---

## Security Best Practices

1. **Always use PSK hash, never store plain passwords:**
   ✅ `psk=e1eea16c4e9e3e9a4c...` (good)
   ❌ `psk="password"` (bad)

2. **Change WiFi password regularly:**
   ```bash
   # Regenerate PSK hash
   wpa_passphrase "NewNetwork" "NewPassword"
   # Update config file
   ```

3. **Restrict SSH access:**
   ```bash
   # Only allow from local network:
   sudo nano /etc/ssh/sshd_config
   # Add: AllowUsers root@192.168.*.*
   ```

4. **Monitor network logs:**
   ```bash
   # Real-time connection logs:
   journalctl -u wpa_supplicant@wlan0 -f
   ```

---

## Manual Connection Control

If you need to manually manage WiFi:

```bash
# Disconnect
ip link set wlan0 down

# Reconnect
ip link set wlan0 up
sudo systemctl restart wpa_supplicant@wlan0
sudo systemctl restart udhcpc-wlan0

# Check current connection
wpa_cli -i wlan0 status

# Scan available networks
wpa_cli -i wlan0 scan
sleep 2
wpa_cli -i wlan0 scan_results
```

---

## Use Cases

### Testing WiFi Before Deployment

```bash
# Connect to temporary network:
wpa_passphrase "TestNetwork" "TestPassword" | \
  sudo tee /etc/wpa_supplicant/wpa_supplicant-wlan0.conf

# Restart services:
sudo systemctl restart wpa_supplicant@wlan0 udhcpc-wlan0

# Test connection:
ping google.com

# Verify ImGui can reach backend:
curl http://your-backend-ip:5000/health
```

### Monitor WiFi Quality

```bash
# Signal strength and link quality:
wpa_cli -i wlan0 signal_poll

# Expected output:
# RSSI=-45          # -30 to -90 dBm, -45 is good
# LINKSPEED=72      # Mbps
# NOISE=-95
# FREQUENCY=5180    # 2.4 GHz or 5 GHz
```

---

## Next Steps

Once WiFi is working:

1. **Verify backend connectivity:**
   ```bash
   curl http://<backend-ip>:5000/health
   ```

2. **Continue with M4 firmware setup:**
   See [SETUP_STM32_M4_FIRMWARE.md](SETUP_STM32_M4_FIRMWARE.md)

3. **Deploy ImGui application:**
   See [SETUP_STM32_IMGUI_KIOSK.md](SETUP_STM32_IMGUI_KIOSK.md)

---

## Related Documentation

- [SETUP_STM32_M4_FIRMWARE.md](SETUP_STM32_M4_FIRMWARE.md) - Deploy M4 firmware
- [SETUP_STM32_IMGUI_KIOSK.md](SETUP_STM32_IMGUI_KIOSK.md) - ImGui auto-start
- [HARDWARE_SETUP.md](HARDWARE_SETUP.md) - Wiring & hardware config
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Additional help

---

**Last Updated**: January 28, 2026
