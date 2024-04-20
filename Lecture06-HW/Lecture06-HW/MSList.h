#include <iostream>

template <typename T>
class MSList {
public:
    MSList();
    ~MSList();

    void insert(T* object);
    void remove(T* object);
    T* find(T* object);
    T* get(int index);
    int size();

private:
    struct Node {
        T* data;
        Node* next;
    };

    Node* head;
};

