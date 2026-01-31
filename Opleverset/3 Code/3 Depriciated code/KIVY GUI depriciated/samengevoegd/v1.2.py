#!/usr/bin/env python3
# GUI RFID card en verbinding met database
"""
RFID Attendance System with Kivy GUI
Integrates RFID reading with visual feedback
"""

import kivy
from kivy.app import App
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.label import Label
from kivy.uix.image import Image
from kivy.clock import Clock
from kivy.graphics import Color, Rectangle
from kivy.core.window import Window

import serial
import requests
import re
import logging
import threading
from datetime import datetime
from queue import Queue

# Configuration
SERIAL_PORT = '/dev/ttyRPMSG0'
BAUD_RATE = 115200
API_URL = 'http://10.10.2.66:5000/api/scan'
API_TIMEOUT = 5

# Set window size for your display (adjust if needed)
Window.size = (800, 480)
Window.clearcolor = (0.1, 0.1, 0.15, 1)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)


class RFIDWidget(BoxLayout):
    """Main widget for RFID display"""
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.orientation = 'vertical'
        self.padding = 20
        self.spacing = 20
        
        # Status colors
        self.colors = {
            'waiting': (0.3, 0.3, 0.4, 1),
            'scanning': (0.2, 0.4, 0.6, 1),
            'success': (0.2, 0.6, 0.3, 1),
            'error': (0.7, 0.2, 0.2, 1)
        }
        
        # Background
        with self.canvas.before:
            self.bg_color = Color(*self.colors['waiting'])
            self.bg_rect = Rectangle(pos=self.pos, size=self.size)
        
        self.bind(pos=self._update_rect, size=self._update_rect)
        
        # Time label at top
        self.time_label = Label(
            text=self._get_time_str(),
            font_size='24sp',
            size_hint=(1, 0.1),
            color=(0.7, 0.7, 0.7, 1)
        )
        self.add_widget(self.time_label)
        
        # Main status label
        self.status_label = Label(
            text='Waiting for RFID card...',
            font_size='48sp',
            size_hint=(1, 0.4),
            bold=True,
            halign='center',
            valign='middle'
        )
        self.status_label.bind(size=self.status_label.setter('text_size'))
        self.add_widget(self.status_label)
        
        # User info label
        self.user_label = Label(
            text='',
            font_size='36sp',
            size_hint=(1, 0.3),
            halign='center',
            valign='middle',
            color=(0.9, 0.9, 0.9, 1)
        )
        self.user_label.bind(size=self.user_label.setter('text_size'))
        self.add_widget(self.user_label)
        
        # Details label
        self.details_label = Label(
            text='Place your card on the reader',
            font_size='24sp',
            size_hint=(1, 0.2),
            halign='center',
            valign='middle',
            color=(0.6, 0.6, 0.6, 1)
        )
        self.details_label.bind(size=self.details_label.setter('text_size'))
        self.add_widget(self.details_label)
        
        # Update time every second
        Clock.schedule_interval(self._update_time, 1)
    
    def _update_rect(self, instance, value):
        """Update background rectangle"""
        self.bg_rect.pos = self.pos
        self.bg_rect.size = self.size
    
    def _get_time_str(self):
        """Get current time as string"""
        return datetime.now().strftime('%H:%M:%S - %A, %B %d, %Y')
    
    def _update_time(self, dt):
        """Update time label"""
        self.time_label.text = self._get_time_str()
    
    def set_background_color(self, color_name):
        """Change background color"""
        if color_name in self.colors:
            self.bg_color.rgba = self.colors[color_name]
    
    def show_waiting(self):
        """Show waiting state"""
        self.set_background_color('waiting')
        self.status_label.text = 'Waiting for RFID card...'
        self.user_label.text = ''
        self.details_label.text = 'Place your card on the reader'
    
    def show_scanning(self, rfid_uid):
        """Show scanning state"""
        self.set_background_color('scanning')
        self.status_label.text = 'Card Detected'
        self.user_label.text = f'UID: {rfid_uid}'
        self.details_label.text = 'Processing...'
    
    def show_success(self, action, user_name, department, timestamp):
        """Show success state"""
        self.set_background_color('success')
        
        if action == 'clock_in':
            self.status_label.text = '✓ CLOCKED IN'
            self.details_label.text = f'Welcome! Started at {timestamp}'
        else:
            self.status_label.text = '✓ CLOCKED OUT'
            self.details_label.text = f'Goodbye! Ended at {timestamp}'
        
        self.user_label.text = f'{user_name}\n{department}'
        
        # Return to waiting after 3 seconds
        Clock.schedule_once(lambda dt: self.show_waiting(), 3)
    
    def show_error(self, message):
        """Show error state"""
        self.set_background_color('error')
        self.status_label.text = '✗ ERROR'
        self.user_label.text = message
        self.details_label.text = 'Please try again or contact support'
        
        # Return to waiting after 3 seconds
        Clock.schedule_once(lambda dt: self.show_waiting(), 3)


class RFIDApp(App):
    """Main Kivy application"""
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.serial_conn = None
        self.rfid_queue = Queue()
        self.last_uid = None
        self.last_scan_time = 0
        self.debounce_seconds = 2
        self.is_running = True
        
    def build(self):
        """Build the UI"""
        self.widget = RFIDWidget()
        
        # Start RFID reading thread
        self.rfid_thread = threading.Thread(target=self._rfid_reader_thread, daemon=True)
        self.rfid_thread.start()
        
        # Schedule queue checking
        Clock.schedule_interval(self._check_queue, 0.1)
        
        return self.widget
    
    def on_stop(self):
        """Cleanup on app close"""
        self.is_running = False
        if self.serial_conn and self.serial_conn.is_open:
            self.serial_conn.close()
    
    def _connect_serial(self):
        """Connect to M4 core"""
        try:
            self.serial_conn = serial.Serial(
                SERIAL_PORT,
                BAUD_RATE,
                timeout=1
            )
            logging.info(f"Connected to {SERIAL_PORT}")
            return True
        except Exception as e:
            logging.error(f"Failed to connect to serial: {e}")
            return False
    
    def _parse_uid(self, line):
        """Extract UID from M4 output"""
        match = re.search(r'Card UID:\s+((?:[0-9A-F]{2}\s*)+)', line)
        if match:
            uid_bytes = match.group(1).strip().split()
            uid = ''.join(uid_bytes)
            return uid
        return None
    
    def _should_process_scan(self, uid):
        """Check if we should process this scan (debouncing)"""
        import time
        current_time = time.time()
        
        if uid == self.last_uid:
            if (current_time - self.last_scan_time) < self.debounce_seconds:
                return False
        
        self.last_uid = uid
        self.last_scan_time = current_time
        return True
    
    def _send_to_api(self, rfid_uid):
        """Send RFID UID to backend API"""
        try:
            payload = {'rfid_uid': rfid_uid}
            response = requests.post(
                API_URL,
                json=payload,
                timeout=API_TIMEOUT
            )
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 404:
                return {'success': False, 'error': 'Card not registered'}
            else:
                return {'success': False, 'error': f'API error: {response.status_code}'}
                
        except requests.exceptions.Timeout:
            return {'success': False, 'error': 'API timeout'}
        except Exception as e:
            return {'success': False, 'error': f'Connection failed: {str(e)}'}
    
    def _rfid_reader_thread(self):
        """Background thread for reading RFID data"""
        import time
        
        while self.is_running:
            try:
                if not self.serial_conn or not self.serial_conn.is_open:
                    if not self._connect_serial():
                        time.sleep(5)
                        continue
                
                if self.serial_conn.in_waiting > 0:
                    line = self.serial_conn.readline().decode('utf-8', errors='ignore').strip()
                    
                    if line:
                        logging.debug(f"M4: {line}")
                        
                        uid = self._parse_uid(line)
                        
                        if uid:
                            logging.info(f"Detected RFID: {uid}")
                            
                            if self._should_process_scan(uid):
                                # Put in queue for main thread to process
                                self.rfid_queue.put(('scan', uid))
                            else:
                                logging.debug(f"Debounced duplicate scan of {uid}")
                
                time.sleep(0.01)
                
            except Exception as e:
                logging.error(f"Error in RFID thread: {e}")
                time.sleep(1)
    
    def _check_queue(self, dt):
        """Check queue for RFID events (runs in main thread)"""
        try:
            while not self.rfid_queue.empty():
                event_type, data = self.rfid_queue.get_nowait()
                
                if event_type == 'scan':
                    self._handle_scan(data)
                    
        except Exception as e:
            logging.error(f"Error processing queue: {e}")
    
    def _handle_scan(self, rfid_uid):
        """Handle RFID scan (runs in main thread for UI updates)"""
        # Show scanning state
        self.widget.show_scanning(rfid_uid)
        
        # Send to API in background
        def api_call():
            result = self._send_to_api(rfid_uid)
            # Schedule UI update in main thread
            Clock.schedule_once(lambda dt: self._update_ui_with_result(result), 0)
        
        threading.Thread(target=api_call, daemon=True).start()
    
    def _update_ui_with_result(self, result):
        """Update UI with API result"""
        if result.get('success'):
            action = result.get('action', 'unknown')
            user = result.get('user', {})
            user_name = user.get('name', 'Unknown User')
            department = user.get('department', '')
            
            # Extract time from timestamp
            timestamp_str = result.get('timestamp', '')
            try:
                dt = datetime.fromisoformat(timestamp_str)
                time_str = dt.strftime('%H:%M:%S')
            except:
                time_str = datetime.now().strftime('%H:%M:%S')
            
            self.widget.show_success(action, user_name, department, time_str)
            
        else:
            error_msg = result.get('error', 'Unknown error')
            if 'not registered' in error_msg.lower():
                error_msg = 'Card Not Registered\nPlease contact administrator'
            self.widget.show_error(error_msg)


if __name__ == '__main__':
    try:
        RFIDApp().run()
    except KeyboardInterrupt:
        logging.info("Application stopped by user")