#!/usr/bin/env python3
"""
HVNC PC Agent - Python WebSocket Implementation
This is a Python equivalent for testing and comparison
"""

import asyncio
import websockets
import json
import time
import logging
from urllib.parse import urlencode

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

class HVNCPythonClient:
    def __init__(self, server_url, auth_token, device_id):
        self.server_url = server_url
        self.auth_token = auth_token
        self.device_id = device_id
        self.websocket = None
        self.connected = False
        
    async def connect(self):
        """Establish WebSocket connection with proper Socket.IO protocol"""
        try:
            # Build Socket.IO WebSocket URL (standard endpoint)
            ws_url = self._build_socketio_url()
            logger.info(f"Connecting to: {ws_url}")
            
            # Set WebSocket headers
            headers = {
                "Origin": "http://localhost",
                "User-Agent": "HVNC-PCAgent/2.0 Python WebSocket"
            }
            
            # Connect to WebSocket
            self.websocket = await websockets.connect(
                ws_url,
                extra_headers=headers,
                ping_interval=None,  # Disable ping/pong for Socket.IO compatibility
                ping_timeout=None
            )
            
            logger.info("WebSocket connection established!")
            self.connected = True
            
            # Wait for Socket.IO handshake, then join namespace
            await self._handle_connection_flow()
            
        except Exception as e:
            logger.error(f"Connection error: {e}")
            return False
    
    async def _handle_connection_flow(self):
        """Handle initial Socket.IO handshake and namespace joining"""
        try:
            # Wait for initial Socket.IO handshake
            logger.info("Waiting for Socket.IO handshake...")
            initial_message = await asyncio.wait_for(self.websocket.recv(), timeout=10.0)
            logger.info(f"Initial handshake: {initial_message}")
            
            # Send namespace connection request
            # Format: "40/hvnc-device," (4=CONNECT, 0=default, /hvnc-device=namespace)
            namespace_connect = "40/hvnc-device,"
            await self.websocket.send(namespace_connect)
            logger.info(f"Sent namespace connection: {namespace_connect}")
            
            # Start message handler
            await self._handle_messages()
            
        except asyncio.TimeoutError:
            logger.error("Timeout waiting for Socket.IO handshake")
            self.connected = False
        except Exception as e:
            logger.error(f"Connection flow error: {e}")
            self.connected = False
    
    async def _handle_messages(self):
        """Handle incoming WebSocket messages"""
        logger.info("👂 Starting message handler...")
        
        try:
            async for message in self.websocket:
                logger.info(f"📨 Received: {message}")
                await self._process_socketio_message(message)
                
        except websockets.exceptions.ConnectionClosed:
            logger.info("🔌 WebSocket connection closed")
            self.connected = False
        except Exception as e:
            logger.error(f"❌ Message handler error: {e}")
            self.connected = False
    
    async def _process_socketio_message(self, message):
        """Process Socket.IO protocol messages"""
        if not message:
            return
            
        # Parse Socket.IO message type
        msg_type = message[0]
        data = message[1:] if len(message) > 1 else ""
        
        if msg_type == '0':  # CONNECT
            logger.info("🔌 Socket.IO CONNECT received")
            
        elif msg_type == '2':  # EVENT
            await self._handle_socketio_event(data)
            
        elif msg_type == '3':  # ACK
            logger.info(f"📬 Socket.IO ACK: {data}")
            
        elif msg_type == '4':  # ERROR
            logger.error(f"❌ Socket.IO ERROR: {data}")
            
        else:
            logger.warning(f"❓ Unknown Socket.IO message type: {msg_type}")
    
    async def _handle_socketio_event(self, data):
        """Handle Socket.IO events"""
        logger.info(f"🎯 Socket.IO Event: {data}")
        
        try:
            # Parse event data
            if data.startswith('["'):
                event_data = json.loads(data)
                event_name = event_data[0]
                event_payload = event_data[1] if len(event_data) > 1 else None
                
                if event_name == "authenticated":
                    logger.info("🎉 AUTHENTICATION SUCCESSFUL!")
                    logger.info(f"✅ Device authenticated: {json.dumps(event_payload, indent=2)}")
                    
                    # Start sending status updates
                    asyncio.create_task(self._send_status_updates())
                    
                elif event_name == "auth_error":
                    logger.error("❌ AUTHENTICATION FAILED!")
                    logger.error(f"🔍 Error details: {event_payload}")
                    
                elif event_name == "command":
                    logger.info("🎯 Command received from server")
                    logger.info(f"📋 Command: {json.dumps(event_payload, indent=2)}")
                    
                else:
                    logger.info(f"📨 Event '{event_name}': {event_payload}")
                    
        except json.JSONDecodeError as e:
            logger.error(f"❌ Failed to parse event data: {e}")
    
    async def _send_status_updates(self):
        """Send periodic device status updates"""
        logger.info("📤 Starting status update loop...")
        
        while self.connected:
            try:
                await self._send_device_status()
                await asyncio.sleep(30)  # Send every 30 seconds
            except Exception as e:
                logger.error(f"❌ Status update error: {e}")
                break
    
    async def _send_device_status(self):
        """Send device status to server"""
        if not self.connected or not self.websocket:
            return
            
        status_data = {
            "status": "online",
            "cpu_usage": 45.2,
            "memory_usage": 67.8, 
            "disk_usage": 23.1,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
        }
        
        # Format as Socket.IO event message
        status_msg = f'2["device_status",{json.dumps(status_data)}]'
        
        try:
            await self.websocket.send(status_msg)
            logger.info("📤 Device status sent")
        except Exception as e:
            logger.error(f"❌ Failed to send device status: {e}")
    
    async def disconnect(self):
        """Disconnect from WebSocket"""
        if self.websocket:
            await self.websocket.close()
            self.connected = False
            logger.info("👋 WebSocket disconnected")

async def main():
    """Main function"""
    # Configuration
    server_url = "http://localhost:4000"
    device_id = "DEVICE-3863CCC752739530"
    auth_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5YjQyOGQyZjQ4MDJkMjE5Y2QxOTdlOCIsImRldmljZV9pZCI6IkRFVklDRS0zODYzQ0NDNzUyNzM5NTMwIiwidHlwZSI6ImRldmljZSIsImlhdCI6MTc3MzQyMjk2MywiZXhwIjoxNzc2MDE0OTYzfQ.uLGJSq7YAdx19W8Tz3f0elofURfNt_NywDM6s72bBok"
    
    logger.info("🚀 Starting HVNC PC Agent (Python WebSocket)...")
    logger.info(f"📋 Device ID: {device_id}")
    
    # Create and connect client
    client = HVNCPythonClient(server_url, auth_token, device_id)
    
    try:
        await client.connect()
    except KeyboardInterrupt:
        logger.info("⌨️  Keyboard interrupt received")
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}")
    finally:
        await client.disconnect()
        logger.info("👋 HVNC PC Agent shutting down")

if __name__ == "__main__":
    # Run the async main function
    asyncio.run(main())