/*
 * HVNC PC Agent - Windows WinHTTP WebSocket Implementation
 *
 * Alternative implementation using Windows WinHTTP WebSockets
 * This is useful if you prefer Windows-native APIs
 */

#include <iostream>
#include <string>
#include <thread>
#include <chrono>
#include <windows.h>
#include <winhttp.h>
#include <sstream>

#pragma comment(lib, "winhttp.lib")

class HVNCWinHTTPClient
{
private:
    HINTERNET hSession = nullptr;
    HINTERNET hConnect = nullptr;
    HINTERNET hRequest = nullptr;
    HINTERNET hWebSocket = nullptr;
    std::string auth_token;
    std::string device_id;
    bool connected = false;

public:
    HVNCWinHTTPClient(const std::string &token, const std::string &dev_id)
        : auth_token(token), device_id(dev_id) {}

    ~HVNCWinHTTPClient()
    {
        disconnect();
    }

    bool connect()
    {
        try
        {
            std::wcout << L"🚀 Initializing WinHTTP WebSocket connection..." << std::endl;

            // Initialize WinHTTP
            hSession = WinHttpOpen(L"HVNC-PCAgent/2.0 WinHTTP WebSocket",
                                   WINHTTP_ACCESS_TYPE_DEFAULT_PROXY,
                                   WINHTTP_NO_PROXY_NAME,
                                   WINHTTP_NO_PROXY_BYPASS,
                                   0);

            if (!hSession)
            {
                std::wcout << L"❌ Failed to initialize WinHTTP session" << std::endl;
                return false;
            }

            // Connect to server
            hConnect = WinHttpConnect(hSession, L"localhost", 4000, 0);
            if (!hConnect)
            {
                std::wcout << L"❌ Failed to connect to server" << std::endl;
                return false;
            }

            // Build request path with Socket.IO parameters
            std::wstring path = build_socketio_path();
            std::wcout << L"📡 Request path: " << path << std::endl;

            // Create HTTP request with WebSocket upgrade
            hRequest = WinHttpOpenRequest(hConnect,
                                          L"GET",
                                          path.c_str(),
                                          nullptr,
                                          WINHTTP_NO_REFERER,
                                          WINHTTP_DEFAULT_ACCEPT_TYPES,
                                          0);

            if (!hRequest)
            {
                std::wcout << L"❌ Failed to create HTTP request" << std::endl;
                return false;
            }

            // Set WebSocket upgrade headers
            if (!set_websocket_headers())
            {
                return false;
            }

            // Send the request
            if (!WinHttpSendRequest(hRequest,
                                    WINHTTP_NO_ADDITIONAL_HEADERS, 0,
                                    WINHTTP_NO_REQUEST_DATA, 0, 0, 0))
            {
                std::wcout << L"❌ Failed to send request" << std::endl;
                return false;
            }

            // Receive the response
            if (!WinHttpReceiveResponse(hRequest, nullptr))
            {
                std::wcout << L"❌ Failed to receive response" << std::endl;
                return false;
            }

            // Check for successful WebSocket upgrade (101 status)
            DWORD statusCode = 0;
            DWORD statusCodeSize = sizeof(statusCode);

            if (WinHttpQueryHeaders(hRequest,
                                    WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
                                    WINHTTP_HEADER_NAME_BY_INDEX,
                                    &statusCode,
                                    &statusCodeSize,
                                    WINHTTP_NO_HEADER_INDEX))
            {

                if (statusCode == 101)
                {
                    std::wcout << L"✅ WebSocket upgrade successful (HTTP 101)" << std::endl;
                }
                else
                {
                    std::wcout << L"❌ WebSocket upgrade failed. Status: " << statusCode << std::endl;
                    return false;
                }
            }

            // Complete WebSocket handshake
            hWebSocket = WinHttpWebSocketCompleteUpgrade(hRequest, 0);
            if (!hWebSocket)
            {
                std::wcout << L"❌ Failed to complete WebSocket upgrade" << std::endl;
                return false;
            }

            std::wcout << L"🎉 WebSocket connection established!" << std::endl;
            connected = true;

            // Start message handling thread
            std::thread([this]()
                        { handle_messages(); })
                .detach();

            return true;
        }
        catch (const std::exception &e)
        {
            std::cout << "❌ Exception: " << e.what() << std::endl;
            return false;
        }
    }

private:
    std::wstring build_socketio_path()
    {
        // Convert token to wide string
        std::wstring wtoken(auth_token.begin(), auth_token.end());

        // Correct Socket.IO path - namespaces are virtual paths within same endpoint
        std::wstringstream ss;
        ss << L"/socket.io/?EIO=4&transport=websocket&token=" << wtoken;

        // Add timestamp
        auto timestamp = std::chrono::duration_cast<std::chrono::milliseconds>(
                             std::chrono::system_clock::now().time_since_epoch())
                             .count();

        ss << L"&t=" << timestamp;

        return ss.str();
    }

    bool set_websocket_headers()
    {
        // Set Connection: Upgrade header
        if (!WinHttpAddRequestHeaders(hRequest,
                                      L"Connection: Upgrade",
                                      -1L,
                                      WINHTTP_ADDREQ_FLAG_ADD))
        {
            std::wcout << L"❌ Failed to set Connection header" << std::endl;
            return false;
        }

        // Set Upgrade: websocket header
        if (!WinHttpAddRequestHeaders(hRequest,
                                      L"Upgrade: websocket",
                                      -1L,
                                      WINHTTP_ADDREQ_FLAG_ADD))
        {
            std::wcout << L"❌ Failed to set Upgrade header" << std::endl;
            return false;
        }

        // Set WebSocket version
        if (!WinHttpAddRequestHeaders(hRequest,
                                      L"Sec-WebSocket-Version: 13",
                                      -1L,
                                      WINHTTP_ADDREQ_FLAG_ADD))
        {
            std::wcout << L"❌ Failed to set WebSocket version" << std::endl;
            return false;
        }

        // Set WebSocket key (required for handshake)
        if (!WinHttpAddRequestHeaders(hRequest,
                                      L"Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==",
                                      -1L,
                                      WINHTTP_ADDREQ_FLAG_ADD))
        {
            std::wcout << L"❌ Failed to set WebSocket key" << std::endl;
            return false;
        }

        // Set Origin header
        if (!WinHttpAddRequestHeaders(hRequest,
                                      L"Origin: http://localhost",
                                      -1L,
                                      WINHTTP_ADDREQ_FLAG_ADD))
        {
            std::wcout << L"❌ Failed to set Origin header" << std::endl;
            return false;
        }

        std::wcout << L"📡 WebSocket headers configured" << std::endl;
        return true;
    }

    void handle_messages()
    {
        std::wcout << L"👂 Starting message handler thread..." << std::endl;

        while (connected)
        {
            WINHTTP_WEB_SOCKET_BUFFER_TYPE bufferType;
            PVOID buffer = nullptr;
            DWORD bufferLength = 0;

            // Receive WebSocket message
            DWORD error = WinHttpWebSocketReceive(hWebSocket,
                                                  buffer,
                                                  bufferLength,
                                                  &bufferLength,
                                                  &bufferType);

            if (error == ERROR_SUCCESS)
            {
                if (bufferType == WINHTTP_WEB_SOCKET_UTF8_MESSAGE_BUFFER_TYPE)
                {
                    // Allocate buffer for message
                    std::vector<char> messageBuffer(bufferLength + 1);

                    error = WinHttpWebSocketReceive(hWebSocket,
                                                    messageBuffer.data(),
                                                    bufferLength,
                                                    &bufferLength,
                                                    &bufferType);

                    if (error == ERROR_SUCCESS)
                    {
                        messageBuffer[bufferLength] = '\0';
                        std::string message(messageBuffer.data());

                        std::cout << "📨 Received: " << message << std::endl;
                        process_socketio_message(message);
                    }
                }
            }
            else if (error == ERROR_WINHTTP_CONNECTION_ERROR)
            {
                std::wcout << L"🔌 WebSocket connection lost" << std::endl;
                connected = false;
                break;
            }

            std::this_thread::sleep_for(std::chrono::milliseconds(100));
        }
    }

    void process_socketio_message(const std::string &message)
    {
        if (message.empty())
            return;

        char msg_type = message[0];
        std::string data = message.substr(1);

        switch (msg_type)
        {
        case '0': // CONNECT
            std::cout << "🔌 Socket.IO CONNECT received" << std::endl;
            break;

        case '2': // EVENT
            handle_socketio_event(data);
            break;

        case '3': // ACK
            std::cout << "📬 Socket.IO ACK: " << data << std::endl;
            break;

        case '4': // ERROR
            std::cout << "❌ Socket.IO ERROR: " << data << std::endl;
            break;
        }
    }

    void handle_socketio_event(const std::string &data)
    {
        std::cout << "🎯 Socket.IO Event: " << data << std::endl;

        if (data.find("authenticated") != std::string::npos)
        {
            std::cout << "🎉 AUTHENTICATION SUCCESSFUL!" << std::endl;
            start_status_updates();
        }

        if (data.find("auth_error") != std::string::npos)
        {
            std::cout << "❌ AUTHENTICATION FAILED!" << std::endl;
        }
    }

    void start_status_updates()
    {
        std::thread([this]()
                    {
            while (connected) {
                send_device_status();
                std::this_thread::sleep_for(std::chrono::seconds(30));
            } })
            .detach();
    }

    void send_device_status()
    {
        if (!connected || !hWebSocket)
            return;

        std::string status_msg = R"(2["device_status",{
            "status": "online",
            "cpu_usage": 45.2,
            "memory_usage": 67.8,
            "disk_usage": 23.1,
            "timestamp": ")" + get_current_timestamp() +
                                 R"("
        }])";

        DWORD error = WinHttpWebSocketSend(hWebSocket,
                                           WINHTTP_WEB_SOCKET_UTF8_MESSAGE_BUFFER_TYPE,
                                           (PVOID)status_msg.c_str(),
                                           (DWORD)status_msg.length());

        if (error == ERROR_SUCCESS)
        {
            std::cout << "📤 Device status sent" << std::endl;
        }
        else
        {
            std::cout << "❌ Failed to send device status" << std::endl;
        }
    }

    std::string get_current_timestamp()
    {
        auto now = std::chrono::system_clock::now();
        auto time_t = std::chrono::system_clock::to_time_t(now);

        std::stringstream ss;
        ss << std::put_time(std::gmtime(&time_t), "%Y-%m-%dT%H:%M:%S.000Z");
        return ss.str();
    }

public:
    void disconnect()
    {
        if (hWebSocket)
        {
            WinHttpWebSocketClose(hWebSocket,
                                  WINHTTP_WEB_SOCKET_SUCCESS_CLOSE_STATUS,
                                  nullptr, 0);
            WinHttpCloseHandle(hWebSocket);
            hWebSocket = nullptr;
        }

        if (hRequest)
        {
            WinHttpCloseHandle(hRequest);
            hRequest = nullptr;
        }

        if (hConnect)
        {
            WinHttpCloseHandle(hConnect);
            hConnect = nullptr;
        }

        if (hSession)
        {
            WinHttpCloseHandle(hSession);
            hSession = nullptr;
        }

        connected = false;
        std::wcout << L"👋 WebSocket disconnected" << std::endl;
    }

    bool is_connected() const
    {
        return connected;
    }
};

// Usage Example
int main()
{
    std::string device_id = "DEVICE-3863CCC752739530";
    std::string auth_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5YjQyOGQyZjQ4MDJkMjE5Y2QxOTdlOCIsImRldmljZV9pZCI6IkRFVklDRS0zODYzQ0NDNzUyNzM5NTMwIiwidHlwZSI6ImRldmljZSIsImlhdCI6MTc3MzQyMjk2MywiZXhwIjoxNzc2MDE0OTYzfQ.uLGJSq7YAdx19W8Tz3f0elofURfNt_NywDM6s72bBok";

    std::cout << "🚀 Starting HVNC PC Agent with WinHTTP WebSocket..." << std::endl;

    HVNCWinHTTPClient client(auth_token, device_id);

    if (client.connect())
    {
        std::cout << "✅ Connected! Keeping connection alive..." << std::endl;

        // Keep alive
        while (client.is_connected())
        {
            std::this_thread::sleep_for(std::chrono::seconds(5));
        }
    }
    else
    {
        std::cout << "❌ Failed to connect" << std::endl;
    }

    return 0;
}