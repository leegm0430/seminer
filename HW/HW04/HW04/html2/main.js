//Canvas Element 불러오기
var canvas = document.getElementById("GameScreenCanvas");
var ctx = canvas.getContext("2d");

var studentID = 202127037;

function drawNum(num)
{

}

 // 숫자를 그리는 함수
 function drawNum(x, y, num) {
    var size = 40; // 숫자 크기
    var spacing = 10; // 각 숫자 사이 간격

    var digits = num.toString().split(""); // 숫자를 문자열로 변환하고 각 자리마다 분리

    // 각 숫자에 대한 선을 그리는 함수
    function drawDigit(startX, startY, digit) {
        switch (digit) {
            case '0':
                ctx.moveTo(startX, startY);
                ctx.lineTo(startX + size, startY);
                ctx.lineTo(startX + size, startY + size * 2);
                ctx.lineTo(startX, startY + size * 2);
                ctx.lineTo(startX, startY);
                break;
            case '1':
                ctx.moveTo(startX + size, startY);
                ctx.lineTo(startX + size, startY + size * 2);
                break;
            case '2':
                ctx.moveTo(startX, startY);
                ctx.lineTo(startX + size, startY);
                ctx.lineTo(startX + size, startY + size);
                ctx.lineTo(startX, startY + size);
                ctx.lineTo(startX, startY + size * 2);
                ctx.lineTo(startX + size, startY + size * 2);
                break;
            case '3':
                ctx.moveTo(startX, startY);
                ctx.lineTo(startX + size, startY);
                ctx.lineTo(startX + size, startY + size * 2);
                ctx.lineTo(startX, startY + size * 2);
                ctx.moveTo(startX, startY + size);
                ctx.lineTo(startX + size, startY + size);
                break;
            case '4':
                ctx.moveTo(startX, startY);
                ctx.lineTo(startX, startY + size);
                ctx.lineTo(startX + size, startY + size);
                ctx.lineTo(startX + size, startY);
                ctx.lineTo(startX + size, startY + size * 2);
                break;
            case '5':
                ctx.moveTo(startX + size, startY);
                ctx.lineTo(startX, startY);
                ctx.lineTo(startX, startY + size);
                ctx.lineTo(startX + size, startY + size);
                ctx.lineTo(startX + size, startY + size * 2);
                ctx.lineTo(startX, startY + size * 2);
                break;
            case '6':
                ctx.moveTo(startX + size, startY);
                ctx.lineTo(startX, startY);
                ctx.lineTo(startX, startY + size * 2);
                ctx.lineTo(startX + size, startY + size * 2);
                ctx.lineTo(startX + size, startY + size);
                ctx.lineTo(startX, startY + size);
                break;
            case '7':
                ctx.moveTo(startX, startY);
                ctx.lineTo(startX + size, startY);
                ctx.lineTo(startX + size, startY + size * 2);
                break;
            case '8':
                ctx.moveTo(startX, startY);
                ctx.lineTo(startX + size, startY);
                ctx.lineTo(startX + size, startY + size * 2);
                ctx.lineTo(startX, startY + size * 2);
                ctx.lineTo(startX, startY);
                ctx.lineTo(startX + size, startY);
                ctx.lineTo(startX + size, startY + size);
                ctx.lineTo(startX, startY + size);
                break;
            case '9':
                ctx.moveTo(startX + size, startY);
                ctx.lineTo(startX, startY);
                ctx.lineTo(startX, startY + size);
                ctx.lineTo(startX + size, startY + size);
                ctx.lineTo(startX + size, startY);
                ctx.lineTo(startX + size, startY + size * 2);
                ctx.lineTo(startX, startY + size * 2);
                break;
            default:
                break;
        }
    }

    // 숫자 그리기
    var currentX = x;
    digits.forEach(digit => {
        drawDigit(currentX, y, digit);
        currentX += size + spacing;
    });
    ctx.stroke();
}

// 학생 ID
var studentID = 202127037;

// 디지털 숫자 그리기 시작 좌표 0,0 고정하면 위에 틀하고 
drawNum(0, 0, studentID);
// (50,300) (974,300) magenta 3
/* ctx.beginPath();
ctx.moveTo(50,canvas.height/2);
ctx.lineTo(canvas.width - 50, canvas.height/2);
ctx.strokeStyle = "magenta";
ctx.lineWidth = 3;
ctx.stroke();
ctx.closePath(); */

drawNum(studentID);     //화면 우측 상단에 숫자 쓰기