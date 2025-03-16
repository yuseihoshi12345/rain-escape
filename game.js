// キャンバスの設定
let canvas;
let ctx;

// ウィンドウサイズに合わせてキャンバスをリサイズ
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // プレイヤーの位置を更新
    player.x = canvas.width / 2 - player.width / 2;
    player.y = canvas.height / 2 - player.height / 2;
}

// 初期化時とウィンドウリサイズ時にキャンバスをリサイズ
window.addEventListener('resize', resizeCanvas);

// 難易度設定
const DIFFICULTY_SETTINGS = {
    easy: {
        baseSpeed: 2,      // 1 -> 2
        speedRange: 1,     // 0.5 -> 1
        spawnRate: 0.04,   // 0.02 -> 0.04
        maxDifficulty: 3,  // 2 -> 3
        difficultyIncrease: 12 // 15 -> 12（より早く難しくなる）
    },
    normal: {
        baseSpeed: 3,      // 2 -> 3
        speedRange: 1.5,   // 1 -> 1.5
        spawnRate: 0.08,   // 0.05 -> 0.08
        maxDifficulty: 4,  // 3 -> 4
        difficultyIncrease: 15  // 20 -> 15
    },
    hard: {
        baseSpeed: 4,      // 3 -> 4
        speedRange: 2,     // 1.5 -> 2
        spawnRate: 0.12,   // 0.08 -> 0.12
        maxDifficulty: 5,  // 4 -> 5
        difficultyIncrease: 12  // 15 -> 12
    },
    oni: {
        baseSpeed: 5,      // 4 -> 5
        speedRange: 2.5,   // 2 -> 2.5
        spawnRate: 0.15,   // 0.1 -> 0.15
        maxDifficulty: 6,  // 5 -> 6
        difficultyIncrease: 8   // 10 -> 8
    }
};

// ゲーム状態
let score = 0;
let timeLeft = 60;
let gameOver = false;
let gameCleared = false;
let raindrops = [];
let blooddrops = [];
let greendrops = []; // 緑の雨の配列を追加
let difficulty = 1;
let currentSettings = null;
let lives = 3;
let invincible = false;
let invincibleTimer = 0;
const INVINCIBLE_DURATION = 2000;
const BLOOD_SPAWN_CHANCE = 0.0005;
const MIN_TIME_BETWEEN_BLOOD = 10000;
let lastBloodSpawnTime = 0;
let currentTimer = null;
let isGameRunning = false;
let animationFrameId = null;
let guaranteedBloodDrops = 3; // 保証される血の雨の数
let nextGuaranteedBloodTime = 0; // 次の保証された血の雨の出現時間
let totalBloodDrops = 0; // 合計の血の雨出現回数
const MAX_BLOOD_DROPS = 5; // 血の雨の最大出現回数
let isGiantMode = false; // 巨大化状態のフラグ
let giantModeTimer = 0; // 巨大化の残り時間
const GIANT_MODE_DURATION = 5000; // 巨大化の持続時間（5秒）
const GREEN_DROP_SPAWN_CHANCE = 0.0003; // 緑の雨の出現確率

// ハイスコア管理
const highScores = {
    easy: parseInt(localStorage.getItem('highScore_easy')) || 0,
    normal: parseInt(localStorage.getItem('highScore_normal')) || 0,
    hard: parseInt(localStorage.getItem('highScore_hard')) || 0,
    oni: parseInt(localStorage.getItem('highScore_oni')) || 0
};

let currentDifficulty = '';

// 蚊（プレイヤー）の設定
const player = {
    x: 0,
    y: 0,
    width: 60,
    height: 60,
    speed: 6    // デフォルトの速度
};

// 速度設定の処理
function setupSpeedControl() {
    const speedSlider = document.getElementById('speedSlider');
    const currentSpeedText = document.getElementById('currentSpeed');
    
    if (!speedSlider || !currentSpeedText) return; // 要素が存在しない場合は処理を中断
    
    // スライダーの最大値を15に設定
    speedSlider.max = "15";
    
    // 保存された速度設定を読み込む
    const savedSpeed = localStorage.getItem('playerSpeed');
    if (savedSpeed) {
        const speed = parseInt(savedSpeed);
        if (!isNaN(speed) && speed >= 3 && speed <= 15) {
            player.speed = speed;
            speedSlider.value = speed;
            updateSpeedText(speed);
        }
    }
    
    // スライダーの値が変更されたときの処理
    speedSlider.addEventListener('input', function() {
        const speed = parseInt(this.value);
        if (!isNaN(speed) && speed >= 3 && speed <= 15) {
            player.speed = speed;
            updateSpeedText(speed);
            localStorage.setItem('playerSpeed', speed.toString());
        }
    });
}

// 速度表示テキストの更新
function updateSpeedText(speed) {
    const currentSpeedText = document.getElementById('currentSpeed');
    if (!currentSpeedText) return;
    
    if (speed <= 4) {
        currentSpeedText.textContent = 'ゆっくり';
    } else if (speed <= 7) {
        currentSpeedText.textContent = '普通';
    } else if (speed <= 10) {
        currentSpeedText.textContent = '速い';
    } else {
        currentSpeedText.textContent = '超速い';
    }
}

// ライフの更新
function updateLives() {
    document.getElementById('lives').textContent = '❤'.repeat(lives);
}

// 難易度選択の処理
function setupDifficultyButtons() {
    // 既存のイベントリスナーを削除
    const buttons = ['easy', 'normal', 'hard', 'oni'];
    buttons.forEach(difficulty => {
        const button = document.getElementById(difficulty);
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        newButton.addEventListener('click', () => startGame(difficulty));
    });
}

// ハイスコア表示の更新
function updateHighScoreDisplay() {
    document.getElementById('highscore-easy').textContent = highScores.easy;
    document.getElementById('highscore-normal').textContent = highScores.normal;
    document.getElementById('highscore-hard').textContent = highScores.hard;
    document.getElementById('highscore-oni').textContent = highScores.oni;
}

// ゲーム情報の更新
function updateGameInfo() {
    const scoreElement = document.getElementById('score');
    const timeElement = document.getElementById('time');
    const highscoreElement = document.getElementById('current-highscore');
    
    if (scoreElement) scoreElement.textContent = score;
    if (timeElement) timeElement.textContent = timeLeft;
    if (highscoreElement) highscoreElement.textContent = highScores[currentDifficulty];
}

// ゲームの初期化
function initializeGame() {
    // 前回のゲームのタイマーをクリア
    if (currentTimer) {
        clearInterval(currentTimer);
        currentTimer = null;
    }
    
    // アニメーションフレームをキャンセル
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    
    isGameRunning = false;
    score = 0;
    timeLeft = 60;
    gameOver = false;
    gameCleared = false;
    raindrops = [];
    blooddrops = [];
    greendrops = []; // 緑の雨の配列をリセット
    difficulty = 1;
    lives = 3;
    invincible = false;
    lastBloodSpawnTime = 0;
    isGiantMode = false; // 巨大化状態をリセット
    player.width = 60;  // プレイヤーのサイズを元に戻す
    player.height = 60;
    
    // プレイヤーの位置を画面中央に設定
    if (canvas) {
        player.x = canvas.width / 2 - player.width / 2;
        player.y = canvas.height / 2 - player.height / 2;
    }

    // キャンバスのクリックイベントをリセット
    canvas.onclick = null;
}

// 難易度選択画面を表示
function showDifficultySelect() {
    // キャンバスとゲーム情報を非表示
    canvas.style.display = 'none';
    document.getElementById('gameInfo').style.display = 'none';
    
    // タッチエリアを非表示
    document.getElementById('touchControls').style.display = 'none';
    
    // 難易度選択画面を表示
    const difficultySelect = document.getElementById('difficultySelect');
    difficultySelect.style.display = 'block';
    
    // ハイスコア表示を更新
    updateHighScoreDisplay();
    
    // 難易度選択ボタンのイベントリスナーを再設定
    setupDifficultyButtons();
    
    // フルスクリーンを解除
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => {
            console.log('フルスクリーン解除エラー:', err);
        });
    }
}

// ハイスコアの更新
function updateHighScore() {
    if (score > highScores[currentDifficulty]) {
        highScores[currentDifficulty] = score;
        localStorage.setItem(`highScore_${currentDifficulty}`, score.toString());
        return true;
    }
    return false;
}

// キー入力の状態
const keys = {
    left: false,
    right: false,
    up: false,
    down: false
};

function handleKeyDown(e) {
    if (!isGameRunning) return; // ゲームが実行中でない場合は無視

    switch(e.key.toLowerCase()) {
        // WASDキー
        case 'a':
        case 'arrowleft':  // 矢印キー
            e.preventDefault();
            keys.left = true;
            break;
        case 'd':
        case 'arrowright':
            e.preventDefault();
            keys.right = true;
            break;
        case 'w':
        case 'arrowup':
            e.preventDefault();
            keys.up = true;
            break;
        case 's':
        case 'arrowdown':
            e.preventDefault();
            keys.down = true;
            break;
    }

    if (e.key === 'Escape') {
        togglePause();
    }
}

function handleKeyUp(e) {
    switch(e.key.toLowerCase()) {
        // WASDキー
        case 'a':
        case 'arrowleft':  // 矢印キー
            e.preventDefault();
            keys.left = false;
            break;
        case 'd':
        case 'arrowright':
            e.preventDefault();
            keys.right = false;
            break;
        case 'w':
        case 'arrowup':
            e.preventDefault();
            keys.up = false;
            break;
        case 's':
        case 'arrowdown':
            e.preventDefault();
            keys.down = false;
            break;
    }
}

// 雨粒のクラス
class Raindrop {
    constructor() {
        this.width = 4;
        this.height = 15;
        this.x = Math.random() * (canvas.width - this.width);
        this.y = -this.height;
        this.speed = (currentSettings.baseSpeed + Math.random() * currentSettings.speedRange) * difficulty;
        
        // HARDとONI難易度の場合、斜めに降る可能性がある
        if (currentDifficulty === 'hard' || currentDifficulty === 'oni') {
            // 30%の確率で斜めに降る
            if (Math.random() < 0.3) {
                // 左右どちらかにランダムに傾く
                this.horizontalSpeed = (Math.random() * 2 - 1) * this.speed * 0.5;
            } else {
                this.horizontalSpeed = 0;
            }
        } else {
            this.horizontalSpeed = 0;
        }
    }

    update() {
        this.y += this.speed;
        this.x += this.horizontalSpeed;
        
        // 画面外に出たかどうかをチェック
        return this.y > canvas.height || this.x < -this.width || this.x > canvas.width;
    }

    draw() {
        ctx.save();
        ctx.fillStyle = '#4FA4FF';
        
        // 雨粒の角度を計算
        if (this.horizontalSpeed !== 0) {
            const angle = Math.atan2(this.speed, this.horizontalSpeed);
            ctx.translate(this.x + this.width/2, this.y + this.height/2);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.ellipse(0, 0, this.width/2, this.height/2, 0, 0, Math.PI * 2);
        } else {
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, this.width/2, this.height/2, 0, 0, Math.PI * 2);
        }
        
        ctx.fill();
        ctx.restore();
    }

    collidesWith(player) {
        return this.x < player.x + player.width &&
               this.x + this.width > player.x &&
               this.y < player.y + player.height &&
               this.y + this.height > player.y;
    }
}

// 雨粒の生成
function spawnRaindrop() {
    if (Math.random() < currentSettings.spawnRate * difficulty) {
        raindrops.push(new Raindrop());
    }
}

// 血の雨のクラス
class Blooddrop {
    constructor() {
        this.width = 8;  // サイズを少し大きく
        this.height = 20; // サイズを少し大きく
        this.x = Math.random() * (canvas.width - this.width);
        this.y = -this.height;
        this.speed = 3 + Math.random() * 2;
        this.glowIntensity = Math.random() * 0.5 + 0.5; // 光の強さ
        this.pulsePhase = Math.random() * Math.PI * 2; // パルスのフェーズ
    }

    update() {
        this.y += this.speed;
        // パルスのフェーズを更新
        this.pulsePhase += 0.1;
        return this.y > canvas.height;
    }

    draw() {
        ctx.save();
        
        // パルスする光の強さを計算
        const pulse = Math.sin(this.pulsePhase) * 0.3 + 0.7;
        const glowSize = this.width * 2 * pulse;
        
        // 外側の光るエフェクト
        const gradient = ctx.createRadialGradient(
            this.x + this.width/2, this.y + this.height/2, 0,
            this.x + this.width/2, this.y + this.height/2, glowSize
        );
        gradient.addColorStop(0, `rgba(255, 0, 0, ${0.6 * this.glowIntensity * pulse})`);
        gradient.addColorStop(0.5, `rgba(255, 50, 50, ${0.3 * this.glowIntensity * pulse})`);
        gradient.addColorStop(1, 'rgba(255, 100, 100, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x + this.width/2, this.y + this.height/2, glowSize, 0, Math.PI * 2);
        ctx.fill();

        // 血の雨の中心部分
        const innerGradient = ctx.createLinearGradient(
            this.x, this.y,
            this.x + this.width, this.y + this.height
        );
        innerGradient.addColorStop(0, '#FF0000');
        innerGradient.addColorStop(0.5, '#FF3333');
        innerGradient.addColorStop(1, '#FF0000');
        
        ctx.fillStyle = innerGradient;
        ctx.beginPath();
        ctx.ellipse(
            this.x + this.width/2,
            this.y + this.height/2,
            this.width/2,
            this.height/2,
            0,
            0,
            Math.PI * 2
        );
        ctx.fill();

        // 光の反射効果
        ctx.fillStyle = `rgba(255, 255, 255, ${0.4 * pulse})`;
        ctx.beginPath();
        ctx.ellipse(
            this.x + this.width/3,
            this.y + this.height/3,
            this.width/6,
            this.height/6,
            0,
            0,
            Math.PI * 2
        );
        ctx.fill();

        ctx.restore();
    }

    collidesWith(player) {
        return this.x < player.x + player.width &&
               this.x + this.width > player.x &&
               this.y < player.y + player.height &&
               this.y + this.height > player.y;
    }
}

// 血の雨の生成
function spawnBlooddrop() {
    const currentTime = Date.now();
    
    // 最大出現回数に達している場合は生成しない
    if (totalBloodDrops >= MAX_BLOOD_DROPS) {
        return;
    }
    
    // 保証された血の雨の処理
    if (guaranteedBloodDrops > 0 && timeLeft > 0) {
        // 一定間隔で強制的に血の雨を生成
        const timePerGuaranteedDrop = (timeLeft * 1000) / (guaranteedBloodDrops + 1);
        
        if (currentTime >= nextGuaranteedBloodTime) {
            blooddrops.push(new Blooddrop());
            guaranteedBloodDrops--;
            totalBloodDrops++;
            // 次の保証された血の雨の時間を設定
            nextGuaranteedBloodTime = currentTime + timePerGuaranteedDrop;
            lastBloodSpawnTime = currentTime;
            return;
        }
    }

    // 通常の血の雨生成処理
    if (currentTime - lastBloodSpawnTime < MIN_TIME_BETWEEN_BLOOD) {
        return;
    }

    // 難易度が上がるほど出現確率は下がる（回復が難しくなる）
    if (Math.random() < BLOOD_SPAWN_CHANCE / difficulty) {
        blooddrops.push(new Blooddrop());
        totalBloodDrops++;
        lastBloodSpawnTime = currentTime;
    }
}

// 緑の雨のクラス
class Greendrop {
    constructor() {
        this.width = 6;
        this.height = 15;
        this.x = Math.random() * (canvas.width - this.width);
        this.y = -this.height;
        this.speed = 2 + Math.random() * 2;
        this.glowIntensity = Math.random() * 0.5 + 0.5;
        this.pulsePhase = Math.random() * Math.PI * 2;
    }

    update() {
        this.y += this.speed;
        this.pulsePhase += 0.1;
        return this.y > canvas.height;
    }

    draw() {
        ctx.save();
        
        // パルスする光の強さを計算
        const pulse = Math.sin(this.pulsePhase) * 0.3 + 0.7;
        const glowSize = this.width * 2 * pulse;
        
        // 外側の光るエフェクト
        const gradient = ctx.createRadialGradient(
            this.x + this.width/2, this.y + this.height/2, 0,
            this.x + this.width/2, this.y + this.height/2, glowSize
        );
        gradient.addColorStop(0, `rgba(0, 255, 0, ${0.6 * this.glowIntensity * pulse})`);
        gradient.addColorStop(0.5, `rgba(50, 255, 50, ${0.3 * this.glowIntensity * pulse})`);
        gradient.addColorStop(1, 'rgba(100, 255, 100, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x + this.width/2, this.y + this.height/2, glowSize, 0, Math.PI * 2);
        ctx.fill();

        // 緑の雨の中心部分
        const innerGradient = ctx.createLinearGradient(
            this.x, this.y,
            this.x + this.width, this.y + this.height
        );
        innerGradient.addColorStop(0, '#00FF00');
        innerGradient.addColorStop(0.5, '#33FF33');
        innerGradient.addColorStop(1, '#00FF00');
        
        ctx.fillStyle = innerGradient;
        ctx.beginPath();
        ctx.ellipse(
            this.x + this.width/2,
            this.y + this.height/2,
            this.width/2,
            this.height/2,
            0,
            0,
            Math.PI * 2
        );
        ctx.fill();

        ctx.restore();
    }

    collidesWith(player) {
        return this.x < player.x + player.width &&
               this.x + this.width > player.x &&
               this.y < player.y + player.height &&
               this.y + this.height > player.y;
    }
}

// 緑の雨の生成
function spawnGreendrop() {
    if (Math.random() < GREEN_DROP_SPAWN_CHANCE * difficulty) {
        greendrops.push(new Greendrop());
    }
}

// プレイヤー（蚊）の描画
function drawPlayer() {
    // 無敵時間中は点滅表示
    if (invincible && Math.floor(Date.now() / 100) % 2 === 0) {
        return;
    }

    ctx.save();
    
    // 移動方向に応じて蚊の向きを変える
    let angle = 0;
    if (keys.left) angle = -15;
    if (keys.right) angle = 15;
    
    // 蚊の中心点を基準に回転
    ctx.translate(player.x + player.width/2, player.y + player.height/2);
    ctx.rotate(angle * Math.PI / 180);
    
    // 巨大化モードの場合、スケールを2倍に
    if (isGiantMode) {
        ctx.scale(2, 2);
    }
    
    // 羽ばたきアニメーション用の時間
    const wingPhase = Math.sin(Date.now() * 0.02) * 0.5 + 0.5;
    
    // 羽（後ろ側）
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
    ctx.shadowBlur = 5;
    
    // 左羽
    ctx.beginPath();
    ctx.moveTo(-player.width/4, 0);
    ctx.quadraticCurveTo(
        -player.width/2,
        -player.height/3 - wingPhase * 10,
        -player.width/3,
        player.height/6
    );
    ctx.stroke();
    
    // 右羽
    ctx.beginPath();
    ctx.moveTo(player.width/4, 0);
    ctx.quadraticCurveTo(
        player.width/2,
        -player.height/3 - wingPhase * 10,
        player.width/3,
        player.height/6
    );
    ctx.stroke();

    // 胴体
    const gradient = ctx.createLinearGradient(-8, 0, 8, 0);
    gradient.addColorStop(0, 'rgba(40, 40, 40, 0.9)');
    gradient.addColorStop(0.5, 'rgba(60, 60, 60, 0.9)');
    gradient.addColorStop(1, 'rgba(40, 40, 40, 0.9)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // 針（口吻）
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, player.height/3);
    ctx.stroke();

    // 脚
    ctx.lineWidth = 1;
    
    // 前脚
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.quadraticCurveTo(-15, 10, -20, 15);
    ctx.moveTo(5, 0);
    ctx.quadraticCurveTo(15, 10, 20, 15);
    ctx.stroke();

    // 中脚
    ctx.beginPath();
    ctx.moveTo(-8, 5);
    ctx.quadraticCurveTo(-20, 15, -25, 20);
    ctx.moveTo(8, 5);
    ctx.quadraticCurveTo(20, 15, 25, 20);
    ctx.stroke();

    // 後脚
    ctx.beginPath();
    ctx.moveTo(-6, 8);
    ctx.quadraticCurveTo(-25, 20, -30, 25);
    ctx.moveTo(6, 8);
    ctx.quadraticCurveTo(25, 20, 30, 25);
    ctx.stroke();

    // 触角
    ctx.beginPath();
    ctx.moveTo(-3, -10);
    ctx.quadraticCurveTo(-8, -20, -5, -25);
    ctx.moveTo(3, -10);
    ctx.quadraticCurveTo(8, -20, 5, -25);
    ctx.stroke();

    ctx.restore();
}

// プレイヤーの移動
function movePlayer() {
    if (!isGameRunning || gameOver || gameCleared) return;
    
    const speed = player.speed;
    const nextPos = {
        x: player.x,
        y: player.y
    };
    
    // 斜め移動時の速度調整
    if ((keys.left || keys.right) && (keys.up || keys.down)) {
        const diagonalSpeed = speed * 0.707; // √2/2 ≈ 0.707
        if (keys.left) nextPos.x -= diagonalSpeed;
        if (keys.right) nextPos.x += diagonalSpeed;
        if (keys.up) nextPos.y -= diagonalSpeed;
        if (keys.down) nextPos.y += diagonalSpeed;
    } else {
        // 通常の移動
        if (keys.left) nextPos.x -= speed;
        if (keys.right) nextPos.x += speed;
        if (keys.up) nextPos.y -= speed;
        if (keys.down) nextPos.y += speed;
    }
    
    // 画面外に出ないように位置を制限
    nextPos.x = Math.max(0, Math.min(canvas.width - player.width, nextPos.x));
    nextPos.y = Math.max(0, Math.min(canvas.height - player.height, nextPos.y));
    
    // 位置を更新
    player.x = nextPos.x;
    player.y = nextPos.y;
}

// ゲームの更新
function update() {
    if (gameOver) return;

    movePlayer();
    spawnRaindrop();
    spawnBlooddrop();
    spawnGreendrop();

    // 巨大化モードの更新
    if (isGiantMode && Date.now() > giantModeTimer) {
        isGiantMode = false;
        player.width = 60;  // 元のサイズに戻す
        player.height = 60;
    }

    // 無敵時間の更新
    if (invincible && Date.now() - invincibleTimer > INVINCIBLE_DURATION) {
        invincible = false;
    }

    // 緑の雨の更新と衝突判定
    greendrops = greendrops.filter(greendrop => {
        if (greendrop.collidesWith(player)) {
            isGiantMode = true;
            giantModeTimer = Date.now() + GIANT_MODE_DURATION;
            player.width = 120;  // 2倍のサイズ（60 * 2）
            player.height = 120; // 2倍のサイズ（60 * 2）
            return false;
        }
        return !greendrop.update();
    });

    // 血の雨の更新と衝突判定
    blooddrops = blooddrops.filter(blooddrop => {
        if (blooddrop.collidesWith(player)) {
            if (lives < 3) {  // ライフが3未満の場合は回復
                lives++;
                updateLives();
            } else {  // ライフが満タンの場合はボーナススコア
                score += 100;
                updateGameInfo();
                
                // ボーナススコア獲得エフェクトの表示
                showBonusEffect(blooddrop.x, blooddrop.y);
            }
            return false;
        }
        return !blooddrop.update();
    });

    // 雨粒の更新と衝突判定
    raindrops = raindrops.filter(raindrop => {
        if (!invincible && raindrop.collidesWith(player)) {
            lives--;
            updateLives();
            
            if (lives <= 0) {
                gameOver = true;
                return false;
            } else {
                // 無敵時間の開始
                invincible = true;
                invincibleTimer = Date.now();
                return false;
            }
        }
        if (raindrop.update()) {
            score++;
            updateGameInfo();
            return false;
        }
        return true;
    });
}

// 描画
function draw() {
    // 背景を描画（青空）
    ctx.fillStyle = '#2C4F91';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    drawPlayer();
    raindrops.forEach(raindrop => raindrop.draw());
    blooddrops.forEach(blooddrop => blooddrop.draw());
    greendrops.forEach(greendrop => greendrop.draw());

    if (gameOver || gameCleared) {
        // ハイスコアの更新をチェック
        const isNewHighScore = updateHighScore();
        
        // 半透明の黒いオーバーレイ
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#FFF';
        ctx.textAlign = 'center';
        
        if (gameCleared) {
            // クリア時のメッセージ
            ctx.font = '48px Arial';
            ctx.fillText('ゲームクリア!', canvas.width/2, canvas.height/2 - 60);
            ctx.font = '24px Arial';
            ctx.fillText(`スコア: ${score}`, canvas.width/2, canvas.height/2);
            ctx.fillText(`ハイスコア: ${highScores[currentDifficulty]}`, canvas.width/2, canvas.height/2 + 40);
        } else {
            // ゲームオーバー時のメッセージ
            ctx.font = '48px Arial';
            ctx.fillText('ゲームオーバー!', canvas.width/2, canvas.height/2 - 60);
            ctx.font = '24px Arial';
            ctx.fillText(`スコア: ${score}`, canvas.width/2, canvas.height/2);
            ctx.fillText(`ハイスコア: ${highScores[currentDifficulty]}`, canvas.width/2, canvas.height/2 + 40);
        }
        
        // 新記録達成のメッセージ（ゲームオーバー時もクリア時も表示）
        if (isNewHighScore) {
            ctx.fillStyle = '#FFD700';
            ctx.fillText('新記録達成！', canvas.width/2, canvas.height/2 + 80);
        }

        // リトライボタンの描画
        const buttonY = canvas.height/2 + 120;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(canvas.width/2 - 100, buttonY - 25, 200, 50);
        ctx.fillStyle = '#FFF';
        ctx.font = '24px Arial';
        ctx.fillText('タイトルに戻る', canvas.width/2, buttonY + 8);

        // クリックイベントの追加（一度だけ）
        if (!canvas.onclick) {
            canvas.onclick = function(e) {
                if (gameOver || gameCleared) {
                    const rect = canvas.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    
                    // ボタンの領域をクリックしたかチェック
                    if (x >= canvas.width/2 - 100 && x <= canvas.width/2 + 100 &&
                        y >= buttonY - 25 && y <= buttonY + 25) {
                        canvas.onclick = null; // クリックイベントを削除
                        showDifficultySelect();
                    }
                }
            };
        }
    }
}

// ゲームループ
function gameLoop() {
    if (!isGameRunning) {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        return;
    }
    
    update();
    draw();
    
    if (!gameOver && !gameCleared) {
        animationFrameId = requestAnimationFrame(gameLoop);
    } else {
        isGameRunning = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }
}

// タイマーの開始
function startTimer() {
    if (currentTimer) {
        clearInterval(currentTimer);
    }
    
    currentTimer = setInterval(() => {
        if (gameOver || gameCleared) {
            clearInterval(currentTimer);
            currentTimer = null;
            return;
        }
        timeLeft--;
        document.getElementById('time').textContent = timeLeft;
        
        // 難易度の更新
        difficulty = Math.min(
            currentSettings.maxDifficulty,
            1 + (60 - timeLeft) / currentSettings.difficultyIncrease
        );
        
        if (timeLeft <= 0) {
            gameCleared = true;  // ゲームクリアフラグを設定
            clearInterval(currentTimer);
            currentTimer = null;
        }
    }, 1000);
}

// ボーナススコアエフェクトの表示
function showBonusEffect(x, y) {
    ctx.save();
    ctx.fillStyle = '#FFD700';  // 金色
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('+100', x, y);
    ctx.restore();
}

function startGame(difficultyLevel) {
    // 既存のゲームループをクリーンアップ
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    
    currentDifficulty = difficultyLevel;
    initializeGame();
    
    // 難易度設定を適用
    currentSettings = DIFFICULTY_SETTINGS[difficultyLevel];
    
    // 血の雨の保証回数をリセット
    guaranteedBloodDrops = 3;
    totalBloodDrops = 0;
    nextGuaranteedBloodTime = Date.now() + 5000;
    
    // 選択画面を非表示
    document.getElementById('difficultySelect').style.display = 'none';
    
    // ゲーム画面を表示
    canvas.style.display = 'block';
    const gameInfo = document.getElementById('gameInfo');
    gameInfo.style.display = 'block';

    // タッチエリアを表示（モバイルの場合のみ）
    if (window.innerWidth <= 768) {
        document.getElementById('touchControls').style.display = 'block';
    }
    
    // ハイスコア表示を追加
    if (!document.getElementById('current-highscore-container')) {
        const highscoreContainer = document.createElement('div');
        highscoreContainer.id = 'current-highscore-container';
        highscoreContainer.innerHTML = `ハイスコア: <span id="current-highscore">${highScores[currentDifficulty]}</span>`;
        gameInfo.appendChild(document.createElement('br'));
        gameInfo.appendChild(highscoreContainer);
    } else {
        document.getElementById('current-highscore').textContent = highScores[currentDifficulty];
    }
    
    // スコアとライフを更新
    updateGameInfo();
    updateLives();
    
    // キャンバスをリサイズ
    resizeCanvas();
    
    // プレイヤーの位置を再設定
    player.x = canvas.width / 2 - player.width / 2;
    player.y = canvas.height / 2 - player.height / 2;
    
    // ゲーム開始
    isGameRunning = true;
    requestAnimationFrame(gameLoop);
    startTimer();
}

// 初期化処理
function init() {
    // キャンバスの取得と設定
    canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error('Canvas element not found');
        return;
    }
    ctx = canvas.getContext('2d');
    
    // 難易度選択ボタンのイベントリスナーを設定
    setupDifficultyButtons();
    
    // キーボードイベントリスナーを設定
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // タッチ操作のイベントリスナーを設定
    setupTouchControls();
    
    // 速度設定の初期化
    setupSpeedControl();
    
    // ハイスコアを表示
    updateHighScoreDisplay();
    
    // キャンバスのリサイズを実行
    resizeCanvas();
    
    // ゲームの状態をリセット
    isGameRunning = false;
    gameOver = false;
    gameCleared = false;
    
    // プレイヤーの初期位置を設定
    player.x = canvas.width / 2 - player.width / 2;
    player.y = canvas.height / 2 - player.height / 2;
    
    // 難易度選択画面を表示
    showDifficultySelect();
}

// タッチ操作の設定
function setupTouchControls() {
    const touchArea = document.querySelector('.touch-area');
    if (!touchArea) return; // タッチエリアが存在しない場合は処理を中断
    
    let touchStartX = 0;
    let touchStartY = 0;
    let isTouching = false;

    function updatePlayerDirection(touchX, touchY) {
        const rect = touchArea.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // タッチ位置と中心との差分を計算
        const diffX = touchX - centerX;
        const diffY = touchY - centerY;
        
        // 閾値（感度調整用）
        const threshold = 20;
        
        // X方向の移動
        if (diffX > threshold) {
            keys.right = true;
            keys.left = false;
        } else if (diffX < -threshold) {
            keys.left = true;
            keys.right = false;
        } else {
            keys.left = false;
            keys.right = false;
        }
        
        // Y方向の移動
        if (diffY > threshold) {
            keys.down = true;
            keys.up = false;
        } else if (diffY < -threshold) {
            keys.up = true;
            keys.down = false;
        } else {
            keys.up = false;
            keys.down = false;
        }
    }

    function resetKeys() {
        keys.up = false;
        keys.down = false;
        keys.left = false;
        keys.right = false;
    }

    // タッチ開始時
    touchArea.addEventListener('touchstart', (e) => {
        e.preventDefault();
        isTouching = true;
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        updatePlayerDirection(touchStartX, touchStartY);
    }, { passive: false });

    // タッチ移動時
    touchArea.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!isTouching) return;
        const touch = e.touches[0];
        updatePlayerDirection(touch.clientX, touch.clientY);
    }, { passive: false });

    // タッチ終了時
    touchArea.addEventListener('touchend', (e) => {
        e.preventDefault();
        isTouching = false;
        resetKeys();
    }, { passive: false });

    // タッチがキャンセルされた時
    touchArea.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        isTouching = false;
        resetKeys();
    }, { passive: false });
}

// 初期化を実行
init(); 
