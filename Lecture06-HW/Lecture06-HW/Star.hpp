#include "MObject.h"
#include <GLFW/glfw3.h>
#include <cmath>

class Star : public MObject
{
private:
    float moveFactor = 0.0f;
    float scaleFactor = 0.1f; // ���� ũ���� 1/3�� ũ�⸦ �����մϴ�.
    float positionX = 0.0f;
    float positionY = 0.0f;
    float colorR = 1.0f;
    float colorG = 1.0f;
    float colorB = 1.0f;

public:
    void update()
    {
        // �̵��̳� ũ�� ������ ������Ʈ�ϴ� �ڵ尡 ���⿡ �� �� �ֽ��ϴ�.
    }

    void render()
    {
        const float PI = 3.14159265359f;
        const float outerRadius = 0.5f; // ���� ũ�⿡ �°� ����
        const float innerRadius = 0.2f; // ���� ũ�⿡ �°� ����

        glPushMatrix();
        glTranslatef(positionX, positionY, 0.0f);

        // �߾� �������� �׸��ϴ�.
        glBegin(GL_POLYGON);
        glColor3f(colorR, colorG, colorB);
        for (int i = 0; i < 5; ++i)
        {
            float angle = 2.0f * PI / 5 * i;
            float x = innerRadius * std::cos(angle) * scaleFactor;
            float y = innerRadius * std::sin(angle) * scaleFactor + moveFactor;
            glVertex2f(x, y);
        }
        glEnd();

        // ������ ������ �ִ� �ﰢ���� �׷��� ���� �����մϴ�.
        glBegin(GL_TRIANGLES);
        glColor3f(colorR, colorG, colorB);
        for (int i = 0; i < 5; ++i)
        {
            float angle1 = 2.0f * PI / 5 * i;
            float angle2 = 2.0f * PI / 5 * ((i + 2) % 5);

            float x1 = outerRadius * std::cos(angle1) * scaleFactor;
            float y1 = outerRadius * std::sin(angle1) * scaleFactor + moveFactor;
            float x2 = innerRadius * std::cos(angle2) * scaleFactor;
            float y2 = innerRadius * std::sin(angle2) * scaleFactor + moveFactor;
            float x3 = outerRadius * std::cos(angle2) * scaleFactor;
            float y3 = outerRadius * std::sin(angle2) * scaleFactor + moveFactor;

            glVertex2f(x1, y1);
            glVertex2f(x2, y2);
            glVertex2f(x3, y3);
        }
        glEnd();

        glPopMatrix();
    }

    void setPosition(float x, float y)
    {
        positionX = x;
        positionY = y;
    }

    void setColor(float r, float g, float b)
    {
        colorR = r;
        colorG = g;
        colorB = b;
    }
};


