@echo off
echo 🚀 Testing PC Agent Connection
echo ===============================

echo.
echo 📋 Step 1: Compiling PC agent...
g++ -o pc_agent_test.exe hvnc/pc_agent_websocket_fixed.cpp -lws2_32

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Compilation failed
    pause
    exit /b 1
)

echo ✅ Compilation successful

echo.
echo 📋 Step 2: Starting PC agent...
echo 💡 The agent will show connection status and stay connected
echo 💡 Check server logs for "Raw Connection Success" message
echo 💡 Press Ctrl+C to stop the agent
echo.

pc_agent_test.exe

echo.
echo 👋 PC Agent stopped
pause