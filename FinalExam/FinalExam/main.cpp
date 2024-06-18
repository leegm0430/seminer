#pragma comment(lib, "Opengl32.lib")

#define _CRTDBG_MAP_ALLOC
#include <crtdbg.h>


#ifdef _DEBUG
#define DBG_NEW new ( _NORMAL_BLOCK , __FILE__ , __LINE__ )
#else
#define DBG_NEW new
#endif



#include <GLFW/glfw3.h>
#include <stdio.h>
#include <chrono>
#include <thread>
#include <cmath>
#include "Object.h"
#include "Transform.h"




float displayx = 800;
float displayy = 600;
//bool jump = false;
bool spacePressed = false;
Player player;
void errorCallback(int error, const char* description)
{
	printf("GLFW Error: %s", description);
}

void keyCallback(GLFWwindow* window, int key, int scancode, int action, int mods) {
    if (key == GLFW_KEY_SPACE && action == GLFW_PRESS && !spacePressed) {
		spacePressed = true;
		player.Jump(); 
    }
	if (key == GLFW_KEY_SPACE && action == GLFW_PRESS && spacePressed) {
		spacePressed = false;
		player.Jump();
	}
}

Floor floorx;
EnemyBlock lowEnemy(XCM(1250), 0.0f); // 초기 위치를 (800, 0)으로 설정
EnemyBlock highEnemy(XCM(800), 0.0f);
int Physics()
{
	return 0;
}

int Initialize()
{
	return 0;
}

int Update() {
	
	
	// 적 이동 예제
	Transform::Vector enemy_move_vector = { -0.001f, 0.0f }; // 왼쪽으로 이동
	lowEnemy.Move(enemy_move_vector);
	highEnemy.Move(enemy_move_vector);
	 
	// 적이 화면 왼쪽을 벗어나면 초기 위치로 되돌림
	if (lowEnemy.position.x < XCM(-400)) {
		lowEnemy.ResetPosition();
	}
	if (highEnemy.position.x < XCM(-400)) {
		highEnemy.ResetPosition();
	}

	return 0;
}

int Render()
{

	
	floorx.groundrender();
	lowEnemy.LowEnemyrender();
	highEnemy.HighEnemyRender();
	player.playerrender();
	return 0;
}


int main(void)
{
	_CrtSetDbgFlag(_CRTDBG_ALLOC_MEM_DF | _CRTDBG_LEAK_CHECK_DF);

	
	//glfw라이브러리 초기화
	if (!glfwInit())
		return -1;

	GLFWwindow* window;
	window = glfwCreateWindow(displayx, displayy, "Google Dino Run Copy Game", NULL, NULL);

	if (!window)
	{
		glfwTerminate();
		return -1;
	}

	glfwMakeContextCurrent(window);
	glfwSetErrorCallback(errorCallback);
	glfwSetKeyCallback(window, keyCallback);

	Initialize();

	while (!glfwWindowShouldClose(window))
	{
		glfwPollEvents();
		glClear(GL_COLOR_BUFFER_BIT);
		glClearColor(0.0f, 0.1176f, 0.3922f,0.0f);
		/*if (jump) {
			printf("Jump button pressed! Initiating jump...\n");
			player.Jump();
			jump = false;
		}*/
		player.Update();
		Physics();
		Update();
		Render();
		glfwSwapBuffers(window);
	}

	glfwTerminate();
	return 0;

}