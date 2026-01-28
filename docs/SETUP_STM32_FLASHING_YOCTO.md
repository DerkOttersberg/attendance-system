# Flashing Yocto Linux on STM32MP157F-DK2

> Complete guide for flashing the OPENstLinux Yocto image on the STM32MP157F-DK2 SD card

---

## Overview

The STM32MP157F-DK2 boots from an SD card containing:
- **SPL (Secondary Program Loader)** - M4 bootloader and device tree
- **U-Boot** - ARM bootloader for A7 core
- **Yocto Linux** - OPENstLinux operating system for A7 core
- **Root filesystem** - Linux filesystem with tools, libraries, and applications

**Process**:
1. Download Yocto image from STMicroelectronics
2. Write image to SD card (Windows/Mac/Linux)
3. Insert SD card into STM32MP157F-DK2
4. Boot and perform initial setup

---

## Prerequisites

### Hardware

- **STM32MP157F-DK2 board**
- **microSD card** (minimum 8GB, Class 10 recommended)
- **microSD card reader** (USB adapter)
- **USB Type-B cable** (for serial console, optional but recommended)
- **5V power adapter** (2A or higher)

### Software

- **Yocto image file** (from STMicroelectronics, ~1.5GB)
  - Download from: https://wiki.st.com/stm32mpu/wiki/STM32MP1_Distribution_Package
  - File: `st-image-core-openstlinux-weston-stm32mp1-dk2.img` or similar
- **Image writer tool:**
  - **Windows**: Etcher, Win32DiskImager
  - **macOS**: Etcher, dd utility
  - **Linux**: Etcher, dd utility, GNOME Disks

### Network (optional for headless setup)

- Ethernet cable for network access
- Serial USB adapter for console (recommended for troubleshooting)

---

## Step 1: Download Yocto Image

### Option A: From STMicroelectronics Official Repository

1. **Visit STM32MP1 wiki**:
   ```
   https://wiki.st.com/stm32mpu/wiki/STM32MP1_Distribution_Package
   ```

2. **Download latest release**:
   - Find latest stable version (e.g., "Mickledore", "Langdale")
   - Download `st-image-core-openstlinux-weston-stm32mp1-dk2-*.img.gz`
   - Size: ~500MB compressed, ~1.5GB uncompressed

3. **Verify MD5 checksum** (important for data integrity):
   ```bash
   # On macOS/Linux:
   md5sum st-image-core-openstlinux-weston-stm32mp1-dk2-*.img.gz
   # Compare with published checksum on wiki

   # On Windows (PowerShell):
   Get-FileHash st-image-core-openstlinux-weston-stm32mp1-dk2-*.img.gz -Algorithm MD5
   ```

### Option B: Decompress Image

If downloaded as `.gz`:

```bash
# macOS/Linux:
gunzip st-image-core-openstlinux-weston-stm32mp1-dk2-*.img.gz
# Result: st-image-core-openstlinux-weston-stm32mp1-dk2-*.img

# Windows (7-Zip or similar):
# Right-click → Extract
```

---

## Step 2: Identify SD Card Device

### On Windows

1. Insert SD card into USB reader
2. Open **Disk Management**:
   ```
   Win + X → Disk Management
   ```
3. Identify SD card (e.g., `Disk 2`, check size ~8GB)
4. **Note the disk number** (e.g., `\\.\PhysicalDrive2`)

```
Device ID: Disk 2
Size: 8 GB
Status: Online
```

### On macOS

1. Insert SD card into reader
2. Open Terminal:
   ```bash
   diskutil list
   ```
3. Find SD card (usually `/dev/disk2` or higher)

```
/dev/disk2 (external):
  #:                       TYPE NAME         SIZE       IDENTIFIER
  0:     FDisk_partition_scheme               8.0 GB     disk2
  1:                  DOS_FAT_32 BOOT         512.0 MB   disk2s1
```

4. **Unmount the disk** (don't eject):
   ```bash
   diskutil unmountDisk /dev/disk2
   # Unmount of all volumes on disk2 was successful
   ```

### On Linux

1. Insert SD card into reader
2. Open Terminal:
   ```bash
   lsblk
   # or
   fdisk -l
   ```
3. Find SD card (e.g., `/dev/sdc` or `/dev/mmcblk0`)

```
NAME        MAJ:MIN RM  SIZE RO TYPE MOUNTPOINTS
sdc           8:32   1  7.5G  0 disk
├─sdc1        8:33   1  512M  0 part /media/user/BOOT
└─sdc2        8:34   1  7.0G  0 part /media/user/ROOT
```

4. **Unmount all partitions**:
   ```bash
   sudo umount /dev/sdc1
   sudo umount /dev/sdc2
   ```

---

## Step 3: Write Image to SD Card

### Option A: Using Balena Etcher (Recommended - All Platforms)

**Simplest and safest method**

1. **Download Etcher**:
   ```
   https://www.balena.io/etcher/
   ```

2. **Install and launch Etcher**

3. **Select image**:
   - Click "Flash from file"
   - Navigate to: `st-image-core-openstlinux-weston-stm32mp1-dk2-*.img`

4. **Select target**:
   - Click "Select target"
   - Choose your SD card (8 GB device)
   - **Verify this is correct - selecting wrong drive will erase it!**

5. **Flash**:
   - Click "Flash"
   - Wait for verification (5-15 minutes)
   - "Flash Complete!" message

---

### Option B: Using Win32DiskImager (Windows)

1. **Download**:
   ```
   https://sourceforge.net/projects/win32diskimager/
   ```

2. **Run as Administrator**

3. **Select image**:
   - Click folder icon
   - Choose: `st-image-core-openstlinux-weston-stm32mp1-dk2-*.img`

4. **Select device**:
   - Device dropdown → Select disk (e.g., `\\.\PhysicalDrive2`)
   - **Verify size matches your SD card!**

5. **Write**:
   - Click "Write"
   - Confirm warning
   - Wait for completion

---

### Option C: Using dd Command (macOS/Linux)

**Most flexible but requires care - wrong target will erase laptop data!**

```bash
# 1. Verify device (CRITICAL):
diskutil list    # macOS
lsblk             # Linux

# 2. Unmount all partitions:
diskutil unmountDisk /dev/disk2    # macOS
sudo umount /dev/sdc*               # Linux

# 3. Write image (use /dev/rdisk2 on macOS for speed):
sudo dd if=st-image-core-openstlinux-weston-stm32mp1-dk2-*.img \
        of=/dev/disk2 \
        bs=4M \
        conv=fsync

# 4. Monitor progress (in another terminal):
# macOS:
sudo kill -INFO <dd-process-pid>
# Linux:
sudo watch -n 1 'killall -USR1 dd'

# 5. Verify (after dd completes):
sudo diskutil eject /dev/disk2
# Eject failed: it's working correctly if still mounted
```

**Expected output**:
```
380+1 records in
380+1 records out
1610612736 bytes transferred in 45.234 secs (35.6 MB/s)
```

---

## Step 4: Prepare SD Card

### After Writing Image

1. **Eject SD card safely** (from file manager or terminal):
   ```bash
   # macOS:
   diskutil eject /dev/disk2
   
   # Linux:
   sudo eject /dev/sdc
   
   # Windows:
   Right-click drive → Eject
   ```

2. **Verify image was written**:
   - Remove and reinsert SD card
   - Should show partitions:
     - `BOOT` partition (512 MB, FAT32)
     - `ROOT` partition (rest of card, ext4)

3. **Optional: Verify files**:
   ```bash
   # List BOOT partition contents (if accessible):
   ls /media/user/BOOT
   # Should show: Image, stm32mp157f-dk2.dtb, boot.scr, etc.
   ```

---

## Step 5: Insert SD Card into STM32MP157F-DK2

### Physical Installation

1. **Power off the board** (disconnect USB/power adapter)

2. **Locate SD card slot**:
   - Bottom of board
   - Typically on edge near UART/Ethernet connectors

3. **Insert SD card**:
   - Push card in **until it clicks** (spring-loaded)
   - Label side should face up
   - Do NOT force - should slide smoothly

4. **Verify insertion**:
   - Card should be partially inserted (half sticking out)
   - Pressing gently should spring-eject it

---

## Step 6: Boot STM32MP157F-DK2

### Initial Boot

1. **Connect power**:
   - 5V adapter to power jack, OR
   - USB-C with power delivery

2. **Watch for LED indicators**:
   - Power LED should light up (usually red/green)
   - Board should start booting

3. **Boot sequence (30-60 seconds)**:
   ```
   SPL boots M4 core
      ↓
   U-Boot loads kernel
      ↓
   Linux kernel initializes
      ↓
   Systemd starts services
      ↓
   Weston display server starts (if HDMI connected)
      ↓
   Ready for login
   ```

### Verify Boot via Serial Console (Recommended)

**Setup USB serial adapter:**

1. **Connect adapter**:
   - **TX → RX** pin (UART connector on board)
   - **RX → TX** pin
   - **GND → GND**

2. **Open serial terminal**:
   ```bash
   # macOS:
   screen /dev/tty.usbserial-* 115200
   
   # Linux:
   sudo minicom -D /dev/ttyUSB0 -b 115200
   
   # Windows:
   Use PuTTY or Tera Term: COM port, 115200 baud
   ```

3. **Boot messages**:
   ```
   U-Boot SPL 2022.10 (Jan 01 2023 - 00:00:00 +0000)
   Trying to boot from MMC1
   NOTICE:  BL2: v2.7
   NOTICE:  BL2: Built : ...
   ```

4. **Login prompt appears**:
   ```
   root@st-image-core-openstlinux-weston-stm32mp1-dk2:~#
   ```

---

## Step 7: First Boot Configuration

### Default Credentials

**Username**: `root`
**Password**: (no password, or `root`)

```bash
root@st-image-core-openstlinux-weston-stm32mp1-dk2:~# _
```

### Essential First Commands

```bash
# 1. Check system information:
uname -a
# Output: Linux st-image-core-openstlinux-weston-stm32mp1-dk2 ...

# 2. Check M4 core status:
cat /sys/class/remoteproc/remoteproc0/name
# Output: m4

# 3. Check memory:
free -h
# Output: Mem: 976M total

# 4. Check network (if Ethernet connected):
ifconfig
# Should show eth0, wlan0 (if WiFi module)

# 5. Check time/date:
date
# Set if incorrect: sudo date -s "2026-01-28 10:30:00"
```

---

## Step 8: Network Configuration

### Ethernet (if available)

```bash
# Check if connected:
ifconfig eth0

# Get DHCP IP:
sudo dhclient eth0

# Or set static IP:
sudo ifconfig eth0 192.168.1.100 netmask 255.255.255.0
sudo route add default gw 192.168.1.1
```

### WiFi Configuration

See [SETUP_STM32_WIFI.md](SETUP_STM32_WIFI.md) for complete WiFi setup guide.

---

## Step 9: Enable SSH Access (for remote development)

```bash
# 1. Start SSH service:
sudo systemctl start sshd

# 2. Enable on boot:
sudo systemctl enable sshd

# 3. Set root password (for SSH access):
sudo passwd root
# Enter new password twice

# 4. Test SSH from laptop:
ssh root@<board-ip>
# Should prompt for password
```

**Get board IP**:
```bash
# On board:
hostname -I
# Output: 192.168.1.100

# From laptop:
ssh root@192.168.1.100
```

---

## Troubleshooting

### Board Won't Boot

**Symptom**: No LED activity, no serial output

**Check 1: Power supply**
```bash
# Measure voltage at power jack:
# Should be ~5V DC
```

**Check 2: SD card insertion**
- Remove and reinsert
- Ensure card clicks into place
- Try different SD card

**Check 3: Image written correctly**
- Check SD card partitions on laptop
- Should show BOOT and ROOT partitions
- Re-flash using Etcher if unsure

---

### Stuck During Boot

**Symptom**: Gets to U-Boot prompt but won't load kernel

**Solution 1: Serial console boot**
```
Hit any key to stop autoboot: 3
# At U-Boot prompt:
bootcmd
# This will show boot command
```

**Solution 2: Rebuild boot partition**
- Reflash image (erase and re-flash entire SD card)

---

### "root filesystem requires a password for maintenance"

**Symptom**: Shows fsck error after boot

**Fix**:
```bash
# Press Enter for maintenance mode
# Type: fsck -a /dev/mmcblk0p2
# Then: exit
```

---

### Network Not Working

**Check Ethernet**:
```bash
ip link show
# Should show eth0 (UP if connected)

sudo ethtool eth0
# Shows connection info
```

**Check WiFi**:
See [SETUP_STM32_WIFI.md](SETUP_STM32_WIFI.md#troubleshooting)

---

### Serial Console Not Showing Output

**Check USB adapter**:
- Try different USB port
- Verify TX/RX connections (may be swapped)
- Check baud rate (should be 115200)

**On board**:
```bash
# Check serial port is working:
echo "test" > /dev/ttySTM0
```

---

## Backup Current Setup

### Create Backup Image

**After successful setup**, backup SD card:

```bash
# macOS/Linux:
sudo dd if=/dev/disk2 \
        of=stm32mp157f-dk2-backup-$(date +%Y%m%d).img \
        bs=4M \
        conv=fsync

# Verify backup:
ls -lh stm32mp157f-dk2-backup-*.img
```

This backup includes:
- All configurations
- Installed packages
- M4 firmware auto-start
- ImGui application (if already deployed)

---

## Next Steps

After successful boot:

1. [SETUP_STM32_WIFI.md](SETUP_STM32_WIFI.md) - Configure WiFi
2. [SETUP_STM32_M4_FIRMWARE.md](SETUP_STM32_M4_FIRMWARE.md) - Deploy M4 firmware
3. [SETUP_STM32_IMGUI_KIOSK.md](SETUP_STM32_IMGUI_KIOSK.md) - Setup ImGui application
4. [HARDWARE_SETUP.md](HARDWARE_SETUP.md) - Configure hardware components

---

## Reference

### Official Resources

- **STMicroelectronics STM32MP1 Wiki**:
  https://wiki.st.com/stm32mpu/wiki/Main_Page

- **OPENstLinux Documentation**:
  https://wiki.st.com/stm32mpu/wiki/OpenSTLinux_distribution

- **STM32MP157F-DK2 Board Manual**:
  https://www.st.com/resource/en/user_manual/um2426-stm32mp157f-dk2-discovery-kit-board-user-manual.pdf

### Useful Commands

```bash
# Boot information
cat /proc/cmdline           # Kernel boot parameters
dmesg | head -50            # Early boot messages

# Device information
cat /proc/cpuinfo           # CPU details
cat /proc/meminfo           # Memory information

# File system
df -h                       # Disk space
mount                       # Mounted filesystems
```

---

## See Also

- [SETUP_STM32_WIFI.md](SETUP_STM32_WIFI.md) - Network setup
- [SETUP_STM32_M4_FIRMWARE.md](SETUP_STM32_M4_FIRMWARE.md) - M4 firmware
- [SETUP_STM32_IMGUI_KIOSK.md](SETUP_STM32_IMGUI_KIOSK.md) - ImGui setup
- [HARDWARE_SETUP.md](HARDWARE_SETUP.md) - Hardware configuration
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - General troubleshooting

---

**Last Updated**: January 28, 2026
