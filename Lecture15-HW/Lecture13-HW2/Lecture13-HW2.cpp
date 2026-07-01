#pragma comment(lib, "Opengl32.lib")

#include <iostream>
#include <GLFW/glfw3.h>
#include <chrono>
#include <thread>

using namespace std;

float playerX = 0.0f;
float playerY = 0.0f;
float linemove = 0.0f;
const float gravity = -4.9f; // 중력 가속도 조정
float playerVelocityY = 0.0f;
bool isJumping = false;
bool spacePressed = false;
auto jumpStartTime = chrono::steady_clock::now();

void errorCallback(int error, const char* description) {
    std::cerr << "\033[1;31mGLFW Error: " << description << "\033[0m" << std::endl;
}

void keyCallback(GLFWwindow* window, int key, int scancode, int action, int mods) {
    if (key == GLFW_KEY_ESCAPE && action == GLFW_PRESS) {
        glfwSetWindowShouldClose(window, GLFW_TRUE);
    }
    if (key == GLFW_KEY_SPACE && action == GLFW_PRESS && !isJumping) {
        jumpStartTime = chrono::steady_clock::now();
        spacePressed = true;
    }
    if (key == GLFW_KEY_SPACE && action == GLFW_RELEASE && spacePressed) {
        auto jumpEndTime = chrono::steady_clock::now();
        chrono::duration<float> holdTime = jumpEndTime - jumpStartTime;
        float holdDuration = holdTime.count();

        // Limit the maximum hold duration to prevent excessively high jumps
        const float maxHoldDuration = 0.5f; // Adjust as necessary
        if (holdDuration > maxHoldDuration) {
            holdDuration = maxHoldDuration;
        }

        playerVelocityY = 3.0f + holdDuration * 2.0f; // Adjust the multiplier as necessary
        isJumping = true;
        spacePressed = false;
    }
}

struct Vector {
    float x;
    float y;
};

struct collider {
    Vector min;
    Vector max;
};

bool ColliderCheck(collider a, collider b) {
    if (a.max.x < b.min.x || a.min.x > b.max.x) return false;
    if (a.max.y < b.min.y || a.min.y > b.max.y) return false;
    return true;
}

int line() {
    glBegin(GL_QUADS);
    glColor3f(0.0f, 0.0f, 0.0f);
    glVertex2f(0.9995f + linemove, 1.0f);
    glVertex2f(0.9995f + linemove, -1.0f);
    glVertex2f(0.999f + linemove, -1.0f);
    glVertex2f(0.999f + linemove, 1.0f);
    glEnd();
    return 0;
}

int stagerender() {
    glBegin(GL_QUADS);
    glColor3f(0.0f, 0.0f, 0.0f);
    glVertex2f(-1.0f, -0.8f);
    glVertex2f(1.0f, -0.8f);
    glVertex2f(1.0f, -1.0f);
    glVertex2f(-1.0f, -1.0f);
    glEnd();
    return 0;
}

int player() {
    glBegin(GL_QUADS);
    glColor3f(1.0f, 0.0f, 0.0f);
    glVertex2f(-0.05f, -0.8f + playerY);
    glVertex2f(0.05f, -0.8f + playerY);
    glVertex2f(0.05f, -0.7f + playerY);
    glVertex2f(-0.05f, -0.7f + playerY);
    glEnd();
    return 0;
}

void updatePlayer(float deltaTime) {
    playerVelocityY += gravity * deltaTime; // 중력 적용
    playerY += playerVelocityY * deltaTime; // 속도 적용

    // 바닥에 닿았을 때
    if (playerY <= 0.0f) {
        playerY = 0.0f;
        playerVelocityY = 0.0f;
        isJumping = false;
    }
}

int main(void) {
    if (!glfwInit())
        return -1;

    GLFWwindow* window = glfwCreateWindow(1000, 1000, "MuSoeunEngine", NULL, NULL);

    if (!window) {
        glfwTerminate();
        return -1;
    }

    glfwMakeContextCurrent(window);
    glfwSetErrorCallback(errorCallback);
    glfwSetKeyCallback(window, keyCallback);

    auto prevTime = chrono::steady_clock::now();

    while (!glfwWindowShouldClose(window)) {
        glfwPollEvents();
        glClearColor(1.0f, 1.0f, 1.0f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT);

        // 현재 시간 측정
        auto currentTime = chrono::steady_clock::now();
        // 시간 차이 계산
        chrono::duration<float> deltaTime = currentTime - prevTime;
        prevTime = currentTime;

        updatePlayer(deltaTime.count());

        stagerender();
        line();
        linemove -= 0.016f;
        if (linemove < -2.0f) {
            linemove = 0.0f;
        }
        player();

        glfwSwapBuffers(window);

        // FPS 조정을 위한 sleep
        this_thread::sleep_for(chrono::milliseconds(16)); // 약 60 FPS
    }

    glfwTerminate();
    return 0;
}
