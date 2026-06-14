# 🛡️ AIoT 智慧安全監控與主動防禦平台 (AIoT Active Safety Defense Platform)

本專案是一個整合 **YOLO 邊緣端即時影像辨識** 與 **大語言模型 (Google Gemini 3.5 Flash) 智慧稽核分析** 的主動式工安防禦系統。旨在透過即時影像監控，自動偵測作業人員是否依規定佩戴安全帽及反光背心，並在發生違規時第一時間透過 Discord/LINE 進行警報通報，同時藉由 AI 智慧分析歷史數據，產出工安防範建議報告。

---

## 🚀 核心功能特點

1. **📷 邊緣端即時影像監控**
   - 支援調用網頁前端 Web 相機或圖片串流。
   - 透過背景 Python YOLOv11 Worker 進行毫秒級的物體偵測，並將檢測框轉換為相對比例座標，保障網頁 Canvas 縮放時的精準渲染。
   - 支援安全合規人員（綠框）與安全違規行為（紅框，如未戴安全帽、未穿反光背心）的即時標註與分類。

2. **📊 實時數據圖表與狀態日誌**
   - 採用 **Socket.io** 實現前後端雙向即時通訊，讓偵測日誌、合規/違規人數即時跳動更新。
   - 前端採用 **Chart.js** 繪製精美的霓虹漸層折線圖，實時反應工安數據趨勢。

3. **🚨 即時社群警報 (Discord & LINE Notify)**
   - 後端內建 5 秒的去抖動/冷卻機制（防重複洗版）。
   - 偵測到违規行為後，會將违規紀錄存入 PostgreSQL 資料庫。
   - 自動調用 Webhook，將警告文字訊息及**當下违規畫面的圖片附件**即時發送至 Discord 頻道或 LINE 群組。

4. **🧠 Gemini AI 智慧工安稽核報告**
   - 提供「Gemini 智慧稽核」分頁，可一鍵呼叫 **Gemini 3.5 Flash** API。
   - 自動撈取資料庫中最新的 100 筆違規紀錄，由 AI 進行違規統計分析、評估工安風險，並產出繁體中文的精準改善與防範建議報告。

5. **📸 手動快照截圖存檔**
   - 前端提供「截圖存檔」按鈕，可將當前 Canvas 畫面（含 YOLO 標記框）轉為 Base64。
   - 後端自動解碼並以台北時間戳命名，儲存至專案目錄的 `image/Instant_screenshot/` 資料夾下。

6. **🛠️ YOLO 訓練與測試工具鏈**
   - 提供專門針對 GTX 1650 等 4GB 低顯存顯示卡優化的訓練指令碼 (`train_low_vram.py`) 與中斷續訓指令碼 (`resume_train.py`)。
   - 提供本地 CPU 測試 (`test_cpu.py`) 與影片串流測試 (`test_video.py`) 指令碼。

---

## 📐 系統架構

```mermaid
flowchart TD
    subgraph Windows Host (開發端/瀏覽器)
        Browser["🌐 網頁前端 (Web Dashboard)<br>HTML5 + Vanilla CSS + Socket.io + Chart.js"]
        BatLauncher["💻 啟動AIoT專題.bat"]
    end

    subgraph WSL2 Ubuntu VM (邊緣運算與資料庫端)
        Backend["🟢 Node.js Express 後端<br>Socket.io + Sequelize ORM"]
        YoloWorker["🐍 Python YOLO Worker<br>Ultralytics YOLO (yolo11n.pt/yolo26n.pt)"]
        PostgreSQL[("💾 PostgreSQL 資料庫<br>儲存工安違規事件")]
        Grafana["📊 Grafana 儀表板服務<br>獨立的數據分析可視化"]
    end

    subgraph External Cloud Services (雲端外部服務)
        GeminiAPI["🧠 Google Gemini AI API<br>(gemini-3.5-flash)"]
        DiscordWebhook["💬 Discord Webhook<br>(發送警報+圖片附件)"]
        LINENotify["💬 LINE Notify API<br>(發送警報+圖片附件)"]
    end

    %% 連線關係
    BatLauncher -->|1. 開啟瀏覽器| Browser
    BatLauncher -->|2. 啟動 WSL 服務| Backend
    
    Browser <-->|Socket.io 雙向即時通訊| Backend
    Browser -->|/api/snapshot 傳送截圖| Backend
    Browser -->|/api/gemini-report 請求報告| Backend

    Backend <-->|IPC (stdin/stdout JSON)| YoloWorker
    Backend <-->|Sequelize ORM| PostgreSQL
    Backend -->|呼叫 Gemini API| GeminiAPI
    Backend -->|傳送警報圖片| DiscordWebhook
    Backend -->|傳送警報圖片| LINENotify
    
    Grafana -->|讀取數據| PostgreSQL
```

---

## 🛠️ 環境準備與安裝步驟

### 1. 系統需求
- 作業系統：**Windows 10/11**
- 虛擬化環境：已安裝並啟用 **WSL2 (Ubuntu 20.04 或 22.04)**
- GPU 加速（選用）：已安裝對應的 NVIDIA CUDA Driver

### 2. WSL2 端服務安裝與配置
在 WSL Ubuntu 終端機中，執行以下指令安裝 PostgreSQL 資料庫：
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo service postgresql start
```
*(請確保建立一個名為 `yolo_db` 或是 `.env` 中設定的資料庫，並設定對應的使用者帳號與密碼。)*

### 3. Python 虛擬環境配置
在專案根目錄下建立虛擬環境並安裝 YOLO 所需依賴：
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install ultralytics opencv-python pillow python-shell torch torchvision
```

### 4. Node.js 後端安裝
移動到 `backend` 目錄並安裝 NPM 套件：
```bash
cd backend
npm install
```

---

## ⚙️ 後端環境變數配置 (`backend/.env`)

請在 `backend/` 目錄下建立 `.env` 檔案（或編輯現有檔案），填入以下欄位：

```env
# 指定辨識使用的 YOLO 模型路徑或檔名
YOLO_MODEL=yolo11n.pt

# 即時通報功能開關 (true/false)
ENABLE_DISCORD=true
ENABLE_LINE=false

# Discord Webhook 設定 (請換上您伺服器的 Webhook 網址)
DISCORD_WEBHOOK_URL=https://discordapp.com/api/webhooks/...

# LINE Notify 設定 (請換上您的 Token)
LINE_NOTIFY_TOKEN=YOUR_LINE_NOTIFY_TOKEN

# 警報冷卻時間 (單位：毫秒)，避免短時間內重複發送通知
NOTIFICATION_COOLDOWN=10000

# Gemini API Key (用於生成智慧工安報告，請至 Google AI Studio 申請)
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

---

## 🚦 如何啟動專案

1. 確保已開啟 WSL2 且上述環境皆已配置完畢。
2. 在 Windows 檔案總管中，直接 **按兩下左鍵執行** 根目錄下的 `啟動AIoT專題.bat`。
3. 批次檔將自動：
   - 在預設瀏覽器中開啟前端儀表板：`http://localhost:3001`
   - 啟動 WSL2 內的 `postgresql` 與 `grafana-server` 服務。
   - 啟動 Node.js 後端伺服器並載入 Python YOLO Worker。
4. 在網頁上點擊 **「啟動即時辨識」**，即可開啟網頁相機開始進行工安穿戴辨識！

---

## 🧠 YOLO 模型訓練與測試說明

### 1. 訓練自訂工安資料集 (`train_low_vram.py`)
針對低顯存顯示卡（如 GTX 1650 4GB），本專案提供了優化好的訓練腳本。其特別限制了 `batch=4` 與 `imgsz=416` 並關閉了 `amp` 來防止 OOM。
- **資料集設定**：詳見 [dataset.yaml](file:///d:/MyDesktop/antigravity2.0/yolo_db/dataset.yaml)。
- **啟動訓練**：
  ```bash
  source .venv/bin/activate
  python train_low_vram.py
  ```

### 2. 斷點續訓 (`resume_train.py`)
若訓練被中斷（例如手動終止或電腦休眠），可執行此指令自動載入上次儲存的 `last.pt` 繼續訓練：
```bash
python resume_train.py
```

### 3. 本地推論測試
- **CPU 單圖測試**：執行 `python test_cpu.py` 載入官方權重測試基本推論功能。
- **影像串流測試**：執行 `python test_video.py` 測試自訂訓練權重在串流畫面上的辨識效果。

---

## 🗂️ 專案檔案結構說明

- [backend/](file:///d:/MyDesktop/antigravity2.0/yolo_db/backend) - Node.js Express 後端伺服器。
  - [backend/index.js](file:///d:/MyDesktop/antigravity2.0/yolo_db/backend/index.js) - 後端核心主程式（Socket.io 通訊、YOLO 行程控制、Gemini 報告 API）。
  - [backend/notifier.js](file:///d:/MyDesktop/antigravity2.0/yolo_db/backend/notifier.js) - Discord Webhook 與 LINE Notify 警報模組。
  - [backend/public/](file:///d:/MyDesktop/antigravity2.0/yolo_db/backend/public) - 前端靜態網頁與資源。
    - [backend/public/index.html](file:///d:/MyDesktop/antigravity2.0/yolo_db/backend/public/index.html) - Glassmorphism 風格網頁結構。
    - [backend/public/js/app.js](file:///d:/MyDesktop/antigravity2.0/yolo_db/backend/public/js/app.js) - 前端控制邏輯（視訊影格擷取、Canvas 框線繪製、Socket.io 監聽、Gemini 呼叫）。
- [yolo_worker.py](file:///d:/MyDesktop/antigravity2.0/yolo_db/yolo_worker.py) - 背景 YOLO 推論行程（Python IPC 介面）。
- [dataset.yaml](file:///d:/MyDesktop/antigravity2.0/yolo_db/dataset.yaml) - YOLO 訓練用資料集路徑與類別設定。
- [train_low_vram.py](file:///d:/MyDesktop/antigravity2.0/yolo_db/train_low_vram.py) - 適合 GTX 1650 顯卡的輕量訓練指令碼。
- [resume_train.py](file:///d:/MyDesktop/antigravity2.0/yolo_db/resume_train.py) - 斷點續訓指令碼。
- [啟動AIoT專題.bat](file:///d:/MyDesktop/antigravity2.0/yolo_db/%E5%95%9F%E5%8B%95AIoT%E5%B0%88%E9%A1%8C.bat) - 一鍵啟動後端與 WSL 服務之 Windows 批次檔。
