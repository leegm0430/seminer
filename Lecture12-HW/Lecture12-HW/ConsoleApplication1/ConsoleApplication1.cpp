#include <iostream>
#include <chrono>
#include <thread>

using namespace std;

int main()
{
    int count = 0;
    int delay_time_ms = 1000; // 초기 슬립 시간은 1000ms (1초)

    while (count < 10)
    {
        // 루프 시작 시간 측정
        auto start = chrono::steady_clock::now();

        // 출력
        count++;
        cout << count << "   dur: " << delay_time_ms << " ms" << endl;

        // 루프 작업 수행 후 경과 시간 계산
        auto end = chrono::steady_clock::now();
        auto elapsed = chrono::duration_cast<chrono::milliseconds>(end - start).count();

        // 1초에서 경과된 시간을 뺀 나머지 시간만큼 슬립
        if (elapsed < 1000)
        {
            this_thread::sleep_for(chrono::milliseconds(1000 - elapsed));
        }

        // 다음 루프를 위한 슬립 시간 업데이트
        delay_time_ms = chrono::duration_cast<chrono::milliseconds>(chrono::steady_clock::now() - start).count();
    }

    return 0;
}
