#include "MObject.h"
#include <GLFW/glfw3.h>

class Star : public MObject
{
	void update()
	{

	}
	void render()
	{
		glBegin(GL_TRIANGLES);

		glColor3f(0.7f, 0.8f, 0.85f);
		glVertex2f(0.0f, 0.5f);
		glColor3f(0.7f, 0.8f, 0.85f);
		glVertex2f(-0.2f, 0.0f);
		glColor3f(0.7f, 0.8f, 0.85f);
		glVertex2f(0.0f, -0.5f);

		glColor3f(0.7f, 0.8f, 0.85f);
		glVertex2f(0.0f, -0.5f);
		glColor3f(0.7f, 0.8f, 0.85f);
		glVertex2f(0.2f, 0.0f);
		glColor3f(0.7f, 0.8f, 0.85f);
		glVertex2f(0.0f, 0.5f);

		glEnd();
	}
};