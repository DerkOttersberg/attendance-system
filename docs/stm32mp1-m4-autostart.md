# STM32MP157D M4 Firmware Auto-Start Guide

## Overview
The STM32MP157D has a Cortex-A7 (Linux) and Cortex-M4 processor. When you upload code via STM32CubeIDE debug mode, it loads to RAM and disappears after power cycle. This guide shows how to make M4 firmware persistent and auto-start at boot.

## Manual Start/Stop

### Start M4 Firmware
```bash
# 1. Copy firmware to /lib/firmware/
cp YourFirmware.elf /lib/firmware/

# 2. Create symlink
cd /lib/firmware
ln -sf YourFirmware.elf rproc-m4-fw.elf

# 3. Load and start M4
cd /sys/class/remoteproc/remoteproc0
echo rproc-m4-fw.elf > firmware
echo start > state

# 4. Verify it's running
cat state  # Should show "running"
```

### Stop M4 Firmware
```bash
cd /sys/class/remoteproc/remoteproc0
echo stop > state
cat state  # Should show "offline"
```

### Test Communication
```bash
# Listen to M4 messages
cat /dev/ttyRPMSG0 &

# Send message to M4
echo "your_command" > /dev/ttyRPMSG0
```

## Auto-Start at Boot

### Create systemd Service
```bash
nano /etc/systemd/system/m4-autostart.service
```

### Service File Content
```ini
[Unit]
Description=Auto-start STM32 M4 Firmware
After=multi-user.target

[Service]
Type=oneshot
ExecStart=/bin/sh -c 'echo rproc-m4-fw.elf > /sys/class/remoteproc/remoteproc0/firmware'
ExecStart=/bin/sh -c 'echo start > /sys/class/remoteproc/remoteproc0/state'
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
```

### Enable and Test
```bash
# Enable service
systemctl daemon-reload
systemctl enable m4-autostart.service
systemctl start m4-autostart.service

# Reboot to test
reboot

# After reboot, verify
cat /sys/class/remoteproc/remoteproc0/state  # Should show "running"
ls /dev/ttyRPMSG*  # Should exist
```

## Development Workflow

1. Develop and debug in STM32CubeIDE
2. When ready, build Release version
3. Copy `.elf` file from `YourProject/Release/` to board
4. Update symlink: `ln -sf NewFirmware.elf rproc-m4-fw.elf`
5. Restart M4: `echo stop > state` then `echo start > state`

## Troubleshooting

### Check M4 Status
```bash
cat /sys/class/remoteproc/remoteproc0/state
```

### View Kernel Messages
```bash
dmesg | tail -20
```

### Check Service Status
```bash
systemctl status m4-autostart.service
```

### Disable Auto-Start
```bash
systemctl disable m4-autostart.service
```
