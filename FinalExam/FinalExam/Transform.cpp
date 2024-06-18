#include "Transform.h"
#include <cmath>

Transform::Vertex Transform::MoveVertex(Transform::Vertex point, Transform::Vector meter) {
    point.x += meter.x_meter;
    point.y += meter.y_meter;
    return point;
}

Transform::Vertex Transform::RotateVertex(Transform::Vertex point, float angle_degree) {
    float rad = angle_degree * 3.14159265358979323846 / 180.0;
    float cos_angle = cos(rad);
    float sin_angle = sin(rad);
    float new_x = point.x * cos_angle - point.y * sin_angle;
    float new_y = point.x * sin_angle + point.y * cos_angle;
    point.x = new_x;
    point.y = new_y;
    return point;
}

Transform::Vertex Transform::ScaleVertex(Transform::Vertex point, Transform::Vector meter) {
    point.x *= meter.x_meter;
    point.y *= meter.y_meter;
    return point;
}
