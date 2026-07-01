#include <iostream>

// ANSI 이스케이프 코드로 색을 변경하는 함수
void setConsoleColour(int colourCode) {
    std::cout << "\x1b[" << colourCode << "m";
}

enum ForeColour {
    Default = 0,
    Black = 30,
    Red = 31,
    Green = 32,
    Yellow = 33,
    Blue = 34,
    Magenta = 35,
    Cyan = 36,
    White = 37,
};

int main()
{
    std::cout << "화면에 그림을 그리는 프로그램입니다.\n";
    std::cout << "학번: 202127037\n";
    std::cout << "이름: 이경민\n\n";

    int objectCode;
    while (true) {
        std::cout << "화면에 그릴 물체코드를 입력하세요 (프로그램 종료를 원하면 64 입력): ";
        std::cin >> objectCode;

        if (objectCode == 64) {
            std::cout << "프로그램을 종료합니다.\n";
            break;
        }

        // 해당 물체 코드에 따라 색을 선택하여 출력하는 코드 작성
        switch (objectCode) {
        case 1:
            setConsoleColour(ForeColour::White);
            std::cout << "□ \n";
            break;
        case 2:
            setConsoleColour(ForeColour::Red);
            std::cout << "■ \n";
            break;
        case 4:
            setConsoleColour(ForeColour::Green);
            std::cout << "■ \n"; 
            break;
        case 8:
            setConsoleColour(ForeColour::Yellow);
            std::cout << "■ \n";
            break;
        case 16:
            setConsoleColour(ForeColour::Cyan);
            std::cout << "■ \n";
            break;
        case 32:
            setConsoleColour(ForeColour::Magenta);
            std::cout << "■ \n";
            break;
        default:
            std::cout << "유효하지 않은 물체코드입니다. 다시 입력하세요.\n";
            continue; // 다시 입력받기
        }

        // 블록 출력 후에는 색을 원래대로 되돌려놓는 코드
        setConsoleColour(ForeColour::Default);
    }

    return 0;
}
