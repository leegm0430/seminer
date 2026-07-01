var gameCanvas = document.getElementById('gameCanvas');
var canvas1 = document.getElementById('Canvas1');
var canvas2 = document.getElementById('Canvas2');
var canvas3 = document.getElementById('Canvas3');
var canvas4 = document.getElementById('Canvas4');
var gameOverScreen = document.getElementById('GameOver');
var startButton = document.getElementById('Start');
var restartButton = document.getElementById('Restart');
gameCanvas.width = 480;
gameCanvas.height = 800;
var ctx = gameCanvas.getContext('2d');

ctx.translate(gameCanvas.width / 2, gameCanvas.height / 2);

var animationId;
var createEnemiesTimeout;
var enemies = [];
var starX, starY;


function drawStar(cx, cy, spikes, outerRadius, innerRadius, angle) {
    var rot = Math.PI / 2 * 3;
    var x = cx;
    var y = cy;
    var step = Math.PI / spikes;

    ctx.save();
    ctx.rotate(angle);

    ctx.strokeStyle = "black";
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius)
    for (var i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y)
        rot += step

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y)
        rot += step
    }
    ctx.lineTo(cx, cy - outerRadius)
    ctx.closePath();
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = 'yellow';
    ctx.fill();

    ctx.restore();
}

function drawHeart(x, y, size, angle) {
    ctx.save();
    ctx.translate(x, y); // 하트의 중심으로 이동
    ctx.rotate(angle); // 회전
    ctx.beginPath();
    ctx.moveTo(0, -size / 2);
    ctx.bezierCurveTo(size, -size, size * 2, -size / 3, 0, size);
    ctx.bezierCurveTo(-size * 2, -size / 3, -size, -size, 0, -size / 2);
    ctx.fillStyle = 'red';
    ctx.fill();
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.closePath();
    ctx.restore();
}

function clearCanvas() {
    ctx.clearRect(-gameCanvas.width / 2, -gameCanvas.height / 2, gameCanvas.width, gameCanvas.height);
}

var starX = getRandomNumber(-gameCanvas.width / 2, gameCanvas.width / 2);
var starY = getRandomNumber(-gameCanvas.height / 2, gameCanvas.height / 2);
var heartRotationAngle = 0.01;

function updateStarPosition() {
    drawStar(starX, starY, 5, 15, 7.5, 0);
    drawHeart(0, 0, 40, heartRotationAngle);
    heartRotationAngle += 0.00001
    requestAnimationFrame(updateStarPosition);
}

document.addEventListener('keydown', function(event) {
    if (event.key === 'ArrowUp') {
        starY -= 10;
    } else if (event.key === 'ArrowDown') {
        starY += 10;
    } else if (event.key === 'ArrowLeft') {
        starX -= 10;
    } else if (event.key === 'ArrowRight') {
        starX += 10;
    }
    updateStarPosition();
});

updateStarPosition();

function getRandomNumber(min, max) {
    return Math.random() * (max - min) + min;
}

var enemies = [];

function createEnemies() {
    var enemyCount = Math.floor(Math.random() * 11) + 5; // 5~15개의 적을 생성합니다.

    for (var i = 0; i < enemyCount; i++) {
        var canvasIndex = Math.floor(Math.random() * 4); // 랜덤한 캔버스 인덱스를 선택합니다.
        var canvas = [canvas1, canvas2, canvas3, canvas4][canvasIndex];
        var canvasPos = canvas.getBoundingClientRect();
        var enemyX = getRandomNumber(canvasPos.left, canvasPos.right) - gameCanvas.width / 2;
        var enemyY = getRandomNumber(canvasPos.top, canvasPos.bottom) - gameCanvas.height / 2;

        // gameCanvas 범위를 벗어나면 다시 생성 위치를 조정합니다.
        while (enemyX >= -gameCanvas.width / 2 && enemyX <= gameCanvas.width / 2 &&
            enemyY >= -gameCanvas.height / 2 && enemyY <= gameCanvas.height / 2) {
            canvasIndex = Math.floor(Math.random() * 4);
            canvas = [canvas1, canvas2, canvas3, canvas4][canvasIndex];
            canvasPos = canvas.getBoundingClientRect();
            enemyX = getRandomNumber(canvasPos.left, canvasPos.right) - gameCanvas.width / 2;
            enemyY = getRandomNumber(canvasPos.top, canvasPos.bottom) - gameCanvas.height / 2;
        }

        var enemySize = getRandomNumber(5, 10);
        var enemyColor = getRandomColor();

        enemies.push({ x: enemyX, y: enemyY, size: enemySize, color: enemyColor });
    }

    createEnemiesTimeout = setTimeout(createEnemies, Math.random() * 1000); // 다음 생성까지의 시간을 랜덤으로 설정합니다.
}

function drawEnemies() {
    for (var i = 0; i < enemies.length; i++) {
        var enemy = enemies[i];
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.size, 0, Math.PI * 2);
        ctx.fillStyle = enemy.color;
        ctx.fill();
        ctx.closePath();
    }
}

function getRandomColor() {
    var letters = '0123456789ABCDEF';
    var color = '#';
    for (var i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

function updateEnemies() {
    var playerX = starX;
    var playerY = starY;

    for (var i = 0; i < enemies.length; i++) {
        var enemy = enemies[i];
        var dx = playerX - enemy.x;
        var dy = playerY - enemy.y;
        var distance = Math.sqrt(dx * dx + dy * dy);
        var speed = 0.5;

        enemy.x += dx / distance * speed;
        enemy.y += dy / distance * speed;
    }
}

var bullets = []; // 총알을 저장할 배열

// 마우스 클릭 이벤트 핸들러
document.addEventListener('click', function(event) {
    var heartPosition = { x: 0, y: 0 }; // 하트의 위치

    // 하트에서 발사될 총알 개수
    var bulletCount = 5;
    // 별 모양 방향 계산
    var starDirection = calculateStarDirection(heartPosition, { x: event.clientX, y: event.clientY });
    
    // 별 모양 방향으로 총알 발사
    for (var i = 0; i < bulletCount; i++) {
        var angle = starDirection + heartRotationAngle + (Math.PI * 2 / bulletCount) * i;
        var bulletSpeed = 3;
        var bulletSize = 10;

        var dx = Math.cos(angle) * bulletSpeed;
        var dy = Math.sin(angle) * bulletSpeed;

        bullets.push({ x: heartPosition.x, y: heartPosition.y, dx: dx, dy: dy, size: bulletSize, color: 'green' });
    }
});

// 하트 위치에서 별 방향 계산
function calculateStarDirection(heartPosition, mousePosition) {
    var dx = mousePosition.x - heartPosition.x;
    var dy = mousePosition.y - heartPosition.y;

    return Math.atan2(dy, dx);
}

// 총알 그리기 함수
function drawBullets() {
    for (var i = 0; i < bullets.length; i++) {
        var bullet = bullets[i];
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
        ctx.fillStyle = bullet.color;
        ctx.fill();
        ctx.closePath();
    }
}

// 총알 업데이트 함수
function updateBullets() {
    for (var i = 0; i < bullets.length; i++) {
        var bullet = bullets[i];
        bullet.x += bullet.dx;
        bullet.y += bullet.dy;

        // 화면 밖으로 나간 총알 제거
        if (bullet.x < -gameCanvas.width / 2 || bullet.x > gameCanvas.width / 2 ||
            bullet.y < -gameCanvas.height / 2 || bullet.y > gameCanvas.height / 2) {
            bullets.splice(i, 1);
            i--;
        }
    }
}
var killedEnemiesCount = 0; // 죽인 적의 개수를 저장하는 변수

// 적을 제거하는 함수
function removeEnemy(index) {
    enemies.splice(index, 1);
    killedEnemiesCount++; // 적을 제거할 때마다 죽인 적의 개수 증가
}
function checkBulletEnemyCollision() {
    for (var i = 0; i < bullets.length; i++) {
        var bullet = bullets[i];
        for (var j = 0; j < enemies.length; j++) {
            var enemy = enemies[j];
            var dx = bullet.x - enemy.x;
            var dy = bullet.y - enemy.y;
            var distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < bullet.size + enemy.size) {
                // 충돌한 적과 총알을 배열에서 제거
                bullets.splice(i, 1);
                removeEnemy(j);
                //enemies.splice(j, 1);
                i--; // 배열이 변경되었으므로 인덱스 조정
                break; // 하나의 총알이 여러 적에 동시에 충돌하지 않도록 중단
            }
        }
    }
}
function drawKilledEnemiesCount() {
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText('Killed Enemies: ' + killedEnemiesCount,-gameCanvas.width / 2 + 10, -gameCanvas.height / 2 + 30);
}
function checkGameOver() {
    for (var i = 0; i < enemies.length; i++) {
        var enemy = enemies[i];
        var dx = starX - enemy.x;
        var dy = starY - enemy.y;
        var distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < enemy.size + 15) {
            return true;
        }
    }
    return false;
}

function displayGameOver() {
    cancelAnimationFrame(animationId);
    clearTimeout(createEnemiesTimeout);

    gameCanvas.style.display = 'none';
    canvas1.style.display = 'none';
    canvas2.style.display = 'none';
    canvas3.style.display = 'none';
    canvas4.style.display = 'none';
    gameOverScreen.style.display = 'block';
    document.body.style.backgroundColor = 'red';
    restartButton.style.display = 'block';
    
}

var animationId;
var createEnemiesTimeout;

function startGame() {
    bullets =[];
    startButton.style.display = 'none';
    gameOverScreen.style.display = 'none';
    gameCanvas.style.display = 'block';
    canvas1.style.display = 'block';
    canvas2.style.display = 'block';
    canvas3.style.display = 'block';
    canvas4.style.display = 'block';

    createEnemiesTimeout = setTimeout(function() {
        createEnemies();
        animationId = requestAnimationFrame(gameLoop);
    }, 1000);
}

function gameLoop() {
    if (checkGameOver()) {
        cancelAnimationFrame(animationId);
        clearTimeout(createEnemiesTimeout);
        displayGameOver();
    } else {
        updateCanvas();
        updateBullets(); // 총알 업데이트
        checkBulletEnemyCollision();
        drawBullets(); // 총알 그리기
        drawKilledEnemiesCount(); 
        animationId = requestAnimationFrame(gameLoop);
    }
}

function updateCanvas() {
    clearCanvas();
    ctx.translate(-starX, -starY);
    //drawStar(0,0,5,15,7.5,0);
    //updateStarPosition();
    drawEnemies();
    updateEnemies();
    ctx.translate(starX,starY);
}

window.onload = function() {
    updateCanvas();
    restartButton.addEventListener('click', restartGame);
};

function restartGame() {
    enemies = [];
    bullets = []; // 총알 배열 초기화
    starX = getRandomNumber(-gameCanvas.width / 2, gameCanvas.width / 2);
    starY = getRandomNumber(-gameCanvas.height / 2, gameCanvas.height / 2);
    killedEnemiesCount = 0; // 죽인 적의 수 초기화
    gameOverScreen.style.display = 'none';
    gameCanvas.style.display = 'block';
    canvas1.style.display = 'block';
    canvas2.style.display = 'block';
    canvas3.style.display = 'block';
    canvas4.style.display = 'block';
    cancelAnimationFrame(animationId);
    clearTimeout(createEnemiesTimeout);
    startGame();
    document.body.style.backgroundColor = '';
}
