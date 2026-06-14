# AIoT 智慧主動安全防護與 YOLO 影像辨識平台 - 專案開發 Prompt 指南

本文件為本專案的專屬開發指南（Prompt Instructions）。未來不論是何種 AI 編碼助理（如 Gemini Antigravity、Cursor、Cline 等）載入本專案，都**必須嚴格遵守**本文件中所制定的所有規範、路徑設定與開發偏好。

---

## 📌 一、 專案核心背景與 WSL 混合開發環境設定

由於當前開發工具與 AI 助理可能無法直接透過 Windows 網路共享路徑（`\\wsl.localhost`）連接或掛載 Linux 系統（Ubuntu WSL）下的資料夾，因此本專案採取**「Windows 編輯、WSL 執行」**的混合開發模式：

### 1. 關鍵路徑對照表
* **Windows 工作區路徑 (代碼編輯與版本控制)**：
  ```
  D:\MyDesktop\antigravity2.0\yolo_db
  ```
  *(所有程式碼檔案的建立、修改、儲存與 Git 提交，都必須在此 Windows 目錄下進行。)*

* **Linux WSL 實際部署與執行環境路徑**：
  ```
  \\wsl.localhost\Ubuntu\home\edison\aiot_workspace
  （在 WSL Ubuntu 終端機中對應實體路徑為：/home/edison/aiot_workspace）
  ```
  *(所有模型訓練、後端執行、資料庫與監控服務，最終都將在此 Linux 目錄中執行與運作。)*

### 2. 開發與同步基本原則 (AI 必讀 - 核心規範)
> [!IMPORTANT]
> 1. **自動化同步機制**：本專案已在 [啟動AIoT專題.bat](file:///d:/MyDesktop/antigravity2.0/yolo_db/%E5%95%9F%E5%8B%95AIoT%E5%B0%88%E9%A1%8C.bat) 中整合了 `rsync` 指令。每次執行該批次檔時，系統會自動將 Windows 工作區的新變更同步至 WSL 專案路徑下，並於 WSL Ubuntu 中啟動服務與進行邊緣運算。
> 2. **確保版本一致性 (No Version Discrepancies)**：每次修改程式碼後，**必須確認 Windows 與 WSL 兩邊的檔案內容完全一致**。AI 在交付程式碼前，應引導或確認同步腳本中的排他過濾清單（如排除 `node_modules`、`.git` 等）能精準同步代碼。
> 3. **路徑設計相容性**：AI 在編寫任何 Python 腳本、後端設定檔、環境變數或資料庫路徑時，**必須以 WSL 內的路徑 `/home/edison/aiot_workspace` 作為執行與部署的目標設計**。
> 4. **雙軌路徑思維**：若生成包含絕對路徑的代碼，請提供參數配置或說明，使該程式能無縫在 WSL 的 `/home/edison/aiot_workspace` 中執行。
> 5. **服務啟動依賴**：本專案依賴執行於 WSL 中的系統服務，包含：
>    * **PostgreSQL 資料庫**：啟動指令 `sudo service postgresql start`
>    * **Grafana 監控面板**：啟動指令 `sudo service grafana-server start`
>    * 啟動流程已整合於 Windows 批次檔 [啟動AIoT專題.bat](file:///d:/MyDesktop/antigravity2.0/yolo_db/%E5%95%9F%E5%8B%95AIoT%E5%B0%88%E9%A1%8C.bat) 中。

---

## 🛠️ 二、 系統架構與技術棧 (Technology Stack)

### 1. 後端架構 (`backend/`)
* **核心技術**：Node.js + Express
* **即時通訊**：Socket.io (用於即時向前端 Dashboard 推送 YOLO 人車安全警報與偵測事件)
* **資料庫管理**：Sequelize ORM (連接 PostgreSQL)，使用 Migration 進行資料表版本控制。
* **AI 腳本調用**：使用 `python-shell` 套件，在後端背景執行 Python AI 辨識程式（如 `yolo_worker.py`）。

### 2. AI 辨識與訓練核心 (`yolo_db/` 根目錄)
* **核心框架**：Python 3 + PyTorch + Ultralytics YOLO (YOLOv11/YOLOv8)
* **硬體優化**：針對 **GTX 1650 (4GB VRAM)** 入門顯卡進行超參數調優，防止 **CUDA Out of Memory (OOM)**。
* **主要 AI 檔案**：
  * [yolo_worker.py](file:///d:/MyDesktop/antigravity2.0/yolo_db/yolo_worker.py)：負責即時影片流辨識、人車防護警報偵測並與 Node.js 後端通訊。
  * [train_low_vram.py](file:///d:/MyDesktop/antigravity2.0/yolo_db/train_low_vram.py)：專門針對低顯存設計的 YOLO 訓練腳本。
  * [resume_train.py](file:///d:/MyDesktop/antigravity2.0/yolo_db/resume_train.py)：支援在訓練中途 crash 或中斷時，從 `last.pt` 滿血復活的斷點續訓腳本。

---

## ⚡ 三、 低顯存 (GTX 1650 4GB VRAM) 訓練優化準則

在協助修改或生成模型訓練相關的程式碼時，AI **必須嚴格遵守**以下針對低顯存硬體的超參數配置：

| 超參數名稱 | 功能說明 | 顯存影響度 | GTX 1650 (4GB VRAM) 推薦設定值 |
| :--- | :--- | :--- | :--- |
| **`batch`** | 每次送入顯卡的圖片張數 | **極高** (呈正比) | **`2` 或 `4`** *(嚴禁設為 8 或以上以防 OOM)* |
| **`imgsz`** | 輸入圖片解析度 | **極高** (呈二次方比) | **`416` 或 `320`** *(預設 640 太過吃力)* |
| **`amp`** | 自動混合精度 (FP16) 訓練 | **高** (減半顯存) | **`True`** *(必須開啟，利用 Tensor Cores 加速)* |
| **`workers`** | 數據載入執行緒數 | **中** | **`2`** *(Windows/WSL 系統設為 2 或 0 可避免記憶體洩漏)* |
| **`cache`** | 快取圖片到 RAM / VRAM | **極高** (易爆記憶體)| **`False`** *(絕對不可開啟)* |
| **`model`** | YOLO 預訓練模型級別 | **高** | 優先推薦 **`yolo11n.pt`** (Nano, 輕量首選) 或 `yolo11s.pt` |

### 🔄 斷點續訓 (Resume) 黃金法則
1. **標準續訓**：使用 `model = YOLO("runs/detect/train/weights/last.pt"); model.train(resume=True)` 時，**不可**在 `train()` 內傳入其他超參數，YOLO 會自動沿用中斷前的配置。
2. **調整續訓**：若因 OOM 中斷而需要**調整超參數**（如將 batch 從 4 改為 2），則**不要**使用 `resume=True`。應將 `last.pt` 當作一般權重載入：`model = YOLO("path/to/last.pt")`，並正常傳入調整後的超參數 `model.train(batch=2, imgsz=416)` 啟動訓練。

---

## ✍️ 四、 AI 開發與協作規範 (Global Agent Rules)

為了保持程式碼品質與開發節奏，所有 AI 助理在執行任務時，必須無條件遵守以下規則：

### 1. 語言與溝通規範
* **一律使用繁體中文（台灣）**：所有回覆、對話、檔案說明、註解，以及產出的所有文件（例如實作計畫 `implementation_plan.md`、任務清單 `task.md`、變更紀錄 `walkthrough.md`），皆**必須使用繁體中文（台灣）**撰寫。

### 2. Git 與 GitHub 自動同步
* **自動推送到 GitHub**：由於本專案已建立 Git 版本控制（遠端倉庫：`https://github.com/zongyandeng/AIoT.git`），AI 助理在進行任何代碼變更且驗證無誤後，**必須主動執行 Git 提交（commit）並將變更上傳（push）到 GitHub 的 main 分支**。
* **提交訊息規範**：Git Commit message 應簡潔明瞭，並使用繁體中文說明變更重點（例如：`feat: 修正 Windows-WSL 同步與批次檔啟動運算邏輯`）。

### 3. 檔案建立與儲存路徑
* **優先使用 D 槽儲存**：新增任何專案、程式碼檔案、文檔、備份或測試資料，皆**必須優先建立並儲存在 D 槽工作目錄**（`D:\MyDesktop\antigravity2.0\yolo_db`），避免佔用 C 槽空間。

### 4. 程式碼品質與撰寫原則
* **拒絕預留位置 (No Placeholders)**：編寫程式碼時，嚴禁使用 `// TODO`、`/* 暫時省略 */` 或 `pass` 等預留位置。所有修改與新增之代碼必須是完整、健全且立即可執行的。
* **保持既有文件完整性**：除非使用者特別要求，否則必須保留程式碼中既有的註解與 Docstrings，不隨意刪除無關之程式邏輯。

### 5. 錯誤記錄與技術學習 (Troubleshooting Log)
* **主動記錄錯誤**：每當使用者或系統在編譯、執行、資料庫連線、模型訓練或部署過程中遇到錯誤時，AI 助理**必須主動且系統化地在根目錄的 [TROUBLESHOOTING.md](file:///d:/MyDesktop/antigravity2.0/yolo_db/TROUBLESHOOTING.md) 中新增一筆記錄**。
* **規範格式**：記錄必須嚴格包含 **主要問題 (Main Problem)**、**核心概念 (Core Concepts)** 與 **解決辦法 (Solutions)** 三個部分，以便使用者日後學習與持續改進。

### 6. Windows-WSL 整合運算與版本驗證規範
* **整合運算驗證**：每次修改程式碼後，**必須確認此改動在使用 `啟動AIoT專題.bat` 開啟時，能夠自動同步至 WSL Ubuntu 中並成功進行 YOLO 邊緣運算**。AI 需檢查批次檔中的 `rsync` 排除名單是否合理，確保程式能順利在 WSL 環境中被拉起執行。
* **版本一致性與執行最新代碼檢查 (Critical)**：
  - 由於標準 Node.js 服務在檔案修改時預設不會自動重啟，本專案已在 `啟動AIoT專題.bat` 與 `package.json` 中配置了 `node --watch index.js` (或 `npm run dev`)。
  - **AI 必須在每次修改檔案後，確認並指導使用者進行以下檢查**，確保執行的為最新代碼而非記憶體中的舊代碼殘留：
    1. **冷啟動檢查**：若要重新啟動批次檔，應確保先關閉先前的終端機視窗，或在 WSL 內以 `killall node` 清理孤立的 Node 執行程序。
    2. **熱重載檢查**：若在批次檔執行期間進行檔案同步，應確保終端機顯示出 `Restarting 'index.js'` 類似的監聽重啟日誌，確認 WSL 中的 Node.js 服務已偵測到變更並自動重載。
* **版本一致性檢查**：在提交代碼前，AI 必須在對話中或自我檢查中確認：Windows 工作目錄（`D:\MyDesktop\antigravity2.0\yolo_db`）與 WSL 的實際執行目錄（`/home/edison/aiot_workspace`）之間不會存在版本差異（無遺漏、未同步或舊代碼殘留之問題）。

---

*本指南為 AI 協同開發此專案的最高準則。請在每次載入對話或開始新任務時，優先閱讀並嚴格執行。*
