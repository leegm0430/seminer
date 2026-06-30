//Canvas Element 불러오기
var canvas = document.getElementById("GameScreenCanvas");
var ctx = canvas.getContext("2d");

class HeartObject{
    constructor(col, radius, positionX, positionY){
        this.color = col;
        this.radius = radius;
        this.positionX = positionX;
        this.positionY = positionY;
    }
    
    draw(){
        ctx.beginPath();
        for (var angle = 0; angle < Math.PI * 2; angle += 0.01) {
        var x = this.positionX + this.radius * Math.cos(angle);
        var y = this.positionY + this.radius * Math.sin(angle);
        ctx.lineTo(x, y);
        }
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();        
    }

}



function draw(){    
    var Circle = new HeartObject("blue", Math.random()*100, Math.random()*500, Math.random()*500);
    Circle.draw();
    requestAnimationFrame(draw);
}

draw();