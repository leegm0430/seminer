#pragma comment(lib, "Opengl32.lib")

#include <GLFW/glfw3.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>

#define NUM_STARS 300

typedef struct {
    float x;
    float y;
    float r;
    float g;
    float b;
} Star;

float moveFactor = 0.0f;
float scaleFactor = 1.0f;

// Function to generate a random float value between min and max (inclusive)
float randomFloat(float min, float max) {
    return min + ((float)rand() / RAND_MAX) * (max - min);
}

void errorCallback(int error, const char* description) {
    fprintf(stderr, "GLFW Error: %s\n", description);
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

Star stars[NUM_STARS];  // Array to store Star objects

int initialize() {
    // Initialize random number generator
    srand((unsigned int)time(NULL));

    // Create NUM_STARS Star objects with random positions and colors
    for (int i = 0; i < NUM_STARS; i++) {
        stars[i].x = randomFloat(-1.0f, 1.0f);  // Random position
        stars[i].y = randomFloat(-1.0f, 1.0f);
        stars[i].r = randomFloat(0.0f, 1.0f);   // Random color
        stars[i].g = randomFloat(0.0f, 1.0f);
        stars[i].b = randomFloat(0.0f, 1.0f);
    }

    return 0;
}

int release() {
    // Deallocate memory for Star objects (not needed in C)
    return 0;
}

int update() {
    // Update positions based on moveFactor (optional for animation)
    // No need to update in this simple example
    return 0;
}

int render() {
    glClearColor(0.1f, 0.2f, 0.5f, 1.0f);
    glClear(GL_COLOR_BUFFER_BIT);

    // Render Stars
    for (int i = 0; i < NUM_STARS; i++) {
        glColor3f(stars[i].r, stars[i].g, stars[i].b);
        glBegin(GL_POINTS);
        glVertex2f(stars[i].x, stars[i].y);
        glEnd();
    }

    return 0;
}

int main(void) {
    // glfw initialization (same as before)
    if (!glfwInit()) {
        fprintf(stderr, "Failed to initialize GLFW\n");
        return -1;
    }

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
