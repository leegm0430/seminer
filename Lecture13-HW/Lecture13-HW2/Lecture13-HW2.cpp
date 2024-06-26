﻿#include <GLFW/glfw3.h>
#include <iostream>
#include <thread>
#include <chrono>
#include <vector>

const int WINDOW_WIDTH = 800;
const int WINDOW_HEIGHT = 600;

// 사각형 초기 위치와 크기
float rect_x = 100.0f;
float rect_y = WINDOW_HEIGHT - 100.0f; // 초기 위치는 바닥 위
const float rect_width = 50.0f;
const float rect_height = 50.0f;

// 점프 관련 변수
const float jump_speed = 400.0f; // 초기 점프 속도
const float gravity = 1000.0f;   // 중력 가속도
float velocity = 0.0f;           // 현재 속도
bool isJumping = false;          // 점프 상태
bool spacePressed = false;       // 스페이스 바 눌림 상태
auto jumpStartTime = std::chrono::steady_clock::now();

// 바닥 높이
const float ground_height = WINDOW_HEIGHT - 50.0f;

// 장애물 관련 변수
struct Obstacle {
    float obstacle_x;
    float obstacle_width;
};

std::vector<Obstacle> obstacles;
const float obstacleMoveSpeed = 200.0f; // 장애물 이동 속도

// GLFW 콜백 함수
void framebuffer_size_callback(GLFWwindow* window, int width, int height) {
    glViewport(0, 0, width, height);
}

// 입력 처리 함수
void processInput(GLFWwindow* window) {
    if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS)
        glfwSetWindowShouldClose(window, true);

    // 점프 상태에서는 스페이스 바 입력 무시
    if (isJumping) {
        return;
    }

    // 스페이스 바 처리
    if (glfwGetKey(window, GLFW_KEY_SPACE) == GLFW_PRESS && !spacePressed) {
        spacePressed = true;
        jumpStartTime = std::chrono::steady_clock::now();
    }
        
    if (glfwGetKey(window, GLFW_KEY_SPACE) == GLFW_RELEASE && spacePressed) {
        spacePressed = false;
        auto jumpEndTime = std::chrono::steady_clock::now();
        auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(jumpEndTime - jumpStartTime).count() / 1000.0f;

        // 최대 점프 시간 제한
        const float maxJumpDuration = 0.5f;
        if (duration > maxJumpDuration) {
            duration = maxJumpDuration;
        }

        velocity = -jump_speed * (1.0f + duration); // 점프 속도 계산
        isJumping = true;
    }
}


// 사각형 그리기 함수
void drawRectangle(float x, float y, float width, float height) {
    glBegin(GL_QUADS);
    glVertex2f(x, y);
    glVertex2f(x + width, y);
    glVertex2f(x + width, y + height);
    glVertex2f(x, y + height);
    glEnd();
}

// 바닥 그리기 함수
void drawGround(float y) {
    glBegin(GL_LINES);
    glVertex2f(0.0f, y);
    glVertex2f(WINDOW_WIDTH, y);
    glEnd();
}

// 장애물 추가 함수
const double obstacleSpawnInterval = 5.0; // 장애물 생성 간격 (초)
double lastObstacleSpawnTime = glfwGetTime();

void spawnObstacle() {
    Obstacle newObstacle;
    newObstacle.obstacle_x = WINDOW_WIDTH; // 화면 오른쪽 끝에서 시작
    newObstacle.obstacle_width = 30.0f;    // 장애물 너비 (조정 가능)
    obstacles.push_back(newObstacle);
}

// AABB 충돌 검사 함수
bool isCollision(float rect1_x, float rect1_y, float rect1_width, float rect1_height,
    float rect2_x, float rect2_y, float rect2_width, float rect2_height) {
    // 첫 번째 사각형의 AABB
    float rect1_left = rect1_x;
    float rect1_right = rect1_x + rect1_width;
    float rect1_bottom = rect1_y;
    float rect1_top = rect1_y + rect1_height;

    // 두 번째 사각형의 AABB
    float rect2_left = rect2_x;
    float rect2_right = rect2_x + rect2_width;
    float rect2_bottom = rect2_y;
    float rect2_top = rect2_y + rect2_height;

    // 충돌 체크
    if (rect1_right >= rect2_left && rect1_left <= rect2_right &&
        rect1_bottom <= rect2_top && rect1_top >= rect2_bottom) {
        return true; // 충돌 발생
    }

    return false; // 충돌 없음
}

// 메인 함수
int main() {
    if (!glfwInit()) {
        std::cerr << "GLFW 초기화 실패" << std::endl;
        return -1;
    }

    GLFWwindow* window = glfwCreateWindow(WINDOW_WIDTH, WINDOW_HEIGHT, "Jumping Rectangle", NULL, NULL);
    if (!window) {
        std::cerr << "GLFW 창 생성 실패" << std::endl;
        glfwTerminate();
        return -1;
    }

    glfwMakeContextCurrent(window);
    glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);

    // OpenGL 좌표계 설정
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    glOrtho(0.0, WINDOW_WIDTH, WINDOW_HEIGHT, 0.0, -1.0, 1.0);
    glMatrixMode(GL_MODELVIEW);

    double lastTime = glfwGetTime();
    const double frameDuration = 1.0 / 60.0; // 60FPS

    while (!glfwWindowShouldClose(window)) {
        // 입력 처리
        processInput(window);

        // 현재 시간 및 시간 간격 계산
        double currentTime = glfwGetTime();
        double deltaTime = currentTime - lastTime;
        lastTime = currentTime;

        // 장애물 생성 처리
        if (currentTime - lastObstacleSpawnTime >= obstacleSpawnInterval) {
            spawnObstacle();
            lastObstacleSpawnTime = currentTime;
        }

        // 사각형의 점프 처리
        if (isJumping) {
            velocity += gravity * deltaTime;
            rect_y += velocity * deltaTime;

            // 바닥에 도달하면 멈추기
            if (rect_y > ground_height - rect_height) {
                rect_y = ground_height - rect_height;
                isJumping = false;
                velocity = 0.0f;
            }
        }

        // 장애물의 위치 업데이트 및 화면을 벗어난 장애물 삭제
        for (auto it = obstacles.begin(); it != obstacles.end();) {
            it->obstacle_x -= obstacleMoveSpeed * deltaTime;

            // 화면 왼쪽 끝을 벗어난 장애물 삭제
            if (it->obstacle_x + it->obstacle_width < 0) {
                it = obstacles.erase(it);
            }
            else {
                // 충돌 검사
                if (isCollision(rect_x, rect_y, rect_width, rect_height,
                    it->obstacle_x, ground_height - rect_height, it->obstacle_width, rect_height)) {
                    // 충돌 처리: 여기서는 간단히 콘솔에 메시지 출력
                    std::cout << "Collision with obstacle!" << std::endl;
                    // 여기에 필요한 처리 추가 가능 (게임 오버 등)
                }

                ++it;
            }
        }

        // 화면 지우기 
        glClear(GL_COLOR_BUFFER_BIT);

        // 사각형 그리기
        glColor3f(0.0f, 0.0f, 1.0f); // 파란색 사각형
        drawRectangle(rect_x, rect_y, rect_width, rect_height);

        // 장애물 그리기
        glColor3f(1.0f, 0.0f, 0.0f); //
        for (auto& obstacle : obstacles) {
            drawRectangle(obstacle.obstacle_x, ground_height - rect_height, obstacle.obstacle_width, rect_height);
        }

        // 바닥 그리기
        glColor3f(0.5f, 0.5f, 0.5f); // 회색 바닥
        drawGround(ground_height);

        // 버퍼 교환
        glfwSwapBuffers(window);
        glfwPollEvents();
    }

    glfwTerminate();
    return 0;
}