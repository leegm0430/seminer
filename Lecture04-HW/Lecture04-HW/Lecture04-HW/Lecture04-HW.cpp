#pragma comment(lib, "Opengl32.lib")
#include <glfw3.h>
#include <iostream>

const GLfloat clearColor[] = { 0.0f, 0.0f, 0.0f, 1.0f }; // 검정색
const GLfloat redColor[] = { 1.0f, 0.0f, 0.0f, 1.0f };    // 빨간색
const GLfloat greenColor[] = { 0.0f, 1.0f, 0.0f, 1.0f };  // 녹색
const GLfloat blueColor[] = { 0.0f, 0.0f, 1.0f, 1.0f };   // 파란색
const GLfloat magentaColor[] = { 1.0f, 0.0f, 1.0f, 1.0f }; // 마젠타색

// 현재 색깔 설정
GLfloat currentColor[] = { 0.0f, 0.0f, 0.0f, 1.0f }; // 초기값은 검정색

// 이벤트 콜백 함수들
void errorCallback(int error, const char* description) {
    std::cerr << "GLFW Error: " << description << std::endl;
}

void mouseButtonCallback(GLFWwindow* window, int button, int action, int mods) {
    // 마우스 버튼 누를 때
    if (action == GLFW_PRESS) {
        if (button == GLFW_MOUSE_BUTTON_RIGHT) {
            currentColor[0] = redColor[0];
            currentColor[1] = redColor[1];
            currentColor[2] = redColor[2];
            currentColor[3] = redColor[3];
        }
        else if (button == GLFW_MOUSE_BUTTON_LEFT) {
            currentColor[0] = greenColor[0];
            currentColor[1] = greenColor[1];
            currentColor[2] = greenColor[2];
            currentColor[3] = greenColor[3];
        }
    }
    // 마우스 버튼 뗄 때
    else if (action == GLFW_RELEASE) {
        currentColor[0] = clearColor[0];// 색깔 정의

        currentColor[1] = clearColor[1];
        currentColor[2] = clearColor[2];
        currentColor[3] = clearColor[3];
    }
}

void cursorPosCallback(GLFWwindow* window, double xpos, double ypos) {
    // 클릭 상태 확인
    int leftButtonState = glfwGetMouseButton(window, GLFW_MOUSE_BUTTON_LEFT);
    int rightButtonState = glfwGetMouseButton(window, GLFW_MOUSE_BUTTON_RIGHT);

    // 왼쪽 마우스 버튼 누른 상태에서 드래그 중
    if (leftButtonState == GLFW_PRESS) {
        currentColor[0] = magentaColor[0];
        currentColor[1] = magentaColor[1];
        currentColor[2] = magentaColor[2];
        currentColor[3] = magentaColor[3];
    }
    // 오른쪽 마우스 버튼 누른 상태에서 드래그 중
    else if (rightButtonState == GLFW_PRESS) {
        currentColor[0] = blueColor[0];
        currentColor[1] = blueColor[1];
        currentColor[2] = blueColor[2];
        currentColor[3] = blueColor[3];
    }
    // 클릭 상태가 유지되고 있지 않으면 검정색으로 변경
    else {
        currentColor[0] = clearColor[0];
        currentColor[1] = clearColor[1];
        currentColor[2] = clearColor[2];
        currentColor[3] = clearColor[3];
    }
}

int main(void) {
    // GLFW 라이브러리 초기화
    if (!glfwInit())
        return -1;

    // GLFW 윈도우 생성
    GLFWwindow* window;
    window = glfwCreateWindow(1280, 768, "Lecture04_HW", NULL, NULL);
    if (!window) {
        glfwTerminate();
        return -1;
    }

    // 윈도우 컨텍스트를 현재 컨텍스트로 만듦
    glfwMakeContextCurrent(window);
    glfwSetErrorCallback(errorCallback);
    glfwSetMouseButtonCallback(window, mouseButtonCallback);
    glfwSetCursorPosCallback(window, cursorPosCallback);

    /*  int render()
      {
          glBegin(GL_TRIANGLES);

          glColor3f(0.7f, 0.8f, 0.85f);
          glVertex2f(0.0f, 0.5f);
          glColor3f(0.7f, 0.8f, 0.85f);
          glVertex2f(-0.2f, 0.0f);
          glColor3f(0.7f, 0.8f, 0.85f);
          glVertex2f(0.0f, 0.0f);

          glColor3f(0.7f, 0.8f, 0.85f);
          glVertex2f(0.0f, -0.5f);
          glColor3f(0.7f, 0.8f, 0.85f);
          glVertex2f(0.2f, 0.0f);
          glColor3f(0.7f, 0.8f, 0.85f);
          glVertex2f(0.0f, 0.0f);
      }*/

      // 렌더링 루프
    while (!glfwWindowShouldClose(window)) {
        glClear(GL_COLOR_BUFFER_BIT); // 버퍼 지우기
        glClearColor(currentColor[0], currentColor[1], currentColor[2], currentColor[3]); // 현재 색으로 설정
        glfwSwapBuffers(window); // 버퍼 스왑
        glfwPollEvents(); // 이벤트 처리
    }

    // GLFW 종료
    glfwTerminate();
    return 0;
}
