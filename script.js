// 預設關卡資料（當 config.json 與本地快取都讀不到時使用的安全備份資料，預設皆打勾 true）
const defaultGameData = {
    audioUrl: "https://catbox.moe",
    levels: [
        {
            title: "第一關：顏色繞口令",
            showText: true,
            items: [
                { text: "紅紅", url: "https://catbox.moe" },
                { text: "黃黃", url: "https://catbox.moe" },
                { text: "綠綠", url: "https://catbox.moe" },
                { text: "藍藍", url: "https://catbox.moe" }
            ]
        },
        {
            title: "第二關：諧音單槓",
            showText: true,
            items: [
                { text: "鋼彈", url: "https://catbox.moe" },
                { text: "單槓", url: "https://catbox.moe" }
            ]
        }
    ]
};

// 運行時全域變數
let currentConfig = { audioUrl: "", levels: [] };
let gameMode = "custom"; // 模式切換: "custom" 或是 "random"
let currentDifficulty = "easy"; // 自訂模式下的難度
let selectedMarathonMode = "easy_fast"; // 隨機模式下的複合難度選單

let selectedVersion = 1; // 自訂模式當前關卡 (1-based)
let randomActiveLevelIdx = 0; // 隨機模式當前抽中的關卡索引 (0-based)
let previousRandomLevelIdx = -1; // 防止連續重複主題

let imagesList = []; 
let imagesAnimationInterval;
let levelsInterval;
let marathonTimeout; // 控制過關 2 秒休息的定時器
let audioTrack = new Audio();

let currentSpeedStage = 1; // 每個難度內部的 1 到 5 速度階級
let marathonStage = 1;     // 隨機挑戰階段: 1 代表前 5 關全套，2 代表後 5 關全套
let levelNbr; // 速度等級 DOM 暫存

// 四種核心基本對拍時間設定
const difficultySettings = {
    easy:  { musicSpeed: 1.0,  beatTime: 320, levelTime: 5250 },
    fast:  { musicSpeed: 1.25, beatTime: 256, levelTime: 4200 },
    speed: { musicSpeed: 1.5,  beatTime: 213, levelTime: 3500 },
    hell:  { musicSpeed: 2.0,  beatTime: 160, levelTime: 2625 }
};

// 馬拉松兩種困難度對應
const marathonDifficultyMap = {
    "easy_fast": { part1: "easy", part2: "fast" },
    "fast_speed": { part1: "fast", part2: "speed" },
    "speed_hell": { part1: "speed", part2: "hell" }
};

// ==================== 核心功能：開機讀取邏輯 ====================
async function initGameData() {
    const localSaved = localStorage.getItem("beatGame_local_cache");
    if (localSaved) {
        currentConfig = JSON.parse(localSaved);
        console.log("🚀 成功從『瀏覽器快取』載入最新本機場景！");
        applyLoadedData();
    } else {
        try {
            const response = await fetch('./config.json');
            if (!response.ok) throw new Error('找不到 config.json');
            currentConfig = await response.json();
            console.log("🎵 成功從『config.json 檔案』載入關卡資料！");
        } catch (error) {
            console.warn("讀取失敗，改用預設原始碼資料。");
            currentConfig = defaultGameData;
        }
        applyLoadedData();
    }
}

function applyLoadedData() {
    audioTrack.src = currentConfig.audioUrl || defaultGameData.audioUrl;
    renderFrontendSelect();
    pickNewRandomLevel();
}

function pickNewRandomLevel() {
    if (!currentConfig.levels || currentConfig.levels.length === 0) return;
    const totalLevels = currentConfig.levels.length;
    
    if (totalLevels <= 1) {
        randomActiveLevelIdx = 0;
    } else {
        let newPick;
        do {
            newPick = Math.floor(Math.random() * totalLevels);
        } while (newPick === previousRandomLevelIdx);
        randomActiveLevelIdx = newPick;
    }
    previousRandomLevelIdx = randomActiveLevelIdx;
    
    const titleSpan = document.getElementById("random-current-title");
    if (titleSpan) {
        titleSpan.innerText = currentConfig.levels[randomActiveLevelIdx].title;
    }
}

// ==================== 遊戲運作核心邏輯 ====================
const imageCtnrs = document.querySelectorAll(".images-row > div");
const levelSection = document.querySelector("#level-section");

function setRandomImagePath(img, textSpan) {
    const currentIdx = (gameMode === "custom") ? (selectedVersion - 1) : randomActiveLevelIdx;
    const currentLevelData = currentConfig.levels[currentIdx];
    if(!currentLevelData || !currentLevelData.items || currentLevelData.items.length === 0) return;
    
    const pool = currentLevelData.items;
    const randomIndex = Math.floor(Math.random() * pool.length);
    const selectedItem = pool[randomIndex];
    
    img.src = selectedItem.url; 
    img.onerror = function() { this.src = "./images/speaker.webp"; };
    img.alt = selectedItem.text;
    textSpan.innerText = selectedItem.text;
    
    // 📢 【核心更新】根據後台該關卡的打勾狀態（showText），決定前台是否出現字卡
    // 如果 showText 欄位不存在，我們預設為 true（要顯示）
    const showText = (currentLevelData.showText !== undefined) ? currentLevelData.showText : true;
    if (showText) {
        textSpan.classList.remove("hidden"); // 顯示字卡
    } else {
        textSpan.classList.add("hidden");    // 隱藏字卡
    }
}

function initImagesAnimationForLevel() {
    imagesList = [];
    imageCtnrs.forEach((div) => {
        div.innerHTML = ""; 
        const img = document.createElement("img");
        const textSpan = document.createElement("span");
        textSpan.className = "word-card"; 
        setRandomImagePath(img, textSpan);
        div.appendChild(img);
        div.appendChild(textSpan); 
        imagesList.push({ img: img, div: div });
    });
}

function getCurrentSettings() {
    if (gameMode === "custom") {
        return difficultySettings[currentDifficulty];
    } else {
        const marathonMap = marathonDifficultyMap[selectedMarathonMode];
        const activeDifficultyKey = (marathonStage === 1) ? marathonMap.part1 : marathonMap.part2;
        return difficultySettings[activeDifficultyKey];
    }
}

function animate8images(generateNewRandomList, nextLevel) {
    let activeImgIndex = -1;
    const settings = getCurrentSettings();
    
    imagesAnimationInterval = setInterval(function() {          
        if(activeImgIndex > -1 && activeImgIndex < 8 && imagesList[activeImgIndex]) {
            imagesList[activeImgIndex].div.classList.remove("active");
        }
        if(activeImgIndex < 7) {
            activeImgIndex++;
            if(imagesList[activeImgIndex]) imagesList[activeImgIndex].div.classList.add("active");
        } else {
            const previousImage = imagesList[activeImgIndex];
            if(previousImage) previousImage.div.classList.remove("active");
            
            if(generateNewRandomList) {
                imagesList.forEach(item => {
                    const ts = item.div.querySelector(".word-card");
                    if(ts) setRandomImagePath(item.img, ts);
                });
                if(levelNbr) levelNbr.innerText = nextLevel;
            }
            
            if(nextLevel > 5) { 
                handleStageFinished(); 
            } else { 
                clearInterval(imagesAnimationInterval); 
            }
        }
    }, settings.beatTime);
}

function newGame() {
    stopGame(true);
    initImagesAnimationForLevel();
    
    let displayTitle = (gameMode === "custom") ? "" : `【階段 ${marathonStage}】`;
    levelSection.innerHTML = `<h2>${displayTitle}速度等級：<span id="level-nbr">1</span> / 5</h2>`;
    levelNbr = document.querySelector("#level-nbr");
    
    const settings = getCurrentSettings();
    audioTrack.playbackRate = settings.musicSpeed;
    
    setTimeout(() => { audioTrack.play().catch(e => console.log("音樂播放受阻")); }, 150);
    
    let currentLevel = 0;
    levelsInterval = setInterval(function() {
        currentLevel++;
        animate8images(currentLevel < 5, currentLevel + 1); 
    }, settings.levelTime);
}

function handleStageFinished() {
    stopGame(true); 
    
    if (gameMode === "custom") {
        levelSection.innerHTML = `<h2 style="color:#00f2fe;">🎉 恭喜通關完美大成功！ 🎉</h2>`;
        if(playBtn) playBtn.innerText = "重新挑戰 New Game";
    } else {
        if (marathonStage === 1) {
            marathonStage = 2; 
            levelSection.innerHTML = `<h2 style="color:#10b981;">🎉 成功挑戰前段！休息 2s 準備迎戰進階模式...</h2>`;
            
            marathonTimeout = setTimeout(() => {
                pickNewRandomLevel(); 
                newGame(); 
            }, 2000);
        } else {
            levelSection.innerHTML = `<h2 style="color:#00f2fe;">👑 恭喜征服雙階難度馬拉松！大獲全勝！ 👑</h2>`;
            marathonStage = 1; 
            if(playBtn) playBtn.innerText = "重新挑戰 New Game";
        }
    }
}

function stopGame(isInternalTransition = false) {
    try { audioTrack.pause(); audioTrack.currentTime = 0; } catch(e){}
    clearInterval(imagesAnimationInterval);
    clearInterval(levelsInterval);
    clearTimeout(marathonTimeout);
    
    if (!isInternalTransition) {
        levelSection.innerHTML = "準備開始...";
        imageCtnrs.forEach(div => {
            div.classList.remove("active");
            const idNbr = parseInt(div.id.replace("grid-", "")) + 1;
            div.innerHTML = `<span>${idNbr}</span>`;
        });
        
        if (gameMode === "random") {
            if (marathonStage === 2) {
                if(playBtn) playBtn.innerText = "繼續挑戰 Stage 2";
            } else {
                if(playBtn) playBtn.innerText = "繼續挑戰 Stage 1";
            }
        } else {
            if(playBtn) playBtn.innerText = "開始挑戰 Start";
        }
    }
}

// ==================== 後台資料與 UI 互動事件 ====================
// 📢 【核心更新】收集後台 UI 的打勾狀態並打包
function getPackageDataFromUI() {
    const inputAudio = document.getElementById("custom-audio-url").value.trim();
    const finalAudioUrl = inputAudio ? inputAudio : defaultGameData.audioUrl;
    const newLevels = [];
    const levelBlocks = document.querySelectorAll(".level-edit-block");
    
    levelBlocks.forEach(block => {
        const title = block.querySelector(".level-title-input").value.trim() || "未命名關卡";
        // 抓取打勾狀態
        const showText = block.querySelector(".level-text-toggle").checked;
        
        const itemRows = block.querySelectorAll(".item-edit-row");
        const items = [];
        itemRows.forEach(row => {
            const text = row.querySelector(".item-text-input").value.trim();
            const url = row.querySelector(".item-url-input").value.trim();
            if(text && url) items.push({ text: text, url: url });
        });
        if(items.length > 0) newLevels.push({ title: title, showText: showText, items: items });
    });
    return { audioUrl: finalAudioUrl, levels: newLevels.length > 0 ? newLevels : defaultGameData.levels };
}

function exportConfigJson() {
    currentConfig = getPackageDataFromUI();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentConfig, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "config.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function saveToLocalStorage() {
    currentConfig = getPackageDataFromUI();
    localStorage.setItem("beatGame_local_cache", JSON.stringify(currentConfig));
    applyLoadedData();
    alert("⚡ 【成功寫入瀏覽器快取！】");
}

function renderFrontendSelect() {
    const gameSelect = document.getElementById("game-select");
    if(!gameSelect) return;
    gameSelect.innerHTML = "";
    currentConfig.levels.forEach((level, index) => {
        const opt = document.createElement("option");
        opt.value = index + 1;
        opt.innerText = level.title;
        if(selectedVersion === index + 1) opt.selected = true;
        gameSelect.appendChild(opt);
    });
    if(currentConfig.levels.length === 0) selectedVersion = 1;
}

// 📢 【核心更新】動態生成後台管理介面時，為每個關卡塞入「對拍中文字幕開關」
function renderBackendManager() {
    document.getElementById("custom-audio-url").value = currentConfig.audioUrl === defaultGameData.audioUrl ? "" : currentConfig.audioUrl;
    const manager = document.getElementById("levels-manager");
    manager.innerHTML = "";
    currentConfig.levels.forEach((level) => {
        // 判斷原資料是否有打勾設定，預設為 true (要勾選)
        const isChecked = (level.showText !== undefined) ? level.showText : true;
        
        const div = document.createElement("div");
        div.className = "level-edit-block";
        div.innerHTML = `
            <div class="input-group" style="margin-bottom:10px;">
                <label>主題關卡名稱：</label>
                <input type="text" class="level-title-input" value="${level.title}">
            </div>
            <!-- 新增打勾功能選項 -->
            <div style="margin-bottom:15px; display:flex; align-items:center; gap:8px;">
                <input type="checkbox" class="level-text-toggle" style="width:18px; height:18px; cursor:pointer;" ${isChecked ? 'checked' : ''}>
                <label style="color:#fffe03; font-weight:bold; font-size:1rem; cursor:pointer;" onclick="this.previousElementSibling.click()">顯示對拍中文字卡（不勾選則挑戰時隱藏中文字幕）</label>
            </div>
            <div class="items-list"></div>
        `;
        const itemsList = div.querySelector(".items-list");
        level.items.forEach(item => {
            itemsList.appendChild(createItemRow(item.text, item.url));
        });
        const addImgBtn = document.createElement("button");
        addImgBtn.className = "sub-btn";
        addImgBtn.innerText = "➕ 增加照片格子";
        addImgBtn.onclick = () => itemsList.appendChild(createItemRow("", ""));
        div.appendChild(addImgBtn);
        manager.appendChild(div);
    });
}

function createItemRow(text, url) {
    const row = document.createElement("div");
    row.className = "item-edit-row";
    row.innerHTML = `
        <input type="text" class="item-text-input" placeholder="對拍中文字" value="${text}">
        <input type="text" class="item-url-input" placeholder="Catbox 照片網址" value="${url}">
        <button class="del-btn" onclick="this.parentElement.remove()">❌</button>
    `;
    return row;
}

// ==================== 模式切換與密碼控制監聽 ====================
const playBtn = document.querySelector("#play-btn");

if(playBtn) {
    playBtn.onclick = function() {
        if(playBtn.innerText === "開始挑戰 Start" || playBtn.innerText === "重新挑戰 New Game" || playBtn.innerText.startsWith("繼續挑戰")) {
            playBtn.innerText = "停止挑戰 Stop";
            newGame();
        } else { 
            stopGame(); 
        }
    }
}

document.getElementById("game-select").onchange = function() { selectedVersion = parseInt(this.value); }
document.getElementById("difficulty-select").onchange = function() { currentDifficulty = this.value; }

document.getElementById("marathon-select").onchange = function() { 
    selectedMarathonMode = this.value; 
    marathonStage = 1;
    if(playBtn) playBtn.innerText = "開始挑戰 Start"; 
}

const toggleBtn = document.getElementById("toggle-admin-btn");
const modeCustomBtn = document.getElementById("mode-custom-btn");
const modeRandomBtn = document.getElementById("mode-random-btn");

function switchFrontendMode(mode) {
    gameMode = mode;
    marathonStage = 1; 
    stopGame();
    document.getElementById("game-frontend").classList.remove("hidden");
    document.getElementById("game-backend").classList.add("hidden");
    toggleBtn.innerText = "⚙️ 進入後台設定";
    
    if (mode === "custom") {
        modeCustomBtn.classList.add("active");
        modeRandomBtn.classList.remove("active");
        document.getElementById("game-select-section").classList.remove("hidden");
        document.getElementById("random-info-section").classList.add("hidden");
    } else {
        modeCustomBtn.classList.remove("active");
        modeRandomBtn.classList.add("active");
        document.getElementById("game-select-section").classList.add("hidden");
        document.getElementById("random-info-section").classList.remove("hidden");
        pickNewRandomLevel();
    }
}

modeCustomBtn.onclick = () => switchFrontendMode("custom");
modeRandomBtn.onclick = () => switchFrontendMode("random");

toggleBtn.onclick = function() {
    const front = document.getElementById("game-frontend");
    const back = document.getElementById("game-backend");
    
    if(front.classList.contains("hidden")) {
        switchFrontendMode(gameMode);
    } else {
        const adminPassword = prompt("🔐 請輸入管理員密碼以進入後台設定：");
        if (adminPassword === "8888") {
            front.classList.add("hidden");
            back.classList.remove("hidden");
            toggleBtn.innerText = "🎮 返回遊戲前台";
            stopGame();
            renderBackendManager();
        } else if (adminPassword === null) {
            console.log("取消輸入密碼");
        } else {
            alert("❌ 密碼錯誤！無法進入遊戲後台設定。");
        }
    }
};

document.getElementById("tab-audio").onclick = function() {
    this.classList.add("active");
    document.getElementById("tab-images").classList.remove("active");
    document.getElementById("sheet-content-audio").classList.remove("hidden");
    document.getElementById("sheet-content-images").classList.add("hidden");
}
document.getElementById("tab-images").onclick = function() {
    this.classList.add("active");
    document.getElementById("tab-audio").classList.remove("active");
    document.getElementById("sheet-content-images").classList.remove("hidden");
    document.getElementById("sheet-content-audio").classList.add("hidden");
}

// 📢 【核心更新】新增全新主題關卡時，預設給予一組乾淨的預設 HTML 與勾選狀態
document.getElementById("add-level-btn").onclick = () => {
    const manager = document.getElementById("levels-manager");
    const lIdx = manager.querySelectorAll(".level-edit-block").length + 1;
    const div = document.createElement("div");
    div.className = "level-edit-block";
    div.innerHTML = `
        <div class="input-group" style="margin-bottom:10px;">
            <label>主題關卡名稱：</label>
            <input type="text" class="level-title-input" value="主題關卡 ${lIdx}">
        </div>
        <div style="margin-bottom:15px; display:flex; align-items:center; gap:8px;">
            <input type="checkbox" class="level-text-toggle" style="width:18px; height:18px; cursor:pointer;" checked>
            <label style="color:#fffe03; font-weight:bold; font-size:1rem; cursor:pointer;" onclick="this.previousElementSibling.click()">顯示對拍中文字卡（不勾選則挑戰時隱藏中文字幕）</label>
        </div>
        <div class="items-list"></div>
    `;
    const itemsList = div.querySelector(".items-list");
    itemsList.appendChild(createItemRow("", ""));
    const addImgBtn = document.createElement("button");
    addImgBtn.className = "sub-btn";
    addImgBtn.innerText = "➕ 增加照片格子";
    addImgBtn.onclick = () => itemsList.appendChild(createItemRow("", ""));
    div.appendChild(addImgBtn);
    manager.appendChild(div);
}

document.getElementById("save-json-btn").onclick = exportConfigJson;
document.getElementById("save-local-btn").onclick = saveToLocalStorage;

document.getElementById("reset-admin-btn").onclick = () => {
    if(confirm("確定要放棄修改並清除快取嗎？")) {
        localStorage.removeItem("beatGame_local_cache");
        initGameData();
        setTimeout(() => renderBackendManager(), 300);
    }
}

initGameData();
