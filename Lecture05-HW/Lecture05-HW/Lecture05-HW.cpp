#include <GLFW/glfw3.h>
#include <iostream>
#include <cmath>

float moveFactor = 0.0f;
float scaleFactor = 1.0f;
double mouseX, mouseY;
bool leftMouseDown = false;
bool rightMouseDown = false;
double prevMouseX, prevMouseY;

void errorCallback(int error, const char* description)
{
    std::cerr << "GLFW Error: " << description << std::endl;
}

void keyCallback(GLFWwindow* window, int key, int scancode, int action, int mods)
{
    if (key == GLFW_KEY_ESCAPE && action == GLFW_PRESS)
    {
        glfwSetWindowShouldClose(window, GLFW_TRUE);
    }
    if (key == GLFW_KEY_UP && action == GLFW_PRESS)
    {
        moveFactor += 0.01f;
    }
    if (key == GLFW_KEY_RIGHT && action == GLFW_PRESS)
    {
        scaleFactor += 0.1f;
    }
}

void mouseButtonCallback(GLFWwindow* window, int button, int action, int mods)
{
    if (button == GLFW_MOUSE_BUTTON_LEFT && action == GLFW_PRESS)
    {
        leftMouseDown = true;
        glfwGetCursorPos(window, &prevMouseX, &prevMouseY);
    }
    else if (button == GLFW_MOUSE_BUTTON_LEFT && action == GLFW_RELEASE)
    {
        leftMouseDown = false;
    }
    else if (button == GLFW_MOUSE_BUTTON_RIGHT && action == GLFW_PRESS)
    {
        rightMouseDown = true;
        glfwGetCursorPos(window, &prevMouseX, &prevMouseY);
    }
    else if (button == GLFW_MOUSE_BUTTON_RIGHT && action == GLFW_RELEASE)
    {
        rightMouseDown = false;
    }
}

void cursorPosCallback(GLFWwindow* window, double xpos, double ypos)
{
    if (leftMouseDown)
    {
        double dx = xpos - prevMouseX;
        double dy = ypos - prevMouseY;

        moveFactor += static_cast<float>(dy) / 100.0f;

        prevMouseX = xpos;
        prevMouseY = ypos;
    }

    if (rightMouseDown)
    {
        double dx = xpos - prevMouseX;
        double dy = ypos - prevMouseY;

        scaleFactor += static_cast<float>(dx) / 100.0f;

        prevMouseX = xpos;
        prevMouseY = ypos;
    }
}

void render()
{
    const float PI = 3.14159265359f;
    const float outerRadius = 0.5f;
    const float innerRadius = 0.2f;

    // Draw central pentagon
    glBegin(GL_POLYGON);
    glColor3f(1.0f, 1.0f, 1.0f);
    for (int i = 0; i < 5; ++i)
    {
        float angle = 2.0f * PI / 5 * i;
        float x = innerRadius * std::cos(angle) * scaleFactor;
        float y = innerRadius * std::sin(angle) * scaleFactor + moveFactor;
        glVertex2f(x, y);
    }
    glEnd();

    // Draw triangles around pentagon to form a star
    glBegin(GL_TRIANGLES);
    glColor3f(1.0f, 1.0f, 1.0f); // Change color to white
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
}

int main(void)
{
    if (!glfwInit())
        return -1;

    GLFWwindow* window;
    window = glfwCreateWindow(1280, 768, "Star with Triangles", NULL, NULL);

    if (!window)
    {
        glfwTerminate();
        return -1;
    }

    glfwMakeContextCurrent(window);
    glfwSetErrorCallback(errorCallback);
    glfwSetKeyCallback(window, keyCallback);
    glfwSetMouseButtonCallback(window, mouseButtonCallback);
    glfwSetCursorPosCallback(window, cursorPosCallback);

    while (!glfwWindowShouldClose(window))
    {
        glfwPollEvents();
        glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT);

        render();

        glfwSwapBuffers(window);
    }

    glfwTerminate();
    return 0;
}
