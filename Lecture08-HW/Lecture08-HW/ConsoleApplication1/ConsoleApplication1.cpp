#include <GLFW/glfw3.h>
#include <cmath>
#include <iostream>
#include <thread>
#include <chrono>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

// 태양, 지구, 달의 회전 각도
float sunRotAngle = 0;
float earthRotAngle = 0;
float moonRotAngle = 0;

// 회전 속도
float sunRotSpeed = 2 * M_PI / 30; // 태양의 자전주기를 30초로 설정
float earthRotSpeed = M_PI / 200;
float moonRotSpeed = 2 * M_PI / 4800; // 달의 공전 속도를 3초로 설정


void drawCircle(float x, float y, float radius, int segments) {
    glBegin(GL_POLYGON);
    for (int i = 0; i < segments; ++i) {
        float angle = 2.0f * M_PI * i / segments;
        glVertex2f(x + radius * cos(angle), y + radius * sin(angle));
    }
    glEnd();
}

void drawRing(float x, float y, float outerRadius, float innerRadius, int segments) {
    glBegin(GL_TRIANGLE_STRIP);
    for (int i = 0; i <= segments; ++i) {
        float angle = 2.0f * M_PI * i / segments;
        glVertex2f(x + outerRadius * cos(angle), y + outerRadius * sin(angle));
        glVertex2f(x + innerRadius * cos(angle), y + innerRadius * sin(angle));
    }
    glEnd();
}

void draw(GLFWwindow* window) {
    int width, height;
    glfwGetFramebufferSize(window, &width, &height);
    glViewport(0, 0, width, height);
    glClearColor(1.0f, 1.0f, 1.0f, 1.0f);
    glClear(GL_COLOR_BUFFER_BIT);

    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    glOrtho(0, width, height, 0, -1, 1);

    glMatrixMode(GL_MODELVIEW);
    glLoadIdentity();

    // 태양 그리기
    glPushMatrix();
    glTranslatef(width / 2, height / 2, 0);
    glRotatef(sunRotAngle * (180.0f / M_PI), 0, 0, 1);

    // 외곽 얇은 원 (주황색)
    glColor3f(1.0f, 0.5f, 0.0f); // Orange
    drawRing(0, 0, 40, 38, 100); // 얇은 원, 반지름 40, 두께 2

    // 큰 원 (#ffd966) 채우기
    glColor3f(1.0f, 0.85f, 0.4f); // #ffd966
    drawCircle(0, 0, 38, 100); // 채운 원, 반지름 38

    // 두 번째 원 (#ffe699), 9시 방향
    glPushMatrix();
    glColor3f(1.0f, 0.9f, 0.6f); // #ffe699
    glTranslatef(-20, 0, 0); // 9시 방향
    drawCircle(0, 0, 10, 100); // 작은 원, 반지름 10
    glPopMatrix();

    // 세 번째 원 (#ffc000), 5시 방향, 세로로 축소하고 45도 회전
    glPushMatrix();
    glColor3f(1.0f, 0.75f, 0.0f); // #ffc000
    glTranslatef(20, 20, 0); // 5시 방향
    glRotatef(45, 0, 0, 1);
    glScalef(1, 0.25f, 1); // 세로로 축소
    drawCircle(0, 0, 10, 100); // 작은 원, 반지름 10
    glPopMatrix();

    glPopMatrix();

    // 큰 원 그리기 (지구의 궤도)
    glColor3f(0.0f, 0.0f, 1.0f); // Blue
    glBegin(GL_LINE_LOOP);
    for (int i = 0; i < 360; ++i) {
        float angle = i * (M_PI / 180.0f);
        glVertex2f(width / 2 + 250 * cos(angle), height / 2 + 250 * sin(angle));
    }
    glEnd();

    // 지구 그리기
    glPushMatrix();
    glTranslatef(width / 2 + 500 * cos(earthRotAngle), height / 2 + 500 * sin(earthRotAngle), 0);
    glRotatef(-earthRotAngle * (180.0f / M_PI), 0, 0, 1);

    // 지구 본체
    glColor3f(0.36f, 0.61f, 0.83f); // #5b9bd5
    glBegin(GL_QUADS);
    glVertex2f(-20, -20);
    glVertex2f(20, -20);
    glVertex2f(20, 20);
    glVertex2f(-20, 20);
    glEnd();

    // 지구 테두리
    glColor3f(0.0f, 0.0f, 0.0f); // Black
    glBegin(GL_LINE_LOOP);
    glVertex2f(-20, -20);
    glVertex2f(20, -20);
    glVertex2f(20, 20);
    glVertex2f(-20, 20);
    glEnd();

    // 달 그리기 (노란색으로 변경)
    glPushMatrix();
    glColor3f(1.0f, 1.0f, 0.0f); // Yellow
    glTranslatef(100 * cos(earthRotAngle + moonRotAngle), 100 * sin(earthRotAngle + moonRotAngle), 0);
    drawCircle(0, 0, 5, 100); // 반지름 5인 노란색 원 그리기
    glPopMatrix();

    
    glPopMatrix(); // 지구 위치 복원

    glfwSwapBuffers(window);
}

int main() {
    if (!glfwInit()) return -1;

    int count = 0;

    Chrono :: steady_clock::time_point start = Chrono::steady_clock::now();
    Chrono::steady_clock::time _point end = Chorono::steady_clock::now();

    while (count < 10)
    {
        prey_end = end;
        end = Chrono::steady_clock::now();

        count++;
        cout << count << endl;


    }
    //GLFWwindow* window = glfwCreateWindow(800, 600, "Solar System", NULL, NULL);
    //if (!window) {
    //    glfwTerminate();
    //    return -1;
    //}

    //glfwMakeContextCurrent(window);

    //while (!glfwWindowShouldClose(window)) {
    //    draw(window);
    //    sunRotAngle += sunRotSpeed / 50;   // 태양의 회전 각도 업데이트
    //    earthRotAngle -= earthRotSpeed / 20; // 지구의 회전 각도 업데이트 (지구 중심으로)
    //    moonRotAngle += moonRotSpeed / 15;   // 달의 회전 각도 업데이트

    //    glfwPollEvents();
    //}

    glfwTerminate();
    return 0;
}
