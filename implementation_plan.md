# 🚀 AIoT 智慧安全監控系統 - 延伸擴充實作計畫書

本計畫書旨在將現有的「YOLO 偵測 - Node.js 後端 - PostgreSQL - Grafana」邊緣運算骨幹，全面升級為一個**商用級的「智慧工安主動防禦系統」**。

擴充核心包含兩大方向：
1. 💻 **打造專屬前端網頁儀表板**：使用 WebSockets 實作無延遲的即時影像標註串流與工安警報看板。
2. 🧠 **訓練自訂 YOLO 工安辨識模型**：透過遷移學習，使模型具備精準辨識「未戴安全帽」與「未穿反光背心」等違規行為的能力。

---

## 📌 使用者審查與決策點 (User Review Required)

在開始執行前，有以下幾項關鍵技術決策需要您審查並給予回饋：

> [!IMPORTANT]
> ### 1. 前端網頁技術棧選擇 (三選一)
> * **方案 A：極簡輕量級 (HTML5 + Vanilla CSS/JS + Socket.io)** (推薦)：無須繁瑣的打包工具，直接由現有的 Express 後端提供服務，開發最快，效能極佳。
> * **方案 B：現代主流級 (React.js + Vite + TailwindCSS)**：若您未來想將此專案擴展為大型網頁應用，React 能提供極佳的組件化開發體驗。
> * **方案 C：全端框架級 (Next.js + Vercel)**：適合需要極佳 SEO 或伺服器渲染 (SSR) 的正式產品。
> 
> *您的偏好為何？我們目前預設採用**方案 A** 以達到最流暢的即時影像與串流效能。*

> [!WARNING]
> ### 2. YOLO 自訂模型訓練硬體選擇
> 訓練工安模型需要標註數百至數千張圖片：
> * **方案 A：使用本地 NVIDIA GPU 訓練**：如果您的電腦有獨立顯卡，可在 WSL 中直接運行訓練（約需 2-4 小時）。
> * **方案 B：使用免費 Google Colab (T4 GPU) 訓練** (推薦)：無須擔心本地顯示卡記憶體不足，在雲端跑完後直接下載 `best.pt` 權重檔，最安全省事。

---

## ❓ 開放性問題 (Open Questions)

* **Q1：是否需要即時監視器影像畫面串流？**
  * 網頁上除了圖表，是否需要呈現 YOLO 標註後的即時畫面？如果是，我們將在 Node.js 後端建立一個 WebM / MJPEG 串流伺服器，讓網頁能看到即時變化的標註綠框。
* **Q2：是否需要即時工安警報通知？**
  * 當辨識到「未戴安全帽 (no-helmet)」時，網頁是否要彈出警報視窗、播放警報音效，甚至自動調用 Gemini API 寄送工安警告信件？

---

## 🛠️ 提案變更與架構規劃 (Proposed Changes)

### Component 1: 即時工安前端網頁儀表板 (Frontend Dashboard)

我們將在後端服務中整合一個極具科技感的暗黑玻璃擬物化 (Glassmorphic) 儀表板，具備以下面板：
1. **即時影格標註串流區**：動態展示經過 YOLO 處理後的即時標註影像。
2. **智慧工安警報看板**：當有違規行為時，即時以紅色閃爍提示，並顯示違規時間與快照。
3. **即時數據趨勢圖**：使用 Chart.js 代替 Grafana，在專屬網頁內直接展示人流與違規趨勢。

#### [NEW] `backend/public/index.html` (前端主視覺網頁)
#### [NEW] `backend/public/css/style.css` (前衛暗黑科技感樣式)
#### [NEW] `backend/public/js/app.js` (WebSockets 數據與影像串流邏輯)
#### [MODIFY] `backend/index.js` (升級 Express 伺服器，整合 Socket.io)

---

### Component 2: 自訂 YOLO 工安辨識模型訓練 (Custom YOLO Training)

我們將利用開源的工安標註資料集，訓練一個能辨識四種類別的 YOLO 模型：
* `0: helmet` (有戴安全帽)
* `1: vest` (有穿背心)
* `2: no-helmet` (未戴安全帽 🚨)
* `3: no-vest` (未穿背心 🚨)

#### 實作步驟：
1. **取得資料集**：從開源平台 Roboflow 下載 `Hard Hat and Safety Vest Detection` 的 YOLO 格式資料集（約 2000 張已標註完成的工安影像）。
2. **上傳雲端訓練 (Google Colab)**：
   * 使用預訓練權重 `yolo11n.pt` 進行遷移學習 (Transfer Learning)。
   * 執行訓練代碼：
     ```python
     from ultralytics import YOLO
     model = YOLO("yolo11n.pt")
     model.train(data="safety_data.yaml", epochs=50, imgsz=640, device=0)
     ```
3. **下載權重**：將訓練完成的 `best.pt` 下載並放入專案中，更名為 `safety_best.pt`。
4. **修改 Worker 腳本**：
   * 將 `yolo_worker.py` 的模型路徑改為 `safety_best.pt`。
   * 更新輸出的 JSON 格式，加入 `helmet_status` 與 `vest_status` 的安全狀態判定。

#### [NEW] `yolo_train_colab.ipynb` (Colab 雲端一鍵訓練筆記本)
#### [MODIFY] `yolo_worker.py` (加載自訂工安模型)

---

### Component 3: 智慧工安防禦與 Gemini API 聯動

當資料庫寫入「違規行為」後，Gemini 不僅僅是生成報告，而是實施**主動式防禦**：

1. **主動風險層級判定**：後端寫入數據時，若 `no-helmet` 累計次數超過閾值，自動將風險層級設為 `CRITICAL`。
2. **即時稽核通知**：調用 `report_generator.js`，讓 Gemini 根據該次違規生成「工安限期改善警告信」，並輸出於主控台或發送至模擬信箱。

---

## 🧪 驗證與測試計劃 (Verification Plan)

### 自動化與單元測試
* **影像串流驗證**：打開網頁 [http://localhost:3000](http://localhost:3000)，確認 WebSockets 連線成功，且畫面能以高於 15 FPS 的速率流暢播放 YOLO 標註畫面。
* **模型辨識率驗證**：使用包含「未戴安全帽者」的測試圖片餵給 `yolo_worker.py`，確認輸出的 JSON 包含 `no-helmet` 且信心度大於 75%。

### 手動驗證流程
1. 啟動後端並打開瀏覽器儀表板。
2. 將包含「未戴安全帽的人員」的圖片放入辨識區。
3. 驗證網頁是否在 0.5 秒內：
   * 彈出紅色違規警報。
   * 資料庫新增一筆違規紀錄。
   * 儀表板趨勢圖即時往上跳動。
