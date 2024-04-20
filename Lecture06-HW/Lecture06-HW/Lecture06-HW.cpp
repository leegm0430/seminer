#pragma comment(lib, "Opengl32.lib")

#include <GLFW/glfw3.h>
#include <iostream>
#include <vector>
#include <random>
#include "MSList.h"

#include "Star.hpp"  // Assuming Star.hpp defines the Star class

const int NUM_STARS = 300;

float moveFactor = 0.0f;
float scaleFactor = 1.0f;

// Function to generate a random float value between min and max (inclusive)
float randomFloat(float min, float max) {
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_real_distribution<float> dis(min, max);
    return dis(gen);
}

void errorCallback(int error, const char* description) {
    std::cerr << "\033[1;31mGLFW Error: " << description << "\033[0m" << std::endl;
}

void keyCallback(GLFWwindow* window, int key, int scancode, int action, int mods) {
    if (key == GLFW_KEY_ESCAPE && action == GLFW_PRESS) {
        glfwSetWindowShouldClose(window, GLFW_TRUE);
    }
    if (key == GLFW_KEY_UP && action == GLFW_PRESS) {
        moveFactor += 0.01f;
    }
    if (key == GLFW_KEY_RIGHT && action == GLFW_PRESS) {
        scaleFactor += 0.1f;
    }
}

std::vector<Star*> stars;  // Vector to store Star objects

int initialize() {
    // Create NUM_STARS Star objects with random positions and colors
    for (int i = 0; i < NUM_STARS; i++) {
        Star* star = new Star();
        star->setPosition(randomFloat(-1.0f, 1.0f), randomFloat(-1.0f, 1.0f));  // Random position
        star->setColor(randomFloat(0.0f, 1.0f), randomFloat(0.0f, 1.0f), randomFloat(0.0f, 1.0f));  // Random color
        stars.push_back(star);
    }

    return 0;
}

int release() {
    // Deallocate memory for Star objects
    for (Star* star : stars) {
        delete star;
    }
    stars.clear();

    return 0;
}

int update() {
    // Update positions based on moveFactor (optional for animation)
    for (Star* star : stars) {
        // Update position logic here (e.g., star->setPosition(newX, newY))
    }

    return 0;
}

int render() {
    glClearColor(0.1f, 0.2f, 0.5f, 1.0f);
    glClear(GL_COLOR_BUFFER_BIT);

    for (Star* star : stars) {
        star->render();
    }

    return 0;
}

int main(void) {
    // glfw initialization (same as before)
    glfwInit();

    GLFWwindow* window = glfwCreateWindow(1280, 768, "MuSoeunEngine", NULL, NULL);

    if (!window) {
        glfwTerminate();
        return -1;
    }

    glfwMakeContextCurrent(window);
    glfwSetErrorCallback(errorCallback);
    glfwSetKeyCallback(window, keyCallback);

    initialize();

    while (!glfwWindowShouldClose(window)) {
        glfwPollEvents();
        update();
        render();
        glfwSwapBuffers(window);
    }

    release();

    glfwTerminate();
    return 0;
}
