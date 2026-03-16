# CMakeLists.txt for HVNC WebSocket Client Examples

cmake_minimum_required(VERSION 3.12)
project(HVNCWebSocketClient)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find packages
find_package(Threads REQUIRED)

# Option 1: WebSocketPP Client (Cross-platform)
if(NOT WIN32)
    find_package(PkgConfig REQUIRED)
    pkg_check_modules(WEBSOCKETPP REQUIRED websocketpp)
    
    add_executable(hvnc_websocket_client examples/hvnc-websocket-client.cpp)
    target_link_libraries(hvnc_websocket_client Threads::Threads)
    target_include_directories(hvnc_websocket_client PRIVATE ${WEBSOCKETPP_INCLUDE_DIRS})
endif()

# Option 2: Windows WinHTTP Client (Windows only)
if(WIN32)
    add_executable(hvnc_winhttp_client examples/hvnc-winhttp-client.cpp)
    target_link_libraries(hvnc_winhttp_client winhttp Threads::Threads)
    
    # Enable Unicode support
    target_compile_definitions(hvnc_winhttp_client PRIVATE UNICODE _UNICODE)
endif()

# Option 3: Simple libwebsockets client (Alternative)
find_path(LIBWEBSOCKETS_INCLUDE_DIR libwebsockets.h)
find_library(LIBWEBSOCKETS_LIBRARY websockets)

if(LIBWEBSOCKETS_INCLUDE_DIR AND LIBWEBSOCKETS_LIBRARY)
    add_executable(hvnc_libws_client examples/hvnc-libwebsockets-client.cpp)
    target_include_directories(hvnc_libws_client PRIVATE ${LIBWEBSOCKETS_INCLUDE_DIR})
    target_link_libraries(hvnc_libws_client ${LIBWEBSOCKETS_LIBRARY} Threads::Threads)
endif()

# Installation
install(TARGETS 
    $<$<BOOL:${WIN32}>:hvnc_winhttp_client>
    $<$<NOT:$<BOOL:${WIN32}>>:hvnc_websocket_client>
    DESTINATION bin
)