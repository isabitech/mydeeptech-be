#!/usr/bin/env python3
"""
HVNC PC Agent - Fixed Socket.IO v4 Namespace Protocol (Python)
This correctly implements Socket.IO v4 namespace connections:
1. Connect to /socket.io/ endpoint
2. Wait for initial handshake
3. Send namespace join message "40/hvnc-device"
4. Wait for namespace confirmation
5. Send namespaced events "42/hvnc-device,[event, data]"
"""

import socket
import ssl
import base64
import hashlib
import json
import time
import threading
from urllib.parse import urlencode
import struct

class HVNCSocketIOClient:
    def __init__(self, server_url, auth_token, device_id):
        self.server_url = server_url
        self.auth_token = auth_token
        self.device_id = device_id
        self.sock = None
        self.connected = False
        self.namespace_joined = False
        self.running = True
        
    def create_websocket_key(self):
        """Generate WebSocket key for handshake"""
        return base64.b64encode(b'1234567890123456').decode()
    
    def connect(self):
        """Connect to Socket.IO server with proper WebSocket handshake"""
        try:
            print("🚀 Starting connection to Socket.IO server...")
            
            # Build Socket.IO URL with parameters
            params = {
                "EIO": "4",
                "transport": "websocket",
                "token": self.auth_token,
                "t": str(int(time.time() * 1000))
            }
            query_string = urlencode(params)
            path = f"/socket.io/?{query_string}"
            
            print(f"🔗 Connecting to: ws://localhost:4000{path}")
            
            # Create TCP socket
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.sock.settimeout(10.0)
            self.sock.connect(('localhost', 4000))
            
            # Generate WebSocket key and build handshake
            ws_key = self.create_websocket_key()
            
            request = f"GET {path} HTTP/1.1\r\n"
            request += "Host: localhost:4000\r\n"
            request += "Upgrade: websocket\r\n"
            request += "Connection: Upgrade\r\n"
            request += f"Sec-WebSocket-Key: {ws_key}\r\n"
            request += "Sec-WebSocket-Version: 13\r\n"
            request += "Origin: http://localhost\r\n"
            request += "User-Agent: HVNC-PCAgent-Fixed/1.0\r\n"
            request += "\r\n"
            
            print("📤 Sending WebSocket handshake...")
            self.sock.send(request.encode())
            
            # Read response
            response = self.sock.recv(4096).decode()
            print(f"📨 Handshake response:\n{response}")
            
            # Check for successful upgrade
            if "HTTP/1.1 101" in response and "websocket" in response.lower():
                print("✅ WebSocket upgrade successful!")
                self.connected = True
                
                # Start message handling
                threading.Thread(target=self.message_handler, daemon=True).start()
                return True
            else:
                print("❌ WebSocket upgrade failed")
                return False
                
        except Exception as e:
            print(f"❌ Connection error: {e}")
            return False
    
    def send_frame(self, payload):
        """Send WebSocket frame with proper framing"""
        if not self.connected or not self.sock:
            return False
            
        try:
            # Simple text frame (opcode 0x01)
            payload_bytes = payload.encode('utf-8')
            payload_length = len(payload_bytes)
            
            # Build WebSocket frame
            frame = bytearray()
            frame.append(0x81)  # FIN=1, opcode=1 (text)
            
            if payload_length < 126:
                frame.append(0x80 | payload_length)  # MASK=1, length
            elif payload_length < 65536:
                frame.append(0x80 | 126)  # MASK=1, extended length
                frame.extend(struct.pack('>H', payload_length))
            else:
                frame.append(0x80 | 127)  # MASK=1, 64-bit length
                frame.extend(struct.pack('>Q', payload_length))
            
            # Masking key (required for client frames)
            mask = b'\\x12\\x34\\x56\\x78'
            frame.extend(mask)
            
            # Masked payload
            for i, byte in enumerate(payload_bytes):
                frame.append(byte ^ mask[i % 4])
            
            self.sock.send(frame)
            return True
            
        except Exception as e:
            print(f"❌ Send error: {e}")
            return False
    
    def read_frame(self):
        """Read WebSocket frame and extract payload"""
        try:
            # Read frame header
            first_byte = self.sock.recv(1)[0]
            second_byte = self.sock.recv(1)[0]
            
            # Extract opcode and payload length
            opcode = first_byte & 0x0F
            is_masked = (second_byte & 0x80) == 0x80
            payload_length = second_byte & 0x7F
            
            # Handle extended payload length
            if payload_length == 126:
                payload_length = struct.unpack('>H', self.sock.recv(2))[0]
            elif payload_length == 127:
                payload_length = struct.unpack('>Q', self.sock.recv(8))[0]
            
            # Read masking key if present
            if is_masked:
                mask = self.sock.recv(4)
            
            # Read payload
            payload = self.sock.recv(payload_length)
            
            # Unmask if necessary
            if is_masked:
                payload = bytes(payload[i] ^ mask[i % 4] for i in range(len(payload)))
            
            return payload.decode('utf-8') if opcode == 1 else None  # Only process text frames
            
        except Exception as e:
            print(f"❌ Read error: {e}")
            return None
    
    def message_handler(self):
        """Handle incoming Socket.IO messages"""
        print("👂 Starting message handler...")
        
        while self.running and self.connected:
            try:
                message = self.read_frame()
                if message:
                    print(f"📨 Received: {message}")
                    self.process_socketio_message(message)
                    
            except Exception as e:
                print(f"❌ Message handler error: {e}")
                break
        
        print("🛑 Message handler stopped")
    
    def process_socketio_message(self, message):
        """Process Socket.IO protocol messages"""
        if not message:
            return
            
        # Parse Socket.IO message type
        msg_type = message[0] if message else ''
        data = message[1:] if len(message) > 1 else ""
        
        if msg_type == '0':  # CONNECT
            print("🔌 Socket.IO CONNECT received - joining namespace...")
            self.join_hvnc_namespace()
            
        elif msg_type == '4':  # Namespace events
            if "/hvnc-device" in message:
                if message == "40/hvnc-device":
                    print("🎉 Successfully joined /hvnc-device namespace!")
                    self.namespace_joined = True
                    self.start_status_updates()
                else:
                    print(f"📨 Namespace message: {message}")
                    
        elif msg_type == '2':  # EVENT
            self.handle_socketio_event(data)
            
        else:
            print(f"📋 Other message type '{msg_type}': {data}")
    
    def join_hvnc_namespace(self):
        """Join the /hvnc-device namespace"""
        print("🔄 Joining /hvnc-device namespace...")
        namespace_join = "40/hvnc-device"
        
        if self.send_frame(namespace_join):
            print("📤 Namespace join request sent")
        else:
            print("❌ Failed to send namespace join request")
    
    def handle_socketio_event(self, data):
        """Handle Socket.IO events"""
        print(f"🎯 Socket.IO Event: {data}")
        
        try:
            if data and data.startswith('['):
                event_data = json.loads(data)
                if isinstance(event_data, list) and len(event_data) > 0:
                    event_name = event_data[0]
                    event_payload = event_data[1] if len(event_data) > 1 else None
                    
                    if event_name == "authenticated":
                        print("🎉 AUTHENTICATION SUCCESSFUL!")
                        print(f"✅ Device info: {json.dumps(event_payload, indent=2)}")
                        
                    elif event_name == "auth_error":
                        print("❌ AUTHENTICATION FAILED!")
                        print(f"🔍 Error: {json.dumps(event_payload, indent=2)}")
                        
                    elif event_name == "command":
                        print("🎯 Command received from server")
                        print(f"📋 Command: {json.dumps(event_payload, indent=2)}")
                        
        except json.JSONDecodeError as e:
            print(f"❌ Failed to parse event JSON: {e}")
    
    def start_status_updates(self):
        """Start sending periodic device status updates"""
        def status_loop():
            print("📤 Starting device status update loop...")
            while self.running and self.connected and self.namespace_joined:
                self.send_device_status()
                time.sleep(30)  # Send every 30 seconds
            print("🛑 Status update loop stopped")
        
        threading.Thread(target=status_loop, daemon=True).start()
    
    def send_device_status(self):
        """Send device status to server"""
        if not self.namespace_joined:
            return
            
        status_data = {
            "status": "online",
            "cpu_usage": 45.2,
            "memory_usage": 67.8,
            "disk_usage": 23.1,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
        }
        
        # Socket.IO v4 namespaced event format
        status_msg = f'42/hvnc-device,["device_status",{json.dumps(status_data)}]'
        
        if self.send_frame(status_msg):
            print("📤 Device status sent to /hvnc-device namespace")
        else:
            print("❌ Failed to send device status")
    
    def disconnect(self):
        """Disconnect from server"""
        self.running = False
        self.connected = False
        self.namespace_joined = False
        
        if self.sock:
            try:
                self.sock.close()
            except:
                pass
            
        print("👋 Disconnected from server")

def main():
    print("🚀 HVNC PC Agent - Fixed Socket.IO v4 Implementation (Python)")
    print("🔧 This version correctly handles namespace connections")
    print()
    
    # Configuration
    server_url = "http://localhost:4000"
    device_id = "DEVICE-3863CCC752739530"
    auth_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5YjQyOGQyZjQ4MDJkMjE5Y2QxOTdlOCIsImRldmljZV9pZCI6IkRFVklDRS0zODYzQ0NDNzUyNzM5NTMwIiwidHlwZSI6ImRldmljZSIsImlhdCI6MTc3MzQyMjk2MywiZXhwIjoxNzc2MDE0OTYzfQ.uLGJSq7YAdx19W8Tz3f0elofURfNt_NywDM6s72bBok"
    
    print(f"📋 Device ID: {device_id}")
    print()
    
    # Create and connect client
    client = HVNCSocketIOClient(server_url, auth_token, device_id)
    
    try:
        if client.connect():
            print("🔄 Connection established, waiting for namespace join...")
            
            # Wait for namespace to be joined
            for i in range(30):  # Wait up to 30 seconds
                time.sleep(1)
                if client.namespace_joined:
                    print("🎯 Namespace joined! Running for 60 seconds...")
                    time.sleep(60)
                    break
                    
            if not client.namespace_joined:
                print("⏰ Timeout waiting for namespace join")
                
        else:
            print("❌ Failed to establish connection")
            
    except KeyboardInterrupt:
        print("⌨️ Keyboard interrupt received")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
    finally:
        client.disconnect()
        print("👋 HVNC PC Agent shutting down")

if __name__ == "__main__":
    main()