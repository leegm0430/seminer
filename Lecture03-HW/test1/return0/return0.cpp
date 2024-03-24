#include <iostream>

//using namespace std; 

//int main()
//{
//	int num;
//	cout << "백호영 : 아름답다... ";               // using namespace std; 라는 네임스페이스를 사용 했을 경우
//	cin >> num;
//	cout << "백호영 : 송우근 이.." << num;
//	return 0;
//}

int main()
{
	int num = 0;
	std::string name;
	std::cout << "백호영 : 아름답다..." << std::endl;               //using namespace std; 를 사용 하지 않을 경우
	
	while (num != 18)
	{
		std::cout << "나쁜놈의 이름과 나이를 입력하세요: " << std::endl;
		std::cin >> name >> num;
	}
	std::cout << "백호영 : " << num << "이.." << name << std::endl;
	return 0;
}

