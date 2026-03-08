cmake_minimum_required(VERSION 3.10)
project(imgui_stm32)

set(CMAKE_CXX_STANDARD 11)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ImGui sources
#set(IMGUI_DIR ${CMAKE_CURRENT_SOURCE_DIR}/imgui)
#set(IMGUI_SOURCES
#    ${IMGUI_DIR}/imgui.cpp
#    ${IMGUI_DIR}/imgui_demo.cpp
#    ${IMGUI_DIR}/imgui_draw.cpp
#    ${IMGUI_DIR}/imgui_tables.cpp
#    ${IMGUI_DIR}/imgui_widgets.cpp
 #   ${IMGUI_DIR}/backends/imgui_impl_glfw.cpp
#    ${IMGUI_DIR}/backends/imgui_impl_opengl3.cpp
#)


set(IMGUI_DIR ${CMAKE_CURRENT_SOURCE_DIR}/imgui)
file(GLOB IMGUI_SOURCES ${IMGUI_DIR}/*.cpp)
list(APPEND IMGUI_SOURCES
    ${IMGUI_DIR}/backends/imgui_impl_glfw.cpp
    ${IMGUI_DIR}/backends/imgui_impl_opengl3.cpp
)

# GLFW
set(GLFW_DIR ${CMAKE_CURRENT_SOURCE_DIR}/glfw)

# Executable
add_executable(imgui_app
    main.cpp
    ${IMGUI_SOURCES}
)

target_include_directories(imgui_app PRIVATE
    ${IMGUI_DIR}
    ${IMGUI_DIR}/backends
    ${GLFW_DIR}/include
)

target_compile_definitions(imgui_app PRIVATE 
	GLFW_INCLUDE_ES2
	GLFW_EXPOSE_NATIVE_WAYLAND

#	IMGUI_IMPL_OPENGL_LOADER_CUSTOM
	IMGUI_IMPL_OPENGL_ES2
)

target_link_libraries(imgui_app
    ${GLFW_DIR}/build/src/libglfw3.a
    GLESv2
    EGL
    dl
    pthread
    m
	curl
)