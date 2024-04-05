//Canvas Element 불러오기
var canvas = document.getElementById("GameScreenCanvas");
var ctx = canvas.getContext("2d");

draw();
//setInterval(draw, 1000.0/60.0)

var sunRotAngle = 0; // 태양의 회전 각도
var earthRotAngle = 0; // 지구의 회전 각도
var moonRotAngle = 0; // 달의 회전 각도

function draw()
{
    sunRotAngle += Math.PI / 100; // 태양의 회전 각도 업데이트
    earthRotAngle -= Math.PI / 200; // 지구의 회전 각도 업데이트 (지구 중심으로)
    moonRotAngle += Math.PI / 80; // 달의 회전 각도 업데이트 (달 중심으로)

    ctx.save();
    // 태양 그리기
    ctx.fillStyle = "Red";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(3, 3); // 태양의 크기를 3배로 키움
    ctx.rotate(sunRotAngle);
    ctx.fillRect(-20, -20, 40, 40); // 태양은 네모로 가정합니다.
    ctx.restore();

    // 큰 원 그리기 (지구의 중심에 위치)
    ctx.save();
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 250, 0, Math.PI * 2); // 반지름을 250으로 줄임
    ctx.strokeStyle = "blue";
    ctx.stroke();
    ctx.closePath();

    // 지구 그리기
    ctx.save();
    ctx.translate(canvas.width / 2 + Math.cos(earthRotAngle) * 250, canvas.height / 2 + Math.sin(earthRotAngle) * 250);
    ctx.rotate(-earthRotAngle);
    ctx.fillStyle = "blue";
    ctx.fillRect(-10, -10, 20, 20); // 지구는 네모로 가정합니다.

    // 달 그리기
    ctx.save();
    ctx.translate(Math.cos(earthRotAngle + moonRotAngle) * 100, Math.sin(earthRotAngle + moonRotAngle) * 100);
    ctx.fillStyle = "gray";
    ctx.fillRect(-5, -5, 10, 10); // 달은 네모로 가정합니다.
    ctx.restore();

    ctx.restore(); // 지구 위치 복원

    requestAnimationFrame(draw);
}
