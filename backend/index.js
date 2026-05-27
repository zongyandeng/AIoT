// ==========================================================================
// 💡 原生 .env 環境變數解析器 (避免外部 dotenv 依賴)
// ==========================================================================
const fs = require('fs');
const path = require('path');
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        if (key && !key.startsWith('#')) {
          process.env[key] = value;
        }
      }
    });
    console.log("[System] .env 設定檔載入成功");
  }
} catch (e) {
  console.warn("[System] 無法載入 .env 檔，將使用系統環境變數:", e.message);
}

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { PythonShell } = require('python-shell');
const { Detection } = require('./models');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { sendAlert } = require('./notifier');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3001;

// 1. 解析大容量 JSON 請求 (供 Base64 截圖傳輸使用)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 2. 靜態檔案伺服器
app.use(express.static(path.join(__dirname, 'public')));

// 3. 靜態示範圖對應
app.get('/bus.jpg', (req, res) => {
  res.sendFile(path.join(__dirname, '../bus.jpg'));
});

// 4. 截圖存檔 API (將前端 Canvas 的截圖存入 snapshots/ 資料夾)
app.post('/api/snapshot', (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, error: '缺少影像資料' });
    }
    
    const base64Str = image.split(',')[1];
    const buffer = Buffer.from(base64Str, 'base64');
    
    // 以台北時間戳命名
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '_');
    const filename = `snapshot_${timestamp}.jpg`;
    
    const savePath = path.join(__dirname, '../image/Instant_screenshot', filename);
    fs.writeFileSync(savePath, buffer);
    
    console.log(`[Snapshot] 截圖已儲存成功: ${filename}`);
    res.json({ success: true, filename: filename });
  } catch (error) {
    console.error('[Snapshot 失敗]', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 暫存當前前端發送過來的影格圖片，當偵測到違規時能作為附件傳送
let currentFrameBase64 = null;
let isStreamingActive = false;

// 5. Socket.io 通訊中心
io.on('connection', async (socket) => {
  console.log(`🔌 瀏覽器前端已連線，Socket ID: ${socket.id}`);

  try {
    // 自動回傳資料庫最新 50 筆違規紀錄作為圖表/日誌初始渲染
    const history = await Detection.findAll({
      limit: 50,
      order: [['createdAt', 'DESC']]
    });
    socket.emit('initial_data', history);
  } catch (error) {
    console.error("❌ 無法載入資料庫初始數據:", error.message);
  }

  // 接收前端發送的實時視訊影格 (方案 A)
  socket.on('client_frame', (base64Img) => {
    currentFrameBase64 = base64Img;
    isStreamingActive = true;
    
    // 封裝成 JSON 寫入 Python 的標準輸入 (stdin)
    if (shell && shell.childProcess && !shell.childProcess.killed) {
      const command = {
        action: "detect",
        image: base64Img
      };
      shell.send(JSON.stringify(command));
    }
  });

  // 前端通知開始即時辨識
  socket.on('start_stream', () => {
    isStreamingActive = true;
    console.log("🎥 前端啟動即時辨識鏡頭");
  });

  // 前端通知暫停即時辨識
  socket.on('stop_stream', () => {
    isStreamingActive = false;
    currentFrameBase64 = null;
    console.log("⏸️ 前端暫停即時辨識鏡頭");
  });

  socket.on('disconnect', () => {
    console.log(`❌ 前端已中斷連線，Socket ID: ${socket.id}`);
  });
});

// 6. Gemini 智慧分析報告 API
app.get('/api/gemini-report', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ success: false, error: "找不到 GEMINI_API_KEY 變數，請在 .env 中填寫！" });
    }

    const logs = await Detection.findAll({
      limit: 100,
      order: [['createdAt', 'DESC']]
    });

    if (logs.length === 0) {
      return res.json({ success: true, report: "### 📭 目前尚無違規事件紀錄\n資料庫中無 YOLO 偵測紀錄，無法生成智慧報告。" });
    }

    const formattedLogs = logs.map(log => ({
      className: log.className,
      confidence: log.confidence,
      detectedAt: log.createdAt
    }));

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

    const prompt = `
      您是一位專業的工安防護專家。請根據以下最新的 JSON 格式違規偵測數據，生成一份繁體中文（台灣偏好）的 AIoT 智慧工安防護檢討與建議報告。
      
      請確保報告結構包含：
      1. 📊 違規統計分析：分析違規項目的分佈、高發時間點。
      2. 🚨 高危險警告：分析特定高危違規（如未配戴安全帽、未穿反光背心等）對工安環境的危害。
      3. 💡 精準改善建議：提出至少 3 點可行的智慧化工安管理建議。
      
      違規事件數據：
      ${JSON.stringify(formattedLogs, null, 2)}
    `;

    const result = await model.generateContent(prompt);
    res.json({ success: true, report: result.response.text() });

  } catch (error) {
    console.error("❌ Gemini 報告生成失敗:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================================================
// 🧠 PYTHON YOLO WORKER 行程控制與 IPC 通訊
// ==========================================================================
const yoloModelSetting = process.env.YOLO_MODEL || 'yolo11n.pt';

// 判斷模型是绝对路徑還是根目錄的相對路徑
const modelPath = path.isAbsolute(yoloModelSetting) 
  ? yoloModelSetting 
  : path.join(__dirname, '../', yoloModelSetting);

let options = {
  mode: 'text',
  pythonPath: path.join(__dirname, '../.venv/bin/python3'),
  pythonOptions: ['-u'],
  args: ['--model', modelPath] // 將 .env 的模型路徑作為參數帶入 Python
};

console.log(`🧠 正在啟動 Python YOLO Worker (載入模型: ${yoloModelSetting})...`);
let shell = new PythonShell('../yolo_worker.py', options);

// 防抖/冷卻變數：限制同一個違規行為寫入資料庫的間隔 (5 秒)，防止過於頻繁
const dbCooldowns = new Map();
const DB_COOLDOWN_TIME = 5000;

// 處理 YOLO 偵測到的安全違規事件 (存入資料庫與觸發通報)
async function handleViolation(det) {
  const className = det.className;
  
  // 只處理帶有 'no-' 的違規或是 violation 類別
  const isViolation = className.includes('no-') || className === 'violation';
  if (!isViolation) return;

  const now = Date.now();
  if (dbCooldowns.has(className)) {
    const lastTime = dbCooldowns.get(className);
    if (now - lastTime < DB_COOLDOWN_TIME) {
      return; // 還在冷卻時間內，跳過重複處理
    }
  }

  // 更新冷卻時間
  dbCooldowns.set(className, now);

  try {
    // 1. 寫入資料庫以供後續 Gemini 分析
    const savedData = await Detection.create({
      className: det.className,
      confidence: parseFloat(det.confidence)
    });
    console.log(`💾 [Database] 成功寫入違規紀錄: ${savedData.className} (ID: ${savedData.id})`);

    // 2. 廣播給所有前端，在控制台日誌列出這筆紀錄
    io.emit('new_detection', savedData);

    // 3. 即時社群警報通報 (Discord/LINE)
    let imgBuffer = null;
    if (currentFrameBase64) {
      const base64Str = currentFrameBase64.split(",")[1];
      imgBuffer = Buffer.from(base64Str, 'base64');
    }
    
    // 發送警報並夾帶當前影格截圖
    sendAlert(det.className, det.confidence, imgBuffer);

  } catch (error) {
    console.error("❌ 違規事件處理失敗:", error.message);
  }
}

// 監聽 Python 回傳的標準輸出
shell.on('message', async function (message) {
  try {
    const data = JSON.parse(message);
    
    if (data.status === 'ready') {
      console.log(`✅ [Python READY] YOLO Worker 成功就緒 (模型: ${data.model})`);
      return;
    }
    
    if (data.status === 'success' && data.action === 'detect') {
      // 1. 將該影格所有邊界框廣播給前端繪製到 Canvas
      io.emit('frame_detections', data.detections);
      
      // 2. 異步檢查並處理每個邊界框是否包含違規行為
      for (const det of data.detections) {
        handleViolation(det);
      }
    } else if (data.status === 'error') {
      console.error(`❌ [Python 核心錯誤] ${data.message}`);
    }
  } catch (err) {
    // 若 Python 傳回的不是標準 JSON (例如 python 內部的 print 排錯日誌)
    console.log(`🐍 [Python 日誌] ${message}`);
  }
});

shell.on('stderr', function (stderr) {
  console.log(`🐍 [Python Stderr/Warn] ${stderr}`);
});

// 啟動伺服器
server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀  AIoT 智慧工安防護監控系統後端啟動完成！`);
  console.log(`🔌 伺服器網址：http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});
