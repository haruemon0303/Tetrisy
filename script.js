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
let dropInterval = 700; // レベル1は700ms
let lastTime = 0;
let bag = [];

// 操作感の改善用
let keys = {
    left: false,
    right: false,
    down: false
};
let dasTimer = 0; // Delayed Auto Shift タイマー
let dasDelay = 150; // DAS開始まで150ms
let arrCounter = 0; // Auto Repeat Rate カウンター
let arrInterval = 50; // ARR間隔50ms
let lastRotateTime = 0;
let rotateCooldown = 150; // 回転クールダウン

// ロック遅延
let lockTimer = 0;
let lockDelay = 500; // 接地後500msで固定
let isGrounded = false;
let lockResets = 0;
let maxLockResets = 15; // 無限回避防止

// ソフトドロップ速度
let softDropInterval = 50;

// ライン消去エフェクト
let clearingLines = [];
let clearAnimationTimer = 0;
let clearAnimationDuration = 200; // 200msのアニメーション

// タッチボタンのセットアップ（DAS/ARR対応）
function setupTouchButton(btnId, direction) {
    const btn = document.getElementById(btnId);
    const key = direction === -1 ? 'left' : 'right';

    btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys[key] = true;
        move(direction); // 即座に1回移動
        dasTimer = 0;
        arrCounter = 0;
    });

    btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys[key] = false;
        dasTimer = 0;
        arrCounter = 0;
    });

    btn.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        keys[key] = false;
        dasTimer = 0;
        arrCounter = 0;
    });
}

// 初期化
function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    nextCanvas = document.getElementById('nextCanvas');
    nextCtx = nextCanvas.getContext('2d');

    // ボード初期化
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));

    // イベントリスナー
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.getElementById('restartBtn').addEventListener('click', restart);

    // モバイルコントロール - 長押し対応
    setupTouchButton('btnLeft', -1);
    setupTouchButton('btnRight', 1);

    // 回転は単発のみ
    let rotateBtn = document.getElementById('btnRotate');
    rotateBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        rotate();
    });

    // 下ボタンは長押しで連続
    let downBtn = document.getElementById('btnDown');
    let downInterval = null;
    downBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys.down = true;
    });
    downBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys.down = false;
    });
    downBtn.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        keys.down = false;
    });

    // ドロップは単発
    let dropBtn = document.getElementById('btnDrop');
    dropBtn.addEventListener('touchstart', (e) => {
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
    dropInterval = 700; // レベル1は700ms
    bag = [];

    // 操作状態リセット
    keys = { left: false, right: false, down: false };
    dasTimer = 0;
    arrCounter = 0;
    lockTimer = 0;
    isGrounded = false;
    lockResets = 0;

    // エフェクトリセット
    clearingLines = [];
    clearAnimationTimer = 0;

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
        // ライン消去アニメーション中
        if (clearingLines.length > 0) {
            clearAnimationTimer += deltaTime;
            if (clearAnimationTimer >= clearAnimationDuration) {
                // アニメーション終了、実際にラインを削除
                completeClearLines();
                clearingLines = [];
                clearAnimationTimer = 0;
            }
        } else {
            // 通常のゲームロジック
            // DAS/ARR処理（左右移動）
            if (keys.left || keys.right) {
                dasTimer += deltaTime;
                if (dasTimer >= dasDelay) {
                    arrCounter += deltaTime;
                    if (arrCounter >= arrInterval) {
                        const dir = keys.left ? -1 : 1;
                        move(dir);
                        arrCounter = 0;
                    }
                }
            }

            // 接地判定
            const wasGrounded = isGrounded;
            isGrounded = collides(currentPiece, 0, 1);

            if (isGrounded) {
                // 接地中はロックタイマーを進める
                lockTimer += deltaTime;
                if (lockTimer >= lockDelay || lockResets >= maxLockResets) {
                    lockPiece();
                    lockTimer = 0;
                    lockResets = 0;
                    isGrounded = false;
                }
            } else {
                // 接地していない場合は通常の落下
                const currentDropInterval = keys.down ? softDropInterval : dropInterval;
                dropCounter += deltaTime;
                if (dropCounter > currentDropInterval) {
                    moveDown();
                    dropCounter = 0;
                }
            }
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
                // 消去中のラインは明滅エフェクト
                if (clearingLines.includes(y)) {
                    const progress = clearAnimationTimer / clearAnimationDuration;
                    const flashCount = 3;
                    const flash = Math.sin(progress * Math.PI * flashCount) > 0;

                    if (flash) {
                        ctx.fillStyle = '#ffffff';
                    } else {
                        ctx.fillStyle = board[y][x];
                    }

                    // フェードアウト
                    ctx.globalAlpha = 1 - progress;
                    ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                    ctx.globalAlpha = 1;
                } else {
                    ctx.fillStyle = board[y][x];
                    ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                }
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
        // 接地中に移動したらロックタイマーをリセット
        if (isGrounded && lockResets < maxLockResets) {
            lockTimer = 0;
            lockResets++;
        }
    }
}

function moveDown() {
    if (gameOver || isPaused) return;
    if (!collides(currentPiece, 0, 1)) {
        currentPiece.y++;
        dropCounter = 0;
        // 下に移動できた場合、接地していない
        if (isGrounded) {
            isGrounded = false;
            lockTimer = 0;
        }
    }
    // 接地した場合はgameLoopでロック処理が行われる
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

    // 回転クールダウン（連打防止）
    const now = performance.now();
    if (now - lastRotateTime < rotateCooldown) {
        return;
    }
    lastRotateTime = now;

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
        // 接地中に回転したらロックタイマーをリセット
        if (isGrounded && lockResets < maxLockResets) {
            lockTimer = 0;
            lockResets++;
        }
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

    // ロック状態をリセット
    lockTimer = 0;
    lockResets = 0;
    isGrounded = false;

    // ライン消去チェック
    clearLines();

    // 消去するラインがなければすぐに次のピース
    if (clearingLines.length === 0) {
        spawnNextPiece();
    }
}

// ライン消去（アニメーション開始）
function clearLines() {
    clearingLines = [];

    // 揃ったラインを検出
    for (let y = ROWS - 1; y >= 0; y--) {
        if (board[y].every(cell => cell !== 0)) {
            clearingLines.push(y);
        }
    }

    // 消去するラインがあればアニメーション開始
    if (clearingLines.length > 0) {
        clearAnimationTimer = 0;
    }
}

// ライン消去完了（実際の削除とスコア計算）
function completeClearLines() {
    const linesCleared = clearingLines.length;

    // 上から下に向かって処理（インデックスのズレを防ぐ）
    clearingLines.sort((a, b) => a - b);
    for (let i = 0; i < clearingLines.length; i++) {
        const y = clearingLines[i];
        board.splice(y, 1);
        board.unshift(Array(COLS).fill(0));
        // 削除後は後続のインデックスを調整
        for (let j = i + 1; j < clearingLines.length; j++) {
            clearingLines[j]--;
        }
    }

    // スコア加算
    lines += linesCleared;

    // スコア計算（1ライン: 100, 2ライン: 300, 3ライン: 500, 4ライン: 800）
    const points = [0, 100, 300, 500, 800];
    score += points[linesCleared] * level;

    // レベルアップ（10ラインごと）
    const newLevel = Math.floor(lines / 10) + 1;
    if (newLevel > level) {
        level = newLevel;
        // レベル1: 700ms、レベルごとに85ms短縮、下限120ms
        dropInterval = Math.max(120, 700 - (level - 1) * 85);
    }

    updateScore();

    // アニメーション終了後、次のピースを生成
    spawnNextPiece();
}

// 次のピースを生成
function spawnNextPiece() {
    currentPiece = nextPiece;
    nextPiece = getNextPiece();

    // ゲームオーバー判定
    if (collides(currentPiece, 0, 0)) {
        gameOver = true;
        document.getElementById('finalScore').textContent = score;
        document.getElementById('gameOver').classList.remove('hidden');
    }
}

// スコア更新
function updateScore() {
    document.getElementById('score').textContent = score;
    document.getElementById('lines').textContent = lines;
    document.getElementById('level').textContent = level;
}

// キーボード操作 - KeyDown
function handleKeyDown(e) {
    if (gameOver) return;

    switch(e.key) {
        case 'ArrowLeft':
            e.preventDefault();
            if (!keys.left) {
                keys.left = true;
                move(-1); // 即座に1回移動
                dasTimer = 0;
                arrCounter = 0;
            }
            break;
        case 'ArrowRight':
            e.preventDefault();
            if (!keys.right) {
                keys.right = true;
                move(1); // 即座に1回移動
                dasTimer = 0;
                arrCounter = 0;
            }
            break;
        case 'ArrowDown':
            e.preventDefault();
            keys.down = true;
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

// キーボード操作 - KeyUp
function handleKeyUp(e) {
    switch(e.key) {
        case 'ArrowLeft':
            keys.left = false;
            dasTimer = 0;
            arrCounter = 0;
            break;
        case 'ArrowRight':
            keys.right = false;
            dasTimer = 0;
            arrCounter = 0;
            break;
        case 'ArrowDown':
            keys.down = false;
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
