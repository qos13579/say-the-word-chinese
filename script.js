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

let currentConfig = { audioUrl: "", levels: [] };
let currentDifficulty = "easy";
let selectedVersion = 1;
let imagesList = []; 
let imagesAnimationInterval;
let levelsInterval;
let audioTrack = new Audio();

let isGameRunning = false;
let isGamePaused = false;
let currentLevelCount = 0;
let activeImgIndex = -1; 

const difficultySettings = {
    easy:  { musicSpeed: 1.0,  beatTime: 320, levelTime: 5250 },
    fast:  { musicSpeed: 1.25, beatTime: 256, levelTime: 4200 },
    speed: { musicSpeed: 1.5,  beatTime: 213, levelTime: 3500 },
    hell:  { musicSpeed: 2.0,  beatTime: 160, levelTime: 2625 }
};

async function initGameData() {
    const localSaved = localStorage.getItem("beatGame_local_cache");
    if (localSaved) {
        currentConfig = JSON.parse(localSaved);
        applyLoadedData();
    } else {
        try {
            const response = await fetch('./config.json');
            if (!response.ok) throw new Error('找不到 config.json');
            currentConfig = await response.json();
        } catch (error) {
            currentConfig = defaultGameData;
        }
        applyLoadedData();
    }
}

function applyLoadedData() {
    audioTrack.src = currentConfig.audioUrl || defaultGameData.audioUrl;
    renderFrontendSelect();
}

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
    alert("💾 config.json 下載成功，請覆蓋 GitHub 舊檔！");
    toggleAdminView();
}

function saveToLocalStorage() {
    currentConfig = getPackageDataFromUI();
    localStorage.setItem("beatGame_local_cache", JSON.stringify(currentConfig));
    applyLoadedData();
    alert("⚡ 成功寫入瀏覽器快取，可直接在前台測試！");
    toggleAdminView();
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
        level.items.forEach(item => { itemsList.appendChild(createItemRow(item.text, item.url)); });
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

const imageCtnrs = document.querySelectorAll(".images-row > div");
const levelSection = document.querySelector("#level-section");
let levelNbr;

function setRandomImagePath(img, textSpan) {
    const currentLevelData = currentConfig.levels[selectedVersion - 1];
    if(!currentLevelData || currentLevelData.items.length === 0) return;
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
    const settings = difficultySettings[currentDifficulty];
    imagesAnimationInterval = setInterval(function() {          
        if(activeImgIndex > -1 && activeImgIndex < 8 && imagesList[activeImgIndex]) {
            imagesList[activeImgIndex].div.classList.remove("active");
        }
        if(activeImgIndex < 7) {
            activeImgIndex++;
            if(imagesList[activeImgIndex]) imagesList[activeImgIndex].div.classList.add("active");
        } else {
            activeImgIndex = -1; 
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

function startGame() {
    isGameRunning = true;
    updateButtonUI();
    const settings = difficultySettings[currentDifficulty];
    audioTrack.playbackRate = settings.musicSpeed;

    if (!isGamePaused) {
        imageCtnrs.forEach(div => div.innerHTML = "");
        initImagesAnimationForLevel();
        levelSection.innerHTML = `<h2>速度等級：<span id="level-nbr">1</span> / 5</h2>`;
        levelNbr = document.querySelector("#level-nbr");
        currentLevelCount = 0;
        activeImgIndex = -1;
    }
    
    isGamePaused = false;
    setTimeout(() => { audioTrack.play().catch(e => console.log("音樂播放受阻")); }, 50);

    animate8images(currentLevelCount < 5, currentLevelCount + 1);
    levelsInterval = setInterval(function() {
        currentLevelCount++;
        animate8images(currentLevelCount < 5, currentLevelCount + 1); 
    }, settings.levelTime);
}

function pauseGame() {
    isGamePaused = true;
    audioTrack.pause();
    clearInterval(imagesAnimationInterval);
    clearInterval(levelsInterval);
    updateButtonUI();
}

function stopGame() {
    isGameRunning = false;
    isGamePaused = false;
    currentLevelCount = 0;
    activeImgIndex = -1;
    try { audioTrack.pause(); audioTrack.currentTime = 0; } catch(e){}
    imageCtnrs.forEach(div => div.innerHTML = "");
    clearInterval(imagesAnimationInterval);
    clearInterval(levelsInterval);
    levelSection.innerHTML = "準備開始...";
    updateButtonUI();
}

function updateButtonUI() {
    const startBtn = document.getElementById("start-btn");
    const pauseBtn = document.getElementById("pause-btn");
    const stopBtn = document.getElementById("stop-btn");

    if (!isGameRunning) {
        startBtn.classList.remove("hidden");
        startBtn.innerText = "開始挑戰 Start";
        pauseBtn.classList.add("hidden");
        stopBtn.classList.add("hidden");
    } else if (isGameRunning && !isGamePaused) {
        startBtn.classList.add("hidden");
        pauseBtn.classList.remove("hidden");
        pauseBtn.innerText = "暫停 Pause";
        stopBtn.classList.remove("hidden");
    } else if (isGameRunning && isGamePaused) {
        startBtn.classList.add("hidden");
        pauseBtn.classList.remove("hidden");
        pauseBtn.innerText = "繼續 Resume";
        stopBtn.classList.remove("hidden");
    }
}

document.getElementById("start-btn").onclick = startGame;
document.getElementById("pause-btn").onclick = function() { if (!isGamePaused) { pauseGame(); } else { startGame(); } };
document.getElementById("stop-btn").onclick = stopGame;
document.getElementById("game-select").onchange = function() { selectedVersion = parseInt(this.value); }
document.getElementById("difficulty-select").onchange = function() { currentDifficulty = this.value; stopGame(); }

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

document.getElementById("save-json-btn").onclick = exportConfigJson;
document.getElementById("save-local-btn").onclick = saveToLocalStorage;
document.getElementById("reset-admin-btn").onclick = () => {
    if(confirm("確定要放棄修改嗎？")) { localStorage.removeItem("beatGame_local_cache"); initGameData(); setTimeout(() => renderBackendManager(), 300); }
}

initGameData();
