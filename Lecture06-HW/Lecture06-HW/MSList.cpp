#include "MSList.h"

template <typename T>
MSList<T>::MSList() {
    head = nullptr;
}

template <typename T>
MSList<T>::~MSList() {
    Node* current = head;
    while (current) {
        Node* next = current->next;
        delete current;
        current = next;
    }

    head = nullptr;
}

template <typename T>
void MSList<T>::insert(T* object) {
    Node* newNode = new Node;
    newNode->data = object;
    newNode->next = head;
    head = newNode;
}

template <typename T>
void MSList<T>::remove(T* object) {
    Node* previous = nullptr;
    Node* current = head;

    while (current && current->data != object) {
        previous = current;
        current = current->next;
    }

    if (current) {
        if (previous) {
            previous->next = current->next;
        }
        else {
            head = current->next;
        }

        delete current;
    }
}

template <typename T>
T* MSList<T>::find(T* object) {
    Node* current = head;
    while (current && current->data != object) {
        current = current->next;
    }

    return current ? current->data : nullptr;
}

template <typename T>
T* MSList<T>::get(int index) {
    Node* current = head;
    for (int i = 0; i < index && current; i++) {
        current = current->next;
    }

    return current ? current->data : nullptr;
}

template <typename T>
int MSList<T>::size() {
    int count = 0;
    Node* current = head;
    while (current) {
        count++;
        current = current->next;
    }

    return count;
}
