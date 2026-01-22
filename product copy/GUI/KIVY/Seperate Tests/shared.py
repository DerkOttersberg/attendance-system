import json
import struct
import socket

HOST = "127.0.0.1"
PORT = 5055

def send_json(sock, data):
    """Send a JSON object over socket with length prefix."""
    msg = json.dumps(data).encode("utf-8")
    sock.sendall(struct.pack(">I", len(msg)) + msg)

def recv_json(sock):
    """Receive a JSON object with length prefix."""
    raw_len = recvall(sock, 4)
    if not raw_len:
        return None
    msg_len = struct.unpack(">I", raw_len)[0]
    data = recvall(sock, msg_len)
    if not data:
        return None
    return json.loads(data.decode("utf-8"))

def recvall(sock, n):
    """Helper to receive n bytes."""
    buf = b""
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            return None
        buf += chunk
    return buf
