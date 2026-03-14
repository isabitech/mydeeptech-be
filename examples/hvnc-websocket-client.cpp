/*
 * HVNC PC Agent - Proper WebSocket Implementation
 *
 * This example shows how to correctly implement WebSocket connection
 * for Socket.IO EIO=4 protocol instead of HTTP GET requests.
 */

#include <iostream>
#include <string>
#include <thread>
#include <chrono>

// Option 1: Using websocketpp library (Recommended)
#include <websocketpp/config/asio_no_tls_client.hpp>
#include <websocketpp/client.hpp>
#include <websocketpp/common/thread.hpp>
#include <websocketpp/common/memory.hpp>

typedef websocketpp::client<websocketpp::config::asio_client> client;
typedef websocketpp::config::asio_client::message_type::ptr message_ptr;

class HVNCWebSocketClient
{
private:
    client ws_client;
    websocketpp::connection_hdl hdl;
    std::string server_url;
    std::string auth_token;
    std::string device_id;
    bool connected = false;
    std::thread ws_thread;

public:
    HVNCWebSocketClient(const std::string &server, const std::string &token, const std::string &dev_id)
        : server_url(server), auth_token(token), device_id(dev_id)
    {

        // Initialize WebSocket client
        ws_client.set_access_channels(websocketpp::log::alevel::all);
        ws_client.clear_access_channels(websocketpp::log::alevel::frame_payload);
        ws_client.init_asio();

        // Set handlers
        ws_client.set_message_handler([this](websocketpp::connection_hdl hdl, message_ptr msg)
                                      { on_message(hdl, msg); });

        ws_client.set_open_handler([this](websocketpp::connection_hdl hdl)
                                   { on_open(hdl); });

        ws_client.set_close_handler([this](websocketpp::connection_hdl hdl)
                                    { on_close(hdl); });

        ws_client.set_fail_handler([this](websocketpp::connection_hdl hdl)
                                   { on_fail(hdl); });
    }

    bool connect()
    {
        try
        {
            // Construct proper Socket.IO WebSocket URL with namespace
            std::string ws_url = build_socketio_url();

            std::cout << "🚀 Connecting to: " << ws_url << std::endl;

            websocketpp::lib::error_code ec;
            client::connection_ptr con = ws_client.get_connection(ws_url, ec);

            if (ec)
            {
                std::cout << "❌ Connection error: " << ec.message() << std::endl;
                return false;
            }

            // Set proper WebSocket headers
            set_websocket_headers(con);

            hdl = con->get_handle();
            ws_client.connect(con);

            // Run WebSocket client in separate thread
            ws_thread = std::thread([this]()
                                    { ws_client.run(); });

            return true;
        }
        catch (const std::exception &e)
        {
            std::cout << "❌ Connection exception: " << e.what() << std::endl;
            return false;
        }
    }

private:
    std::string build_socketio_url()
    {
        // Socket.IO v4 URL - connect to main endpoint then join namespace
        std::string url = "ws://localhost:4000/socket.io/?EIO=4&transport=websocket&token=" + auth_token;

        // Add timestamp parameter that Socket.IO expects
        auto timestamp = std::chrono::duration_cast<std::chrono::milliseconds>(
                             std::chrono::system_clock::now().time_since_epoch())
                             .count();

        url += "&t=" + std::to_string(timestamp);

        return url;
    }

    void set_websocket_headers(client::connection_ptr con)
    {
        // Set required WebSocket upgrade headers
        con->replace_header("Connection", "Upgrade");
        con->replace_header("Upgrade", "websocket");
        con->replace_header("Sec-WebSocket-Version", "13");

        // Set origin header (important for CORS)
        con->replace_header("Origin", "http://localhost");

        // Set custom user agent
        con->replace_header("User-Agent", "HVNC-PCAgent/2.0 WebSocket");

        // Optional: Add custom headers if needed
        con->replace_header("X-Device-ID", device_id);

        std::cout << "📡 WebSocket headers configured for proper upgrade" << std::endl;
    }

    void on_open(websocketpp::connection_hdl hdl)
    {
        std::cout << "✅ WebSocket connection established!" << std::endl;
        connected = true;

        // Wait for authentication response
        std::cout << "⏳ Waiting for authentication..." << std::endl;
    }

    void on_message(websocketpp::connection_hdl hdl, message_ptr msg)
    {
        std::string payload = msg->get_payload();
        std::cout << "📨 Received: " << payload << std::endl;

        // Parse Socket.IO messages
        if (payload.length() > 0)
        {
            char msg_type = payload[0];
            std::string data = payload.substr(1);

            switch (msg_type)
            {
            case '0': // CONNECT
                std::cout << "🔌 Socket.IO CONNECT received" << std::endl;
                break;

            case '2': // EVENT
                handle_socketio_event(data);
                break;

            case '3': // ACK
                std::cout << "📬 Socket.IO ACK received: " << data << std::endl;
                break;

            case '4': // ERROR
                std::cout << "❌ Socket.IO ERROR: " << data << std::endl;
                break;

            default:
                std::cout << "❓ Unknown Socket.IO message type: " << msg_type << std::endl;
                break;
            }
        }
    }

    void handle_socketio_event(const std::string &data)
    {
        std::cout << "🎯 Socket.IO Event: " << data << std::endl;

        // Check for authentication success
        if (data.find("authenticated") != std::string::npos)
        {
            std::cout << "🎉 AUTHENTICATION SUCCESSFUL!" << std::endl;
            std::cout << "✅ PC Agent authenticated and ready" << std::endl;

            // Start sending device status updates
            start_status_updates();
        }

        // Check for authentication error
        if (data.find("auth_error") != std::string::npos)
        {
            std::cout << "❌ AUTHENTICATION FAILED!" << std::endl;
            std::cout << "🔍 Check token validity and database configuration" << std::endl;
        }

        // Handle commands from server
        if (data.find("command") != std::string::npos)
        {
            std::cout << "🎯 Command received from server" << std::endl;
            // Process command here
        }
    }

    void start_status_updates()
    {
        // Send periodic device status updates
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
        if (!connected)
            return;

        // Construct device status message
        std::string status_msg = R"(2["device_status",{
            "status": "online",
            "cpu_usage": 45.2,
            "memory_usage": 67.8,
            "disk_usage": 23.1,
            "timestamp": ")" + get_current_timestamp() +
                                 R"("
        }])";

        websocketpp::lib::error_code ec;
        ws_client.send(hdl, status_msg, websocketpp::frame::opcode::text, ec);

        if (ec)
        {
            std::cout << "❌ Send error: " << ec.message() << std::endl;
        }
        else
        {
            std::cout << "📤 Device status sent" << std::endl;
        }
    }

    std::string get_current_timestamp()
    {
        auto now = std::chrono::system_clock::now();
        auto time_t = std::chrono::system_clock::to_time_t(now);
        auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()) % 1000;

        std::stringstream ss;
        ss << std::put_time(std::gmtime(&time_t), "%Y-%m-%dT%H:%M:%S");
        ss << '.' << std::setfill('0') << std::setw(3) << ms.count() << 'Z';
        return ss.str();
    }

    void on_close(websocketpp::connection_hdl hdl)
    {
        std::cout << "🔌 WebSocket connection closed" << std::endl;
        connected = false;
    }

    void on_fail(websocketpp::connection_hdl hdl)
    {
        std::cout << "❌ WebSocket connection failed" << std::endl;
        connected = false;
    }

public:
    void disconnect()
    {
        if (connected)
        {
            websocketpp::lib::error_code ec;
            ws_client.close(hdl, websocketpp::close::status::normal, "Client disconnect", ec);

            if (ws_thread.joinable())
            {
                ws_thread.join();
            }
        }
    }

    bool is_connected() const
    {
        return connected;
    }
};

// Usage Example
int main()
{
    // Device configuration
    std::string server_url = "ws://localhost:4000";
    std::string device_id = "DEVICE-3863CCC752739530";

    // Generate or get your JWT token (same as before)
    std::string auth_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5YjQyOGQyZjQ4MDJkMjE5Y2QxOTdlOCIsImRldmljZV9pZCI6IkRFVklDRS0zODYzQ0NDNzUyNzM5NTMwIiwidHlwZSI6ImRldmljZSIsImlhdCI6MTc3MzQyMjk2MywiZXhwIjoxNzc2MDE0OTYzfQ.uLGJSq7YAdx19W8Tz3f0elofURfNt_NywDM6s72bBok";

    std::cout << "🚀 Starting HVNC PC Agent with WebSocket..." << std::endl;
    std::cout << "📋 Device ID: " << device_id << std::endl;

    // Create and connect WebSocket client
    HVNCWebSocketClient client(server_url, auth_token, device_id);

    if (client.connect())
    {
        std::cout << "🔄 WebSocket connection initiated..." << std::endl;

        // Keep alive for testing
        std::this_thread::sleep_for(std::chrono::seconds(60));

        client.disconnect();
    }
    else
    {
        std::cout << "❌ Failed to establish WebSocket connection" << std::endl;
    }

    std::cout << "👋 HVNC PC Agent shutting down" << std::endl;
    return 0;
}