// [C++ game] very simple google dinosaur. (by. BlockDMask)
// 2019.12.03 (v2.0) Added score and collision handling.

#include <iostream>
#include <conio.h>
#include <windows.h>
#include <ctime>

#define DINO_BOTTOM_Y 12
#define TREE_BOTTOM_Y 20
#define TREE_BOTTOM_X 45

using namespace std;

// Function to set the console view size and title
void SetConsoleView() {
    system("mode con:cols=100 lines=25");
    system("title Google Dinosaurs. By BlockDMask.");
}

// Function to move the cursor to (x, y) position
void GotoXY(int x, int y) {
    COORD Pos;
    Pos.X = 2 * x;
    Pos.Y = y;
    SetConsoleCursorPosition(GetStdHandle(STD_OUTPUT_HANDLE), Pos);
}

// Function to get keyboard input
int GetKeyDown() {
    if (_kbhit() != 0) {
        return _getch();
    }
    return 0;
}

// Function to draw the dinosaur
void DrawDino(int dinoY) {
    GotoXY(0, dinoY);
    static bool legFlag = true;
    cout << "        $$$$$$$ \n";
    cout << "       $$ $$$$$$\n";
    cout << "       $$$$$$$$$\n";
    cout << "$      $$$      \n";
    cout << "$$     $$$$$$$  \n";
    cout << "$$$   $$$$$     \n";
    cout << " $$  $$$$$$$$$$ \n";
    cout << " $$$$$$$$$$$    \n";
    cout << "  $$$$$$$$$$    \n";
    cout << "    $$$$$$$$    \n";
    cout << "     $$$$$$     \n";
    if (legFlag) {
        cout << "     $    $$$    \n";
        cout << "     $$          ";
        legFlag = false;
    }
    else {
        cout << "     $$$  $     \n";
        cout << "          $$    ";
        legFlag = true;
    }
}

// Function to draw the tree
void DrawTree(int treeX) {
    GotoXY(treeX, TREE_BOTTOM_Y);
    cout << "$$$$";
    GotoXY(treeX, TREE_BOTTOM_Y + 1);
    cout << " $$ ";
    GotoXY(treeX, TREE_BOTTOM_Y + 2);
    cout << " $$ ";
    GotoXY(treeX, TREE_BOTTOM_Y + 3);
    cout << " $$ ";
    GotoXY(treeX, TREE_BOTTOM_Y + 4);
    cout << " $$ ";
}

// Function to draw the game over screen
void DrawGameOver(const int score) {
    system("cls");
    int x = 18;
    int y = 8;
    GotoXY(x, y);
    cout << "===========================\n";
    GotoXY(x, y + 1);
    cout << "======G A M E O V E R======\n";
    GotoXY(x, y + 2);
    cout << "===========================\n";
    GotoXY(x, y + 5);
    cout << "SCORE : " << score << endl;

    cout << "\n\n\n\n\n\n\n\n\n";
    system("pause");
}

// Function to check for collision
bool isCollision(const int treeX, const int dinoY) {
    GotoXY(0, 0);
    cout << "treeX : " << treeX << ", dinoY : " << dinoY; // Debug print
    if (treeX <= 8 && treeX >= 4 && dinoY > 8) {
        return true;
    }
    return false;
}

int main() {
    SetConsoleView();

    while (true) { // Game loop
        // Game initialization
        bool isJumping = false;
        bool isBottom = true;
        const int gravity = 3;

        int dinoY = DINO_BOTTOM_Y;
        int treeX = TREE_BOTTOM_X;

        int score = 0;
        clock_t start, curr; // Score variable initialization
        start = clock();     // Initialize start time

        while (true) { // Single game loop
            // Check for collision
            if (isCollision(treeX, dinoY)) break;

            // Jump if 'z' is pressed and dino is on the ground
            if (GetKeyDown() == ' ' && isBottom) {
                isJumping = true;
                isBottom = false;
            }

            // If jumping, decrease Y. If falling, increase Y.
            if (isJumping) {
                dinoY -= gravity;
            }
            else {
                dinoY += gravity;
            }

            // Prevent dino from going below the ground
            if (dinoY >= DINO_BOTTOM_Y) {
                dinoY = DINO_BOTTOM_Y;
                isBottom = true;
            }

            // Move tree leftward and reset position if it goes off-screen
            treeX -= 2;
            if (treeX <= 0) {
                treeX = TREE_BOTTOM_X;
            }

            // End jump when dino reaches peak height
            if (dinoY <= 3) {
                isJumping = false;
            }

            DrawDino(dinoY); // Draw dino
            DrawTree(treeX); // Draw tree

            // Update score every second
            curr = clock();
            if (((curr - start) / CLOCKS_PER_SEC) >= 1) {
                score++;
                start = clock();
            }
            Sleep(60);
            system("cls"); // Clear screen

            // Display score
            GotoXY(22, 0); // Move cursor to the top center
            cout << "Score : " << score; // Print score
        }

        // Game over screen
        DrawGameOver(score);
    }
    return 0;
}
