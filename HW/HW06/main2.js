// Canvas Element 불러오기
var canvas = document.getElementById("GameScreenCanvas");
var ctx = canvas.getContext("2d");

// 하트를 그리는 함수
function drawHeart(x, y, size, color) {
  ctx.beginPath();
  ctx.moveTo(x, y + size / 4);
  ctx.quadraticCurveTo(x, y, x + size / 4, y);
  ctx.quadraticCurveTo(x + size / 2, y, x + size / 2, y + size / 4);
  ctx.quadraticCurveTo(x + size / 2, y, x + size * 3 / 4, y);
  ctx.quadraticCurveTo(x + size, y, x + size, y + size / 4);
  ctx.quadraticCurveTo(x + size, y + size / 2, x + size * 3 / 4, y + size * 3 / 4);
  ctx.lineTo(x + size / 2, y + size);
  ctx.lineTo(x + size / 4, y + size * 3 / 4);
  ctx.quadraticCurveTo(x, y + size / 2, x, y + size / 4);
  ctx.fillStyle = color;
  ctx.fill();
}

// 무작위 위치와 크기를 갖는 하트를 그립니다.
function drawRandomHeart() {
  var x = Math.random() * canvas.width;
  var y = Math.random() * canvas.height;
  var size = Math.random() * 50 + 30; // 크기는 최소 30부터 80까지 무작위로 선택합니다.
  var color = getRandomColor();
  drawHeart(x, y, size, color);
}

// 랜덤한 색상 반환
function getRandomColor() {
  return '#' + Math.floor(Math.random() * 16777215).toString(16);
}

// 1초에 한 번씩 무작위 하트 그리기
setInterval(drawRandomHeart, 1000);
