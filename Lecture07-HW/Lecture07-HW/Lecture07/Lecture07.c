
#include <GLFW/glfw3.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>


float moveFactor = 0.0f;
float scaleFactor = 1.0f;

void errorCallback(int error, const char* description)
{
	printf("\033[1;31mGLFW Error: %s \033[0m\n");
}

void keyCallback(GLFWwindow* window, int key, int scancode, int action, int mods)
{
	if (key == GLFW_KEY_ESCAPE && action == GLFW_PRESS)
	{
		glfwSetWindowShouldClose(window, GLFW_TRUE);
	}

}

struct Star
{
	float posX, posY;
	float scale;
	float r, g, b;
};

struct Star stars[5000];

int drawStar(struct Star star)
{
	glBegin(GL_TRIANGLES);

	glColor3f(star.r, star.g, star.b);
	glVertex2f((star.posX + 0.0f) * star.scale, (star.posY + 0.5f) * star.scale);
	glColor3f(star.r, star.g, star.b);
	glVertex2f((star.posX - 0.2f) * star.scale, (star.posY) * star.scale);
	glColor3f(star.r, star.g, star.b);
	glVertex2f((star.posX + 0.0f) * star.scale, (star.posY - 0.5f) * star.scale);

	glColor3f(star.r, star.g, star.b);
	glVertex2f((star.posX + 0.0f) * star.scale, (star.posY - 0.5f) * star.scale);
	glColor3f(star.r, star.g, star.b);
	glVertex2f((star.posX + 0.2f) * star.scale, (star.posY) * star.scale);
	glColor3f(star.r, star.g, star.b);
	glVertex2f((star.posX + 0.0f) * star.scale, (star.posY + 0.5f) * star.scale);

	glEnd();

}

int initialize()
{
	srand(time(NULL));
	int i = 0;
	while (i < 5000)
	{
		stars[i].posX = (float)(rand() % 2000) / 1000.0f - 1.0f;
		stars[i].posY = (float)(rand() % 2000) / 1000.0f - 1.0f;


		stars[i].scale = (float)(rand() % 1000) / 1000.0f;
		stars[i].r = (float)(rand() % 1000) / 1000.0f;
		stars[i].g = (float)(rand() % 1000) / 1000.0f;
		stars[i].b = (float)(rand() % 1000) / 1000.0f;
		i++;
	}
	return 0;
}
int release()
{
	return 0;
}

int update()
{
	return 0;
}

int render()
{
	glClearColor(0.1f, 0.2f, 0.5f, 1.0f);
	glClear(GL_COLOR_BUFFER_BIT);

	int i = 0;
	while (i < 5000)
	{
		drawStar(stars[i]);
		i++;
	}

	return 0;
}

int main(void)
{
	//glfw라이브러리 초기화
	if (!glfwInit())
		return -1;

	GLFWwindow* window;
	window = glfwCreateWindow(1280, 768, "MuSoeunEngine", NULL, NULL);

	if (!window)
	{
		glfwTerminate();
		return -1;
	}

	/* Make the window's context current */
	glfwMakeContextCurrent(window);
	glfwSetErrorCallback(errorCallback);
	glfwSetKeyCallback(window, keyCallback);

	initialize();

	while (!glfwWindowShouldClose(window))
	{
		glfwPollEvents();
		update();
		render();
		glfwSwapBuffers(window);
	}

	release();

	glfwTerminate();
	return 0;

}