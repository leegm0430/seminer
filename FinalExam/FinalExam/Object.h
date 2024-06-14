#pragma once

#include <GLFW/glfw3.h>

class Object {
public:
    virtual void OnCollisionEnter(Object& other) {}
};

class Player : public Object {
private:
    float collisionBoxWidth = 50.0f; // 50cm 크기의 충돌 박스 너비
    float collisionBoxHeight = 50.0f; // 50cm 크기의 충돌 박스 높이
    float playerHeight = -.0f;  // 플레이어 높이 (100cm 바닥 위)

public:
    void OnCollisionEnter(Object& other) override {
        // 충돌 검사 로직 예시
        // 여기에 충돌 박스와 다른 객체(other)의 충돌 여부를 확인하는 코드를 추가할 수 있음
    }

    float GetCollisionBoxWidth() const { return collisionBoxWidth; }
    float GetCollisionBoxHeight() const { return collisionBoxHeight; }

    void Draw() {
        // Set the color to red (R:1, G:0, B:0)
        glColor3f(1.0f, 0.0f, 0.0f);

        // Calculate half-width and half-height
        float halfWidth = collisionBoxWidth / 2.0f / 200.0f;   // 50cm를 OpenGL 좌표로 변환
        float halfHeight = collisionBoxHeight / 2.0f / 200.0f; // 50cm를 OpenGL 좌표로 변환

        // Draw a red rectangle centered at (0, playerHeight)
        glBegin(GL_QUADS);
        glVertex2f(-halfWidth, playerHeight / 200.0f - halfHeight);    // Bottom-left vertex
        glVertex2f(halfWidth, playerHeight / 200.0f - halfHeight);     // Bottom-right vertex
        glVertex2f(halfWidth, playerHeight / 200.0f + halfHeight);     // Top-right vertex
        glVertex2f(-halfWidth, playerHeight / 200.0f + halfHeight);    // Top-left vertex
        glEnd();
    }
};

class EnemyBlock : public Object {
public:
    void OnCollisionEnter(Object& other) override {
    }
};

class Floor : public Object {
private:
    float height = 100.0f;  // 바닥으로부터의 높이 (100cm)

public:
    void OnCollisionEnter(Object& other) override {
    }

    void Draw() {
        // Draw the yellow background
        

        glBegin(GL_QUADS);
        glColor3f(255.0f / 255.0f, 200.0f / 255.0f, 15.0f / 255.0f);  // Yellow color
        glVertex2f(-1.0f, -height / 200.0f);   // Bottom-left vertex
        glVertex2f(1.0f, -height / 200.0f);    // Bottom-right vertex
        glVertex2f(1.0f, -1.0f);               // Top-right vertex
        glVertex2f(-1.0f, -1.0f);              // Top-left vertex
        glEnd();

        glBegin(GL_LINES);
        glVertex2f(-1.0f, -height / 200.0f);   // Start of the line
        glVertex2f(1.0f, -height / 200.0f);    // End of the line
        glEnd();
    }

    float GetHeight() const { return height; }
};

class Star : public Object {
public:
    void OnCollisionEnter(Object& other) override {
    }
};

int PhysicsAABB(Object A, Object B) {
    return 0;
}
