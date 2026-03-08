#!/usr/bin/env python3
import serial
import logging
import requests
import threading
import time
from shared import HOST, PORT, send_json, recv_json
import socket

RFID_PORT = "/dev/ttyRPMSG0"  # Your real RFID device
RFID_BAUD = 115200
API_URL = "http://10.10.2.86:5000/api/scan"

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

frontend_conn = None

def handle_frontend(conn, addr):
    global frontend_conn
    logging.info(f"Frontend connected: {addr}")
    frontend_conn = conn
    try:
        while True:
            msg = recv_json(conn)
            if msg is None:
                break
    finally:
        frontend_conn = None
        conn.close()
        logging.info("Frontend disconnected")

def send_to_frontend(user_name, action):
    """Send command to open signature screen."""
    if frontend_conn:
        try:
            send_json(frontend_conn, {
                "command": "open_signature",
                "name": user_name,
                "mode": "in" if action == "clock_in" else "out"
            })
        except Exception as e:
            logging.error(f"Failed to send to frontend: {e}")

def rfid_loop(serial_port, baud):
    ser = serial.Serial(serial_port, baud, timeout=0.1)
    last_uid = None
    last_time = 0

    while True:
        try:
            line = ser.readline().decode(errors="ignore").strip()
            if not line:
                continue
            uid = line.replace(" ", "").upper()
            now = time.time()
            if uid == last_uid and now - last_time < 2:  # debounce
                continue
            last_uid = uid
            last_time = now

            logging.info(f"Detected UID: {uid}")
            try:
                resp = requests.post(API_URL, json={"rfid_uid": uid}, timeout=5).json()
            except Exception as e:
                logging.error(f"API call failed: {e}")
                continue

            logging.info(f"API result: {resp}")
            if resp.get("success"):
                user_name = resp["user"]["name"]
                send_to_frontend(user_name, resp["action"])
            else:
                logging.warning(f"Card error: {resp.get('error')}")
        except Exception as e:
            logging.error(f"RFID loop error: {e}")
        time.sleep(0.05)

def main():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind((HOST, PORT))
    server.listen(1)
    logging.info(f"RFID backend listening on {HOST}:{PORT}")

    conn, addr = server.accept()
    threading.Thread(target=handle_frontend, args=(conn, addr), daemon=True).start()

    rfid_loop(RFID_PORT, RFID_BAUD)

if __name__ == "__main__":
    main()
