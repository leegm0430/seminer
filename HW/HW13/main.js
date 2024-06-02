const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let triangle = {
    x1: 400, y1: 100,
    x2: 300, y2: 400,
    x3: 500, y3: 400,
    color: 'blue',
    angle: 0
};

function drawTriangle() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(400, 300);
    ctx.rotate(triangle.angle);
    ctx.beginPath();
    ctx.moveTo(triangle.x1 - 400, triangle.y1 - 300);
    ctx.lineTo(triangle.x2 - 450, triangle.y2 - 300);
    ctx.lineTo(triangle.x3 - 300, triangle.y3 - 300);
    ctx.closePath();
    ctx.fillStyle = triangle.color;
    ctx.fill();
    ctx.restore();
}

function isPointInTriangle(px, py, ax, ay, bx, by, cx, cy) {
    const b0 = (px - ax) * (by - ay) - (py - ay) * (bx - ax);
    const b1 = (px - bx) * (cy - by) - (py - by) * (cx - bx);
    const b2 = (px - cx) * (ay - cy) - (py - cy) * (ax - cx);
    return (b0 >= 0 && b1 >= 0 && b2 >= 0) || (b0 <= 0 && b1 <= 0 && b2 <= 0);
}

canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const transformedX = x - 400;
    const transformedY = y - 300;
    

    if (isPointInTriangle(transformedX, transformedY,
        triangle.x1 - 400, triangle.y1 - 300,
        triangle.x2 - 450, triangle.y2 - 300,
        triangle.x3 - 400, triangle.y3 - 300)) {
       if(triangle.color ==='blue') {
        triangle.color = 'red';
    }
    } else if(triangle.color === 'red')
    {
        triangle.color = 'blue';
    }
    drawTriangle();
});

function animate() {
    triangle.angle += 0.01;
    drawTriangle();
    requestAnimationFrame(animate);
}

animate();
