// ゲーム定数
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const COLORS = {
    I: '#00f0f0',
    O: '#f0f000',
    T: '#a000f0',
    S: '#00f000',
    Z: '#f00000',
    J: '#0000f0',
    L: '#f0a000'
};

// テトロミノの形状定義
const SHAPES = {
    I: [
        [[0,0,0,0],
         [1,1,1,1],
         [0,0,0,0],
         [0,0,0,0]]
    ],
    O: [
        [[1,1],
         [1,1]]
    ],
    T: [
        [[0,1,0],
         [1,1,1],
         [0,0,0]]
    ],
    S: [
        [[0,1,1],
         [1,1,0],
         [0,0,0]]
    ],
    Z: [
        [[1,1,0],
         [0,1,1],
         [0,0,0]]
    ],
    J: [
        [[1,0,0],
         [1,1,1],
         [0,0,0]]
    ],
    L: [
        [[0,0,1],
         [1,1,1],
         [0,0,0]]
    ]
};

// ゲーム状態
let canvas, ctx, nextCanvas, nextCtx;
let board = [];
let currentPiece = null;
let nextPiece = null;
let score = 0;
let lines = 0;
let level = 1;
let gameOver = false;
let isPaused = false;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let bag = [];

// 初期化
function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    nextCanvas = document.getElementById('nextCanvas');
    nextCtx = nextCanvas.getContext('2d');

    // ボード初期化
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));

    // イベントリスナー
    document.addEventListener('keydown', handleKeyPress);
    document.getElementById('restartBtn').addEventListener('click', restart);

    // モバイルコントロール
    document.getElementById('btnLeft').addEventListener('touchstart', (e) => {
        e.preventDefault();
        move(-1);
    });
    document.getElementById('btnRight').addEventListener('touchstart', (e) => {
        e.preventDefault();
        move(1);
    });
    document.getElementById('btnRotate').addEventListener('touchstart', (e) => {
        e.preventDefault();
        rotate();
    });
    document.getElementById('btnDown').addEventListener('touchstart', (e) => {
        e.preventDefault();
        moveDown();
    });
    document.getElementById('btnDrop').addEventListener('touchstart', (e) => {
        e.preventDefault();
        hardDrop();
    });

    // ゲーム開始
    restart();
}

// 7バッグ方式でピース生成
function generateBag() {
    const pieces = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
    for (let i = pieces.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }
    return pieces;
}

function getNextPiece() {
    if (bag.length === 0) {
        bag = generateBag();
    }
    const type = bag.pop();
    return {
        type: type,
        shape: JSON.parse(JSON.stringify(SHAPES[type][0])),
        x: Math.floor(COLS / 2) - Math.floor(SHAPES[type][0][0].length / 2),
        y: 0,
        color: COLORS[type]
    };
}

// ゲーム再開
function restart() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    score = 0;
    lines = 0;
    level = 1;
    gameOver = false;
    isPaused = false;
    dropCounter = 0;
    dropInterval = 1000;
    bag = [];

    currentPiece = getNextPiece();
    nextPiece = getNextPiece();

    updateScore();
    document.getElementById('gameOver').classList.add('hidden');

    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

// ゲームループ
function gameLoop(time = 0) {
    if (gameOver) return;

    const deltaTime = time - lastTime;
    lastTime = time;

    if (!isPaused) {
        dropCounter += deltaTime;
        if (dropCounter > dropInterval) {
            moveDown();
            dropCounter = 0;
        }
    }

    draw();
    requestAnimationFrame(gameLoop);
}

// 描画
function draw() {
    // メインキャンバスクリア
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ボード描画
    drawBoard();

    // 現在のピース描画
    if (currentPiece) {
        drawPiece(currentPiece, ctx);
    }

    // グリッド描画
    drawGrid();

    // Nextピース描画
    drawNextPiece();
}

function drawBoard() {
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (board[y][x]) {
                ctx.fillStyle = board[y][x];
                ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
            }
        }
    }
}

function drawPiece(piece, context, offsetX = 0, offsetY = 0) {
    const shape = piece.shape;
    context.fillStyle = piece.color;
    for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
            if (shape[y][x]) {
                const drawX = (piece.x + x + offsetX) * BLOCK_SIZE;
                const drawY = (piece.y + y + offsetY) * BLOCK_SIZE;
                context.fillRect(drawX, drawY, BLOCK_SIZE, BLOCK_SIZE);
                context.strokeStyle = '#000';
                context.lineWidth = 2;
                context.strokeRect(drawX, drawY, BLOCK_SIZE, BLOCK_SIZE);
            }
        }
    }
}

function drawGrid() {
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * BLOCK_SIZE, 0);
        ctx.lineTo(x * BLOCK_SIZE, ROWS * BLOCK_SIZE);
        ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * BLOCK_SIZE);
        ctx.lineTo(COLS * BLOCK_SIZE, y * BLOCK_SIZE);
        ctx.stroke();
    }
}

function drawNextPiece() {
    nextCtx.fillStyle = '#1a1a1a';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

    if (nextPiece) {
        const shape = nextPiece.shape;
        const blockSize = 25;
        const offsetX = (nextCanvas.width - shape[0].length * blockSize) / 2;
        const offsetY = (nextCanvas.height - shape.length * blockSize) / 2;

        nextCtx.fillStyle = nextPiece.color;
        for (let y = 0; y < shape.length; y++) {
            for (let x = 0; x < shape[y].length; x++) {
                if (shape[y][x]) {
                    nextCtx.fillRect(
                        offsetX + x * blockSize,
                        offsetY + y * blockSize,
                        blockSize,
                        blockSize
                    );
                    nextCtx.strokeStyle = '#000';
                    nextCtx.lineWidth = 2;
                    nextCtx.strokeRect(
                        offsetX + x * blockSize,
                        offsetY + y * blockSize,
                        blockSize,
                        blockSize
                    );
                }
            }
        }
    }
}

// 衝突判定
function collides(piece, offsetX = 0, offsetY = 0) {
    const shape = piece.shape;
    for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
            if (shape[y][x]) {
                const newX = piece.x + x + offsetX;
                const newY = piece.y + y + offsetY;

                if (newX < 0 || newX >= COLS || newY >= ROWS) {
                    return true;
                }

                if (newY >= 0 && board[newY][newX]) {
                    return true;
                }
            }
        }
    }
    return false;
}

// 移動
function move(dir) {
    if (gameOver || isPaused) return;
    if (!collides(currentPiece, dir, 0)) {
        currentPiece.x += dir;
    }
}

function moveDown() {
    if (gameOver || isPaused) return;
    if (!collides(currentPiece, 0, 1)) {
        currentPiece.y++;
        dropCounter = 0;
    } else {
        lockPiece();
    }
}

function hardDrop() {
    if (gameOver || isPaused) return;
    while (!collides(currentPiece, 0, 1)) {
        currentPiece.y++;
        score += 2; // ハードドロップボーナス
    }
    lockPiece();
}

// 回転
function rotate() {
    if (gameOver || isPaused) return;

    const originalShape = currentPiece.shape;
    const rotated = rotateMatrix(currentPiece.shape);
    currentPiece.shape = rotated;

    // 壁蹴り処理
    let offset = 0;
    while (collides(currentPiece, offset, 0) && offset < 3) {
        offset = offset > 0 ? -offset - 1 : -offset;
    }

    if (collides(currentPiece, offset, 0)) {
        currentPiece.shape = originalShape;
    } else {
        currentPiece.x += offset;
    }
}

function rotateMatrix(matrix) {
    const N = matrix.length;
    const result = Array.from({ length: N }, () => Array(N).fill(0));
    for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
            result[x][N - 1 - y] = matrix[y][x];
        }
    }
    return result;
}

// ピースを固定
function lockPiece() {
    const shape = currentPiece.shape;
    for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
            if (shape[y][x]) {
                const boardY = currentPiece.y + y;
                const boardX = currentPiece.x + x;
                if (boardY >= 0) {
                    board[boardY][boardX] = currentPiece.color;
                }
            }
        }
    }

    // ライン消去チェック
    clearLines();

    // 次のピース
    currentPiece = nextPiece;
    nextPiece = getNextPiece();

    // ゲームオーバー判定
    if (collides(currentPiece, 0, 0)) {
        gameOver = true;
        document.getElementById('finalScore').textContent = score;
        document.getElementById('gameOver').classList.remove('hidden');
    }
}

// ライン消去
function clearLines() {
    let linesCleared = 0;

    for (let y = ROWS - 1; y >= 0; y--) {
        if (board[y].every(cell => cell !== 0)) {
            board.splice(y, 1);
            board.unshift(Array(COLS).fill(0));
            linesCleared++;
            y++; // 同じ行を再チェック
        }
    }

    if (linesCleared > 0) {
        lines += linesCleared;

        // スコア計算（1ライン: 100, 2ライン: 300, 3ライン: 500, 4ライン: 800）
        const points = [0, 100, 300, 500, 800];
        score += points[linesCleared] * level;

        // レベルアップ（10ラインごと）
        const newLevel = Math.floor(lines / 10) + 1;
        if (newLevel > level) {
            level = newLevel;
            dropInterval = Math.max(100, 1000 - (level - 1) * 100);
        }

        updateScore();
    }
}

// スコア更新
function updateScore() {
    document.getElementById('score').textContent = score;
    document.getElementById('lines').textContent = lines;
    document.getElementById('level').textContent = level;
}

// キーボード操作
function handleKeyPress(e) {
    if (gameOver) return;

    switch(e.key) {
        case 'ArrowLeft':
            e.preventDefault();
            move(-1);
            break;
        case 'ArrowRight':
            e.preventDefault();
            move(1);
            break;
        case 'ArrowDown':
            e.preventDefault();
            moveDown();
            break;
        case 'ArrowUp':
            e.preventDefault();
            rotate();
            break;
        case ' ':
            e.preventDefault();
            hardDrop();
            break;
        case 'p':
        case 'P':
            e.preventDefault();
            togglePause();
            break;
    }
}

// 一時停止
function togglePause() {
    if (gameOver) return;
    isPaused = !isPaused;
    const pauseOverlay = document.getElementById('pauseOverlay');
    if (isPaused) {
        pauseOverlay.classList.remove('hidden');
    } else {
        pauseOverlay.classList.add('hidden');
    }
}

// ページ読み込み時に初期化
window.addEventListener('load', init);
