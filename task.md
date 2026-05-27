# 📝 AIoT 智慧安全監控系統 - 擴充執行任務清單

此清單用於追蹤我們在執行智慧工安防禦系統延伸功能時的開發進度。

---

## 💻 階段一：即時工安前端網頁儀表板 (已完成)

- [x] 建立前端公用目錄結構 (`backend/public/css`, `backend/public/js`)
- [x] 建立網頁主視覺 UI (`backend/public/index.html`) - 採用暗黑玻璃擬物化 (Glassmorphic) 設計
- [x] 建立科技感樣式表 (`backend/public/css/style.css`)
- [x] 建立前端 Socket.io 串接邏輯與即時圖表邏輯 (`backend/public/js/app.js`)
- [x] 安裝後端 Socket.io 依賴庫
- [x] 升級後端 `backend/index.js`，將 Express 結合 Socket.io 提供即時數據廣播

---

## 🧠 階段二：自訂 YOLO 工安辨識模型整合

- [ ] `[ ]` 建立 Google Colab 雲端訓練一鍵筆記本檔案 (`yolo_train_colab.ipynb`)
- [ ] `[ ]` 升級 `yolo_worker.py`，調整為加載自訂 `safety_best.pt` 權重，並支援 4 類工安標籤
- [ ] `[ ]` 更新資料庫模型，新增安全帽與反光背心的欄位

---

## 🚨 階段三：主動防禦與 Gemini API 智慧聯動

- [ ] `[ ]` 在網頁端加入「一鍵生成工安報告」的按鈕，整合 Gemini 2.5 Flash API
- [ ] `[ ]` 實作當 `no-helmet` 累計超過限額時，自動觸發 Gemini 生成限期改善警告信
