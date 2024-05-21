#include <GLFW/glfw3.h>
#include <cmath>
#include <iostream>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

// 태양, 지구, 달의 회전 각도
float sunRotAngle = 0;
float earthRotAngle = 0;
float moonRotAngle = 0;

// 회전 속도
float sunRotSpeed = M_PI / 10;
float earthRotSpeed = M_PI / 200;
float moonRotSpeed = M_PI / 80;

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
    glColor3f(1.0f, 0.0f, 0.0f); // Red
    glTranslatef(width / 2, height / 2, 0);
    glRotatef(sunRotAngle * (180.0f / M_PI), 0, 0, 1);
    glBegin(GL_QUADS);
    glVertex2f(-20, -20);
    glVertex2f(20, -20);
    glVertex2f(20, 20);
    glVertex2f(-20, 20);
    glEnd();
    glPopMatrix();

    // 큰 원 그리기
    glColor3f(0.0f, 0.0f, 1.0f); // Blue
    glBegin(GL_LINE_LOOP);
    for (int i = 0; i < 360; ++i) {
        float angle = i * (M_PI / 180.0f);
        glVertex2f(width / 2 + 250 * cos(angle), height / 2 + 250 * sin(angle));
    }
    glEnd();

    // 지구 그리기
    glPushMatrix();
    glColor3f(0.0f, 0.0f, 1.0f); // Blue
    glTranslatef(width / 2 + 250 * cos(earthRotAngle), height / 2 + 250 * sin(earthRotAngle), 0);
    glRotatef(-earthRotAngle * (180.0f / M_PI), 0, 0, 1);
    glBegin(GL_QUADS);
    glVertex2f(-10, -10);
    glVertex2f(10, -10);
    glVertex2f(10, 10);
    glVertex2f(-10, 10);
    glEnd();

    // 달 그리기
    glPushMatrix();
    glColor3f(0.5f, 0.5f, 0.5f); // Gray
    glTranslatef(100 * cos(earthRotAngle + moonRotAngle), 100 * sin(earthRotAngle + moonRotAngle), 0);
    glBegin(GL_QUADS);
    glVertex2f(-5, -5);
    glVertex2f(5, -5);
    glVertex2f(5, 5);
    glVertex2f(-5, 5);
    glEnd();
    glPopMatrix();

    glPopMatrix(); // 지구 위치 복원

    glfwSwapBuffers(window);
}

int main() {
    if (!glfwInit()) return -1;

    GLFWwindow* window = glfwCreateWindow(800, 600, "Solar System", NULL, NULL);
    if (!window) {
        glfwTerminate();
        return -1;
    }

    glfwMakeContextCurrent(window);

    while (!glfwWindowShouldClose(window)) {
        draw(window);
        sunRotAngle += sunRotSpeed/50;   // 태양의 회전 각도 업데이트
        earthRotAngle -= earthRotSpeed/20; // 지구의 회전 각도 업데이트 (지구 중심으로)
        moonRotAngle += moonRotSpeed/15;   // 달의 회전 각도 업데이트 (달 중심으로)

        glfwPollEvents();
    }

    glfwTerminate();
    return 0;
}
