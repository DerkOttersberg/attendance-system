import serial
import pygame
import re

# --- Serial setup ---
SERIAL_PORT = "COM3"  # Change to your ESP32 port
BAUD_RATE = 921600

ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)

# --- Pygame setup ---
WIDTH, HEIGHT = 800, 480  # Your display resolution
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("ESP32 Touchscreen Visualizer")
screen.fill((0, 0, 0))
pygame.display.flip()

# Scaling factor (raw X/Y seems 0-4095)
X_SCALE = WIDTH / 4095
Y_SCALE = HEIGHT / 4095

# Regex to parse serial output
pattern = re.compile(r'X:\s*(\d+)\s*Y:\s*(\d+)')

running = True
while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False

    if ser.in_waiting:
        line = ser.readline().decode(errors='ignore').strip()
        match = pattern.match(line)
        if match:
            raw_x = int(match.group(1))
            raw_y = int(match.group(2))

            # --- Fix orientation ---
            x = raw_y * X_SCALE              # Y from ESP32 → X in Python
            y = (4095 - raw_x) * Y_SCALE     # Invert X from ESP32 → Y in Python

            # --- Correction: Invert vertical movement ---
            y = HEIGHT - y  # Flip Y axis so up/down matches touch

            # Draw smaller dot (radius 3)
            pygame.draw.circle(screen, (255, 0, 0), (int(x), int(y)), 1)
            pygame.display.flip()

pygame.quit()
ser.close()
