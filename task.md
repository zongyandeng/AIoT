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
- [x] 升級後端 `backend/index.js`, 將 Express 結合 Socket.io 提供即時數據廣播

---

## 🧠 階段二：自訂 YOLO 工安辨識模型整合

- [x] 建立 Google Colab 雲端訓練一鍵筆記本檔案 (`yolo_train_colab.ipynb`)
- [x] YOLO 核心推論與測試
    - [x] 執行 `test_cpu.py` 驗證單張圖片辨識與繪製結果
    - [x] 檢查並執行 `test_video.py` 驗證影片推論相容性
- [x] 前端網頁按鈕功能測試
    - [x] 驗證「啟動即時辨識」是否能正常繪製 YOLO 邊界框（已驗證 Python Worker 就緒與 Socket.io 通訊正常）
    - [x] 驗證「截圖存檔」是否能成功儲存圖片至 D 槽（已通過實測並修正目錄自動建立邏輯）
- [x] 社群警報配置與測試
    - [x] 執行獨立測試腳本發送 Discord Webhook 警報（包含測試圖）（驗證 Discord 成功收到警報）
    - [x] 協助啟用並配置 LINE Notify, 發送 LINE 測試警報（已建立並驗證 `test_line.js` 測試引導腳本）

---

## 🚨 階段三：主動防禦與 Gemini API 智慧聯動

- [x] 在網頁端加入「一鍵生成工安報告」的按鈕，整合 Gemini 2.5 Flash API
- [x] 實作當 `no-helmet` 累計超過限額時，自動觸發 Gemini 生成限期改善警告信
