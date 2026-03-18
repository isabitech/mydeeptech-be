/*
HVNC WebSocket Client - Fixed for Socket.IO v4 Namespace Protocol
This implementation correctly handles Socket.IO v4 namespace connections
*/

#include <websocketpp/config/asio_no_tls_client.hpp>
#include <websocketpp/client.hpp>
#include <nlohmann/json.hpp>
#include <iostream>
#include <thread>
#include <chrono>
#include <string>
#include <sstream>
#include <iomanip>

typedef websocketpp::client<websocketpp::config::asio_client> client;
typedef websocketpp::config::asio_client::message_type::ptr message_ptr;

class HVNCWebSocketClient
{
private:
    client ws_client;
    websocketpp::connection_hdl connection_hdl;
    std::string server_url;
    std::string auth_token;
    std::string device_id;
    bool connected;
    bool namespace_joined;
    std::thread ws_thread;
    std::thread status_thread;

public:
    HVNCWebSocketClient(const std::string &url, const std::string &token, const std::string &dev_id)
        : server_url(url), auth_token(token), device_id(dev_id), connected(false), namespace_joined(false)
    {

        ws_client.set_access_channels(websocketpp::log::alevel::all);
        ws_client.clear_access_channels(websocketpp::log::alevel::frame_payload);
        ws_client.set_error_channels(websocketpp::log::elevel::all);

        ws_client.init_asio();

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

            connection_hdl = con->get_handle();
            ws_client.connect(con);

            // Start the WebSocket run loop in a separate thread
            ws_thread = std::thread([this]()
                                    { ws_client.run(); });

            return true;
        }
        catch (const std::exception &e)
        {
            std::cout << "❌ Exception: " << e.what() << std::endl;
            return false;
        }
    }

private:
    std::string build_socketio_url()
    {
        // Socket.IO v4 standard endpoint - namespace will be joined after connection
        std::string url = "ws://localhost:4000/socket.io/?EIO=4&transport=websocket&token=" + auth_token;

        auto timestamp = std::chrono::duration_cast<std::chrono::milliseconds>(
                             std::chrono::system_clock::now().time_since_epoch())
                             .count();

        url += "&t=" + std::to_string(timestamp);

        return url;
    }

    void set_websocket_headers(client::connection_ptr con)
    {
        // Essential WebSocket upgrade headers
        con->replace_header("Connection", "Upgrade");
        con->replace_header("Upgrade", "websocket");
        con->replace_header("Sec-WebSocket-Version", "13");
        con->replace_header("Origin", "http://localhost");
        con->replace_header("User-Agent", "HVNC-PCAgent/2.0 Fixed");

        std::cout << "📡 WebSocket headers set for proper upgrade" << std::endl;
    }

    void on_open(websocketpp::connection_hdl hdl)
    {
        std::cout << "✅ WebSocket connection established!" << std::endl;
        connected = true;
        connection_hdl = hdl;

        std::cout << "🔄 Waiting for Socket.IO handshake..." << std::endl;
    }

    void on_message(websocketpp::connection_hdl hdl, message_ptr msg)
    {
        std::string payload = msg->get_payload();
        std::cout << "📨 Received: " << payload << std::endl;

        if (payload.empty())
            return;

        char msg_type = payload[0];
        std::string data = payload.length() > 1 ? payload.substr(1) : "";

        switch (msg_type)
        {
        case '0':
        { // CONNECT - initial handshake
            std::cout << "🔌 Socket.IO CONNECT received" << std::endl;
            // Now join the HVNC device namespace
            join_hvnc_namespace();
            break;
        }

        case '4':
        { // Connect to namespace response
            if (payload.find("/hvnc-device") != std::string::npos)
            {
                if (payload == "40/hvnc-device")
                {
                    std::cout << "🎉 Successfully joined /hvnc-device namespace!" << std::endl;
                    namespace_joined = true;
                    start_status_updates();
                }
                else
                {
                    std::cout << "❌ Failed to join namespace: " << payload << std::endl;
                }
            }
            break;
        }

        case '2':
        { // EVENT (might be namespaced)
            handle_socketio_event(data);
            break;
        }

        default:
            std::cout << "📋 Other message: " << payload << std::endl;
            break;
        }
    }

    void join_hvnc_namespace()
    {
        // Socket.IO v4 namespace join protocol: 40<namespace>
        std::string namespace_join = "40/hvnc-device";

        std::cout << "🔄 Joining /hvnc-device namespace..." << std::endl;

        try
        {
            websocketpp::lib::error_code ec;
            ws_client.send(connection_hdl, namespace_join, websocketpp::frame::opcode::text, ec);

            if (!ec)
            {
                std::cout << "📤 Namespace join request sent" << std::endl;
            }
            else
            {
                std::cout << "❌ Failed to send namespace join: " << ec.message() << std::endl;
            }
        }
        catch (const std::exception &e)
        {
            std::cout << "❌ Exception sending namespace join: " << e.what() << std::endl;
        }
    }

    void handle_socketio_event(const std::string &data)
    {
        std::cout << "🎯 Socket.IO Event: " << data << std::endl;

        // Parse JSON event data
        try
        {
            if (data.empty() || data[0] != '[')
                return;

            auto json_data = nlohmann::json::parse(data);
            if (json_data.is_array() && !json_data.empty())
            {
                std::string event_name = json_data[0];

                if (event_name == "authenticated")
                {
                    std::cout << "🎉 AUTHENTICATION SUCCESSFUL!" << std::endl;
                    if (json_data.size() > 1)
                    {
                        std::cout << "✅ Device info: " << json_data[1].dump(2) << std::endl;
                    }
                }
                else if (event_name == "auth_error")
                {
                    std::cout << "❌ AUTHENTICATION FAILED!" << std::endl;
                    if (json_data.size() > 1)
                    {
                        std::cout << "🔍 Error: " << json_data[1].dump(2) << std::endl;
                    }
                }
                else if (event_name == "command")
                {
                    std::cout << "🎯 Command received from server" << std::endl;
                    if (json_data.size() > 1)
                    {
                        std::cout << "📋 Command: " << json_data[1].dump(2) << std::endl;
                    }
                }
            }
        }
        catch (const std::exception &e)
        {
            std::cout << "⚠️ Failed to parse event JSON: " << e.what() << std::endl;
        }
    }

    void start_status_updates()
    {
        std::cout << "📤 Starting device status updates..." << std::endl;

        status_thread = std::thread([this]()
                                    {
            while (connected && namespace_joined) {
                send_device_status();
                std::this_thread::sleep_for(std::chrono::seconds(30));
            } });
    }

    void send_device_status()
    {
        if (!connected || !namespace_joined)
            return;

        // Create device status JSON
        nlohmann::json status;
        status["status"] = "online";
        status["cpu_usage"] = 45.2;
        status["memory_usage"] = 67.8;
        status["disk_usage"] = 23.1;
        status["timestamp"] = get_current_timestamp();

        // Socket.IO v4 namespaced event format: 42<namespace>,[event_name, data]
        std::string status_msg = "42/hvnc-device,[\"device_status\"," + status.dump() + "]";

        try
        {
            websocketpp::lib::error_code ec;
            ws_client.send(connection_hdl, status_msg, websocketpp::frame::opcode::text, ec);

            if (!ec)
            {
                std::cout << "📤 Device status sent to /hvnc-device namespace" << std::endl;
            }
            else
            {
                std::cout << "❌ Failed to send device status: " << ec.message() << std::endl;
            }
        }
        catch (const std::exception &e)
        {
            std::cout << "❌ Exception sending device status: " << e.what() << std::endl;
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
        namespace_joined = false;
    }

    void on_fail(websocketpp::connection_hdl hdl)
    {
        std::cout << "❌ WebSocket connection failed" << std::endl;

        // Get failure details
        client::connection_ptr con = ws_client.get_con_from_hdl(hdl);
        if (con)
        {
            std::cout << "🔍 Error code: " << con->get_ec().message() << std::endl;
            std::cout << "🔍 HTTP status: " << con->get_response_code() << std::endl;
            std::cout << "🔍 Response body: " << con->get_response_body() << std::endl;
        }

        connected = false;
        namespace_joined = false;
    }

public:
    void disconnect()
    {
        if (connected)
        {
            connected = false;
            namespace_joined = false;

            websocketpp::lib::error_code ec;
            ws_client.close(connection_hdl, websocketpp::close::status::normal, "Client disconnect", ec);

            if (ws_thread.joinable())
            {
                ws_thread.join();
            }

            if (status_thread.joinable())
            {
                status_thread.join();
            }
        }
    }

    bool is_connected() const
    {
        return connected;
    }

    bool is_namespace_joined() const
    {
        return namespace_joined;
    }
};

// Usage Example
int main()
{
    std::cout << "🚀 HVNC PC Agent - Fixed Socket.IO v4 Implementation" << std::endl;
    std::cout << "🔧 This version correctly handles namespace connections" << std::endl;
    std::cout << std::endl;

    // Configuration
    std::string server_url = "ws://localhost:4000";
    std::string device_id = "DEVICE-3863CCC752739530";
    std::string auth_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5YjQyOGQyZjQ4MDJkMjE5Y2QxOTdlOCIsImRldmljZV9pZCI6IkRFVklDRS0zODYzQ0NDNzUyNzM5NTMwIiwidHlwZSI6ImRldmljZSIsImlhdCI6MTc3MzQyMjk2MywiZXhwIjoxNzc2MDE0OTYzfQ.uLGJSq7YAdx19W8Tz3f0elofURfNt_NywDM6s72bBok";

    std::cout << "📋 Device ID: " << device_id << std::endl;
    std::cout << "🔗 Server URL: " << server_url << std::endl;
    std::cout << std::endl;

    // Create and connect client
    HVNCWebSocketClient client(server_url, auth_token, device_id);

    if (client.connect())
    {
        std::cout << "🔄 Connection initiated, waiting for results..." << std::endl;

        // Wait and monitor connection
        for (int i = 0; i < 60; i++)
        { // Wait up to 60 seconds
            std::this_thread::sleep_for(std::chrono::seconds(1));

            if (client.is_namespace_joined())
            {
                std::cout << "🎯 Connection fully established! Running for 30 more seconds..." << std::endl;
                std::this_thread::sleep_for(std::chrono::seconds(30));
                break;
            }

            if (!client.is_connected())
            {
                std::cout << "❌ Connection lost during setup" << std::endl;
                break;
            }
        }

        client.disconnect();
    }
    else
    {
        std::cout << "❌ Failed to initiate connection" << std::endl;
    }

    std::cout << "👋 HVNC PC Agent shutting down" << std::endl;
    return 0;
}