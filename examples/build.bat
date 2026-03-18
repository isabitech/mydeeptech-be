@echo off
echo ========================================
echo HVNC WebSocket Client Build Script
echo ========================================
echo.

echo Checking build environment...

REM Check if vcpkg is available
where vcpkg >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ vcpkg not found in PATH
    echo Please install vcpkg and add to PATH for C++ dependencies
    echo.
) else (
    echo ✅ vcpkg found
)

REM Check if cmake is available
where cmake >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ cmake not found in PATH
    echo Please install CMake for C++ builds
    echo.
) else (
    echo ✅ cmake found
)

REM Check if python is available
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ python not found in PATH
    echo Please install Python for Python client
    echo.
) else (
    echo ✅ python found
)

echo.
echo ========================================
echo Build Options:
echo ========================================
echo 1. Build C++ WebSocket Client (websocketpp)
echo 2. Build C++ WinHTTP Client (Windows only)
echo 3. Test Python Client
echo 4. Install Python Dependencies
echo 5. Install C++ Dependencies (vcpkg)
echo 6. Exit
echo.

set /p choice=Enter your choice (1-6): 

if "%choice%"=="1" goto build_websocketpp
if "%choice%"=="2" goto build_winhttp
if "%choice%"=="3" goto test_python
if "%choice%"=="4" goto install_python_deps
if "%choice%"=="5" goto install_cpp_deps
if "%choice%"=="6" goto exit
goto invalid_choice

:build_websocketpp
echo.
echo Building C++ WebSocket Client...
if not exist build mkdir build
cd build
cmake .. -DCMAKE_TOOLCHAIN_FILE=%VCPKG_ROOT%/scripts/buildsystems/vcpkg.cmake
if %errorlevel% neq 0 (
    echo ❌ CMake configuration failed
    echo Make sure vcpkg is properly installed and VCPKG_ROOT is set
    pause
    goto menu
)
cmake --build .
if %errorlevel% neq 0 (
    echo ❌ Build failed
    pause
    goto menu
)
echo ✅ Build successful!
echo Run: build\hvnc_websocket_client.exe
cd ..
pause
goto menu

:build_winhttp
echo.
echo Building C++ WinHTTP Client...
echo Compiling with Visual Studio compiler...
cl hvnc-winhttp-client.cpp winhttp.lib /Fe:hvnc_winhttp_client.exe
if %errorlevel% neq 0 (
    echo ❌ Compilation failed
    echo Make sure Visual Studio is installed and Developer Command Prompt is used
    pause
    goto menu
)
echo ✅ Build successful!
echo Run: hvnc_winhttp_client.exe
pause
goto menu

:test_python
echo.
echo Testing Python Client...
python hvnc-python-client.py
pause
goto menu

:install_python_deps
echo.
echo Installing Python Dependencies...
pip install websockets
if %errorlevel% neq 0 (
    echo ❌ Failed to install Python dependencies
) else (
    echo ✅ Python dependencies installed
)
pause
goto menu

:install_cpp_deps
echo.
echo Installing C++ Dependencies with vcpkg...
vcpkg install websocketpp boost-system boost-thread nlohmann-json
if %errorlevel% neq 0 (
    echo ❌ Failed to install C++ dependencies
    echo Make sure vcpkg is properly installed
) else (
    echo ✅ C++ dependencies installed
)
pause
goto menu

:invalid_choice
echo Invalid choice. Please try again.
pause

:menu
cls
goto start

:exit
echo.
echo Build script finished.
pause