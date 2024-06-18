
#pragma once
#include <GLFW/glfw3.h>
#include "Transform.h"
// Base class
float YCM(float a) {
    float b = 1.0f / 300.0f;
    return a * b;
}

float XCM(float a) {
    float b = (1.0f / 300.f) * (600.f / 800.f);

    return a * b;
}
class Object {
public:
    virtual void OnCollisionEnter(Object& other) {
    }
};


float xmove = XCM(200)/60;
float enemyposx = XCM(450);
float groundpos = YCM(-200);

// Derived classes
class Player : public Object {
public:
    Transform::Vertex position;
    float velocityY;  // y축 속도
    bool isJumping;   // 점프 상태
    bool isJumpKeyPressed;
    const float jumpAcceleration = 0.002f;
    const float initialJumpVelocity = 0.1f;
   
    Player() {
        position.x = 0.0f;
        position.y = 0.0f;
        velocityY = 0.0f;
        isJumping = false;
        isJumpKeyPressed = false;
    }
    void Jump() {
        if (!isJumping) {
            velocityY = 0.05f;
            isJumpKeyPressed = true;
            isJumping = true;
            
        }
    }

    void Update() {
        if (isJumping) {
            if (isJumpKeyPressed && velocityY < 0.15f) {
                velocityY += jumpAcceleration; // 점프 키가 눌린 상태에서는 가속도 추가
            }
            velocityY -= 0.005f;

            position.y += velocityY;
        }
        if (position.y <= 0.0f) {
            position.y = 0.0f;
            isJumping = false;
            velocityY = 0.0f;
        }
    }
    int playerrender() {
        Transform::Vertex vertices[4] = {
           {position.x, position.y+groundpos},
           {position.x, position.y + YCM(50) + groundpos},
           {position.x + XCM(50), position.y + YCM(50) + groundpos},
           {position.x + XCM(50), position.y + groundpos}
        };
        glBegin(GL_QUADS);
        glColor3f(1.0f, 0.0f, 0.0f);

        for (int i = 0; i < 4; ++i) {
            glVertex2f(vertices[i].x, vertices[i].y);
        }
        glEnd();
        glLineWidth(XCM(3));
        glBegin(GL_LINES);
        glColor3f(0.0f, 0.0f, 0.0f);
        glVertex2f(vertices[0].x, vertices[0].y);
        glVertex2f(vertices[1].x, vertices[1].y);
        glVertex2f(vertices[1].x, vertices[1].y);
        glVertex2f(vertices[2].x, vertices[2].y);
        glVertex2f(vertices[2].x, vertices[2].y);
        glVertex2f(vertices[3].x, vertices[3].y);
        glVertex2f(vertices[3].x, vertices[3].y);
        glVertex2f(vertices[0].x, vertices[0].y);
        glEnd();
        return 0;

    }
    void Move(Transform::Vector meter) {
        position = Transform::MoveVertex(position, meter);
    }

    //void Jump() {
    //    if (!isJumping) {
    //       /* velocityY = YCM(500)/60;*/  // 점프 초기 속도
    //        velocityY = YCM(5.0f)/60.0f;
    //        isJumping = true;
    //    }
    //}
    //void Update() {
    //    if (isJumping) {
    //        //velocityY -= YCM(490)/60; // 중력 효과
    //        velocityY -= YCM(9.81f) / 60.0f;
    //        position.y += velocityY;

    //        if (position.y <= 0.0f) { // 바닥에 닿았을 때
    //            position.y = 0.0f;
    //            isJumping = false;
    //            velocityY = 0.0f;
    //        }
    //    }
    //}

    void OnCollisionEnter(Object& other) override {
     
        

    }
};

class EnemyBlock : public Object {
public:
    Transform::Vertex position;
    Transform::Vertex initial_position; // 초기 위치 저장
   

    EnemyBlock(float startX, float startY) {
        position.x = startX;
        position.y = startY;
        initial_position = position; // 초기 위치 저장
       
    }

    void LowEnemyrender() {
        Transform::Vertex vertices[4] = {
            {position.x + XCM(0), position.y + YCM(0) + groundpos},
            {position.x + XCM(50), position.y + YCM(0) + groundpos},
            {position.x + XCM(50), position.y + YCM(100) + groundpos},
            {position.x + XCM(0), position.y + YCM(100) + groundpos}
        };

        glBegin(GL_QUADS);
        glColor3f(0.0f, 1.0f, 0.0f);

        for (int i = 0; i < 4; ++i) {
            glVertex2f(vertices[i].x, vertices[i].y);
        }

        glEnd();
    }

    void HighEnemyRender() {
        Transform::Vertex vertices[4] = {
            {position.x + XCM(0), position.y + YCM(0) + groundpos},
            {position.x + XCM(50), position.y + YCM(0) + groundpos},
            {position.x + XCM(50), position.y + YCM(300) + groundpos},
            {position.x + XCM(0), position.y + YCM(300) + groundpos}
        };

        glBegin(GL_QUADS);
        glColor3f(0.0f, 1.0f, 0.0f);

        for (int i = 0; i < 4; ++i) {
            glVertex2f(vertices[i].x, vertices[i].y);
        }

        glEnd();
    }

    void Move(Transform::Vector meter) {
        position = Transform::MoveVertex(position, meter);
    }

    void ResetPosition() {
        position = initial_position; // 초기 위치로 되돌림
    }

    void OnCollisionEnter(Object& other) override {
        // 충돌 처리 코드
    }

};

class Floor : public Object {
public:
    void groundrender() {
        glBegin(GL_QUADS);
        glColor3f(1.0f, 0.7843f, 0.0588f);
        glVertex2f(XCM(-400),YCM(-300));
        glVertex2f(XCM(400), YCM(-300));
         glVertex2f(XCM(400), YCM(-200));
        glVertex2f(XCM(-400), YCM(-200));
        glEnd();
    }
    void OnCollisionEnter(Object& other) override {
    }
};

class Star : public Object {
public:
    void OnCollisionEnter(Object& other) override {
    }
};


int PhysicsAABB(Object A, Object B)
{
    return 0;
}