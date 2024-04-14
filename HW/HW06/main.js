// Canvas Element 불러오기
var canvas = document.getElementById("GameScreenCanvas");
var ctx = canvas.getContext("2d");

var colors = ["#C7C5FF", "black", "blue", "magenta", "pink", "cyan", "orange"];

class Heartobject {
    constructor(colorIndex, size, positionX, positionY) {
        this.color = colors[colorIndex];
        this.size = size;
        this.positionX = positionX;
        this.positionY = positionY;
    }

    draw() {
        ctx.save();
        ctx.beginPath();

        ctx.translate(this.positionX, this.positionY);
        ctx.scale(this.size, this.size);

        ctx.moveTo(0, 0.4);
        ctx.lineTo(-0.3, 0.1);
        ctx.arc(-0.1, 0.1, 0.2, Math.PI, 0, false);
        ctx.arc(0.2, 0.1, 0.2, Math.PI, 0, false);
        ctx.lineTo(0, 0.4);

        ctx.fillStyle = this.color;
        ctx.fill();

        ctx.closePath();
        ctx.restore();
    }
}

// 하트 객체를 담을 배열 생성
var hearts = [];

// 마우스 이벤트 리스너 추가
canvas.addEventListener('mousemove', function(event) {
    var mouseX = event.clientX - canvas.getBoundingClientRect().left;
    var mouseY = event.clientY - canvas.getBoundingClientRect().top;

    // 총 하트 개수가 100개가 넘지 않도록 조절
    if (hearts.length < 100) {
        // 배열에 하트 객체 추가
        hearts.push(new Heartobject(Math.round(Math.random() * 6), Math.random() * 100, mouseX, mouseY));
    } else {
        // 배열의 맨 처음에 있는 하트 제거
        hearts.shift();
        // 새로운 하트 객체 추가
        hearts.push(new Heartobject(Math.round(Math.random() * 6), Math.random() * 100, mouseX, mouseY));
    }
});

// 렌더링 함수
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // 캔버스 지우기

    // 배열의 각 하트 객체를 반복하여 그리기
    hearts.forEach(function(heart) {
        heart.draw();
    });

    requestAnimationFrame(render);
}

// 렌더링 시작
render();
