#pragma once

#include <GLFW/glfw3.h>

class Object {
public:
    virtual void OnCollisionEnter(Object& other) {}
};

class Player : public Object {
private:
    float collisionBoxWidth = 50.0f; // 50cm ũ���� �浹 �ڽ� �ʺ�
    float collisionBoxHeight = 50.0f; // 50cm ũ���� �浹 �ڽ� ����
    float playerHeight = -.0f;  // �÷��̾� ���� (100cm �ٴ� ��)

public:
    void OnCollisionEnter(Object& other) override {
        // �浹 �˻� ���� ����
        // ���⿡ �浹 �ڽ��� �ٸ� ��ü(other)�� �浹 ���θ� Ȯ���ϴ� �ڵ带 �߰��� �� ����
    }

    float GetCollisionBoxWidth() const { return collisionBoxWidth; }
    float GetCollisionBoxHeight() const { return collisionBoxHeight; }

    void Draw() {
        // Set the color to red (R:1, G:0, B:0)
        glColor3f(1.0f, 0.0f, 0.0f);

        // Calculate half-width and half-height
        float halfWidth = collisionBoxWidth / 2.0f / 200.0f;   // 50cm�� OpenGL ��ǥ�� ��ȯ
        float halfHeight = collisionBoxHeight / 2.0f / 200.0f; // 50cm�� OpenGL ��ǥ�� ��ȯ

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
    float height = 100.0f;  // �ٴ����κ����� ���� (100cm)

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
