// 預設關卡資料（當 config.json 與本地快取都讀不到時使用的備用資料）
const defaultGameData = {
    audioUrl: "./audio/say_the_word_on_beat.mp3",
    levels: [
        {
            title: "第一關：顏色繞口令",
            items: [
                { text: "紅紅", url: "./images/level_1/hong.webp" },
                { text: "橘紅", url: "./images/level_1/ju.webp" },
                { text: "綠綠", url: "./images/level_1/lv.webp" },
                { text: "黃綠", url: "./images/level_1/huang.webp" }
            ]
        },
        {
            title: "第二關：諧音單槓",
            items: [
                { text: "鋼彈", url: "./images/level_2/gundam.webp" },
                { text: "乾盪", url: "./images/level_2/gandang.webp" },
                { text: "單槓", url: "./images/level_2/dandang.webp" }
            ]
        }
    ]
};

// 運行時全域變數
let currentConfig = { audioUrl: "", levels: [] };
let currentDifficulty = "easy";
let selectedVersion = 1;
let imagesList = []; 
let imagesAnimationInterval;
let levelsInterval;
let audioTrack = new Audio();

const difficultySettings = {
    easy:  { musicSpeed: 1.0,  beatTime: 320, levelTime: 5250 },
    fast:  { musicSpeed: 1.25, beatTime: 256, levelTime: 4200 },
    speed: { musicSpeed: 1.5,  beatTime: 213, levelTime: 3500 },
    hell:  { musicSpeed: 2.0,  beatTime: 160, levelTime: 2625 }
};

// ==================== 核心功能：開機讀取邏輯 (優先讀快取，次要讀 config.json) ====================
async function initGameData() {
    // 1. 檢查瀏覽器內部快取 (選項 B 的資料)
    const localSaved = localStorage.getItem("beatGame_local_cache");
    
    if (localSaved) {
        currentConfig = JSON.parse(localSaved);
        console.log("🚀 成功從『瀏覽器快取 (LocalStorage)』載入最新的本機場景！");
        applyLoadedData();
    } else {
        // 2. 如果本機沒快取，則向 GitHub 伺服器讀取 config.json (選項 A 的資料)
        try {
            const response = await fetch('./config.json');
            if (!response.ok) throw new Error('找不到 config.json');
            currentConfig = await response.json();
            console.log("🎵 成功從『config.json 檔案』載入公開關卡資料！");
        } catch (error) {
            console.warn("實實唯讀失敗，改用預設原始碼資料。");
            currentConfig = defaultGameData;
        }
        applyLoadedData();
    }
}

function applyLoadedData() {
    audioTrack.src = currentConfig.audioUrl || defaultGameData.audioUrl;
    renderFrontendSelect();
}

// 收集目前網頁後台填寫的所有關卡與網址資料
function getPackageDataFromUI() {
    const inputAudio = document.getElementById("custom-audio-url").value.trim();
    const finalAudioUrl = inputAudio ? inputAudio : defaultGameData.audioUrl;
    
    const newLevels = [];
    const levelBlocks = document.querySelectorAll(".level-edit-block");
    
    levelBlocks.forEach(block => {
        const title = block.querySelector(".level-title-input").value.trim() || "未命名關卡";
        const itemRows = block.querySelectorAll(".item-edit-row");
        const items = [];
        
        itemRows.forEach(row => {
            const text = row.querySelector(".item-text-input").value.trim();
            const url = row.querySelector(".item-url-input").value.trim();
            if(text && url) items.push({ text: text, url: url });
        });
        
        if(items.length > 0) newLevels.push({ title: title, items: items });
    });
    
    return {
        audioUrl: finalAudioUrl,
        levels: newLevels.length > 0 ? newLevels : defaultGameData.levels
    };
}

// ==================== 功能 A：匯出下載 config.json 檔案 ====================
function exportConfigJson() {
    currentConfig = getPackageDataFromUI();
    
    // 下載實體檔案
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentConfig, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "config.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    
    alert("💾 【config.json 檔案已成功下載！】\n\n請手動將它拖曳上傳至 GitHub 覆蓋舊檔。上傳後約 1 分鐘，全世界的使用者重新整理即可同步看到新關卡囉！");
    toggleAdminView();
}

// ==================== 功能 B：直接寫入瀏覽器快取 (LocalStorage) ====================
function saveToLocalStorage() {
    currentConfig = getPackageDataFromUI();
    
    // 直接寫入本機抽屜
    localStorage.setItem("beatGame_local_cache", JSON.stringify(currentConfig));
    
    applyLoadedData();
    alert("⚡ 【成功寫入瀏覽器快取！】\n\n資料已保存在本機，不需要下載檔案、也不用重傳 GitHub，回到前台就能直接開始玩囉！");
    toggleAdminView();
}

// ==================== UI 渲染與事件 ====================
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

function renderBackendManager() {
    document.getElementById("custom-audio-url").value = currentConfig.audioUrl === defaultGameData.audioUrl ? "" : currentConfig.audioUrl;
    const manager = document.getElementById("levels-manager");
    manager.innerHTML = "";
    
    currentConfig.levels.forEach((level, lIdx) => {
        const div = document.createElement("div");
        div.className = "level-edit-block";
        div.innerHTML = `
            <div class="input-group" style="margin-bottom:15px;">
                <label>主題關卡名稱：</label>
                <input type="text" class="level-title-input" placeholder="請輸入關卡自訂名稱" value="${level.title}">
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

// 遊戲運作核心
const imageCtnrs = document.querySelectorAll(".images-row > div");
const levelSection = document.querySelector("#level-section");
let levelNbr;

function setRandomImagePath(img, textSpan) {
    const currentLevelData = currentConfig.levels[selectedVersion - 1];
    if(!currentLevelData || !currentLevelData.items || currentLevelData.items.length === 0) return;
    const pool = currentLevelData.items;
    const randomIndex = Math.floor(Math.random() * pool.length);
    const selectedItem = pool[randomIndex];
    img.src = selectedItem.url; 
    img.onerror = function() { this.src = "https://unsplash.com"; };
    img.alt = selectedItem.text;
    textSpan.innerText = selectedItem.text;
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

function animate8images(generateNewRandomList, nextLevel) {
    let activeImgIndex = -1;
    const settings = difficultySettings[currentDifficulty];
    imagesAnimationInterval = setInterval(function() {          
        if(activeImgIndex > -1 && activeImgIndex < 8 && imagesList[activeImgIndex]) {
            imagesList[activeImgIndex].div.classList.remove("active");
        }
        if(activeImgIndex < 7) {
            activeImgIndex++;
            if(imagesList[activeImgIndex]) imagesList[activeImgIndex].div.classList.add("active");
        } else {
            previousImage = imagesList[activeImgIndex];
            if(previousImage) previousImage.div.classList.remove("active");
            if(generateNewRandomList) {
                imagesList.forEach(item => {
                    const ts = item.div.querySelector(".word-card");
                    if(ts) setRandomImagePath(item.img, ts);
                });
                if(levelNbr) levelNbr.innerText = nextLevel;
            }
            if(nextLevel > 5) { stopGame(); } else { clearInterval(imagesAnimationInterval); }
        }
    }, settings.beatTime);
}

function newGame() {
    stopGame();
    initImagesAnimationForLevel();
    levelSection.innerHTML = `<h2>速度等級：<span id="level-nbr">1</span> / 5</h2>`;
    levelNbr = document.querySelector("#level-nbr");
    const settings = difficultySettings[currentDifficulty];
    audioTrack.playbackRate = settings.musicSpeed;
    setTimeout(() => { audioTrack.play().catch(e => console.log("音樂播放受阻")); }, 150);
    let currentLevel = 0;
    levelsInterval = setInterval(function() {
        currentLevel++;
        animate8images(currentLevel < 5, currentLevel+1); 
    }, settings.levelTime);
}

function stopGame() {
    try { audioTrack.pause(); audioTrack.currentTime = 0; } catch(e){}
    imageCtnrs.forEach(div => div.innerHTML = "");
    clearInterval(imagesAnimationInterval);
    clearInterval(levelsInterval);
    if(playBtn) playBtn.innerText = "開始挑戰 Start";
}

const playBtn = document.querySelector("#play-btn");
if(playBtn) {
    playBtn.onclick = function() {
        if(playBtn.innerText === "開始挑戰 Start" || playBtn.innerText === "重新挑戰 New Game") {
            playBtn.innerText = "停止挑戰 Stop";
            newGame();
        } else { stopGame(); }
    }
}

document.getElementById("game-select").onchange = function() { selectedVersion = parseInt(this.value); }
document.getElementById("difficulty-select").onchange = function() { currentDifficulty = this.value; }

const toggleBtn = document.getElementById("toggle-admin-btn");
function toggleAdminView() {
    const front = document.getElementById("game-frontend");
    const back = document.getElementById("game-backend");
    if(front.classList.contains("hidden")) {
        front.classList.remove("hidden");
        back.classList.add("hidden");
        toggleBtn.innerText = "⚙️ 進入後台設定";
        stopGame();
    } else {
        front.classList.add("hidden");
        back.classList.remove("hidden");
        toggleBtn.innerText = "🎮 返回遊戲前台";
        stopGame();
        renderBackendManager();
    }
}
toggleBtn.onclick = toggleAdminView;

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

document.getElementById("add-level-btn").onclick = () => {
    const manager = document.getElementById("levels-manager");
    const lIdx = manager.querySelectorAll(".level-edit-block").length + 1;
    const div = document.createElement("div");
    div.className = "level-edit-block";
    div.innerHTML = `
        <div class="input-group" style="margin-bottom:15px;">
            <label>主題關卡名稱：</label>
            <input type="text" class="level-title-input" placeholder="主題關卡 ${lIdx}" value="主題關卡 ${lIdx}">
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

// 📢 事件綁定：分流處理兩個儲存按鈕
document.getElementById("save-json-btn").onclick = exportConfigJson; // 選項 A
document.getElementById("save-local-btn").onclick = saveToLocalStorage; // 選項 B

document.getElementById("reset-admin-btn").onclick = () => {
    if(confirm("確定要放棄修改並清除快取、恢復至 config.json 原始檔案設定嗎？")) {
        localStorage.removeItem("beatGame_local_cache"); // 清除快取
        initGameData(); // 重新向 config.json 讀取
        setTimeout(() => renderBackendManager(), 300);
    }
}

// 開機初始化
initGameData();
