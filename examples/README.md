# HVNC WebSocket Client Examples

This directory contains three complete WebSocket client implementations for connecting PC agents to the HVNC server. All examples properly implement the WebSocket protocol (unlike the previous HTTP-based attempts) and include full Socket.IO compatibility.

## 🚨 Critical Fix

**Problem Identified**: The C++ PC agent was sending HTTP requests with `Connection: Keep-Alive` instead of WebSocket upgrade requests with `Connection: Upgrade`. This prevented Socket.IO from processing connections.

**Solution**: These examples implement proper WebSocket protocol handshakes.

## 📁 Files Overview

- **`hvnc-websocket-client.cpp`** - Cross-platform C++ implementation using websocketpp
- **`hvnc-winhttp-client.cpp`** - Windows-native C++ implementation using WinHTTP
- **`hvnc-python-client.py`** - Python implementation for testing and comparison
- **`CMakeLists.txt`** - Build configuration for C++ examples

## 🔧 Build Instructions

### C++ WebSocket Client (websocketpp)

```bash
# Install dependencies (vcpkg recommended)
vcpkg install websocketpp boost-system boost-thread nlohmann-json

# Build with CMake
mkdir build
cd build
cmake .. -DCMAKE_TOOLCHAIN_FILE=[vcpkg-root]/scripts/buildsystems/vcpkg.cmake
cmake --build .

# Run
./hvnc_websocket_client
```

### C++ WinHTTP Client (Windows only)

```bash
# Build with Visual Studio
cl hvnc-winhttp-client.cpp /I"path/to/nlohmann/json" winhttp.lib

# Or with CMake (Windows)
mkdir build
cd build
cmake .. -DUSE_WINHTTP=ON
cmake --build .

# Run
./hvnc_winhttp_client.exe
```

### Python Client

```bash
# Install dependencies
pip install websockets

# Run directly
python hvnc-python-client.py
```

## 🔑 Configuration

Update these variables in each client:

```cpp
// C++ clients
std::string server_url = "http://localhost:4000";
std::string device_id = "DEVICE-3863CCC752739530";
std::string auth_token = "your_jwt_token_here";
```

```python
# Python client
server_url = "http://localhost:4000"
device_id = "DEVICE-3863CCC752739530"
auth_token = "your_jwt_token_here"
```

## 🌐 WebSocket Protocol Implementation

All clients implement proper WebSocket upgrades:

### Request Headers

```
GET /hvnc-device/socket.io/?EIO=4&transport=websocket&token=... HTTP/1.1
Host: localhost:4000
Connection: Upgrade
Upgrade: websocket
Sec-WebSocket-Key: [base64-key]
Sec-WebSocket-Version: 13
Origin: http://localhost
```

### Socket.IO Message Format

- `0` - CONNECT
- `2["event_name", data]` - EVENT
- `3[data]` - ACK
- `4[error]` - ERROR

## 🔍 Authentication Flow

1. **WebSocket Upgrade**: Client sends upgrade request to `/hvnc-device/socket.io/`
2. **Token Extraction**: Server extracts JWT from `token` query parameter
3. **JWT Verification**: Server validates token signature and expiration
4. **Device Lookup**: Server finds device in database using `device_id` from token
5. **Session Setup**: Server creates/updates device session
6. **Auth Response**: Server sends `authenticated` event with device details

## 🐛 Server-Side Debugging

The server has extensive debugging enabled. Monitor these logs:

```javascript
// In services/hvnc-websocket.service.js
console.log("🎯 HVNC Auth - Step X: ..."); // 10-step auth process

// In utils/chatSocketService.js
console.log("🤖 Auth bypass for:", namespace); // HVNC namespace detection
console.log("engine connection:", socket.id); // Engine-level connections

// In index.js
console.log("📡 [Socket.IO Request]:", req.method, req.url); // HTTP-level debugging
```

## ✅ Expected Success Output

### Client Side

```
🚀 Connecting to: ws://localhost:4000/hvnc-device/socket.io/?EIO=4&transport=websocket&token=...
✅ WebSocket connection established!
📨 Received: 0{"sid":"abc123","upgrades":[],"pingInterval":25000,"pingTimeout":20000}
🔌 Socket.IO CONNECT received
📨 Received: 2["authenticated",{"device":{"_id":"...","device_id":"DEVICE-3863CCC752739530"}}]
🎉 AUTHENTICATION SUCCESSFUL!
📤 Device status sent
```

### Server Side

```
🎯 HVNC Auth - Step 1: Starting authentication for socket abc123
🎯 HVNC Auth - Step 2: Extracting token from handshake
🎯 HVNC Auth - Step 3: JWT verification successful
🎯 HVNC Auth - Step 4: Device lookup successful
🎯 HVNC Auth - Step 5: Session setup complete
✅ HVNC Auth - Step 10: Authentication successful, device connected
```

## 🚨 Common Issues

### 1. HTTP 404 Errors

**Problem**: `GET /socket.io?EIO=4&transport=polling 404`
**Solution**: Use WebSocket transport, not polling. URL should be `/hvnc-device/socket.io/`

### 2. Connection Timeouts

**Problem**: WebSocket connection hangs
**Solution**: Ensure proper `Connection: Upgrade` header, not `Connection: Keep-Alive`

### 3. Authentication Failures

**Problem**: `auth_error` event received
**Solution**: Check JWT token validity and device existence in database

### 4. Namespace Issues

**Problem**: Connection to wrong namespace
**Solution**: Use `/hvnc-device/socket.io/` path, not default `/socket.io/`

## 🧪 Testing

Start with the Python client for quick testing:

```bash
python hvnc-python-client.py
```

Then move to C++ implementation once WebSocket flow is confirmed.

## 📚 Protocol Reference

- **WebSocket RFC**: https://tools.ietf.org/html/rfc6455
- **Socket.IO Protocol**: https://socket.io/docs/v4/engine-io-protocol/
- **JWT Specification**: https://tools.ietf.org/html/rfc7519

## 🎯 Next Steps

1. **Test Python Client**: Verify WebSocket connection and authentication
2. **Build C++ Client**: Choose between websocketpp or WinHTTP implementation
3. **Integration**: Replace existing HTTP-based client code
4. **Monitoring**: Use server debugging to confirm successful connections
5. **Production**: Remove debugging logs and optimize for performance

The key insight is that Socket.IO requires proper WebSocket protocol implementation - simple HTTP requests with websocket parameters will not work.
