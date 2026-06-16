const fs = require('fs');
const path = require('path');

// 載入 .env 變數
try {
  const envPath = path.join(__dirname, '../backend/.env');
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
  console.error("無法載入 .env 檔:", e.message);
}

// 由於 sendVideoAlert 內部使用 path.join(__dirname, 'public', cleanVideoPath)
// 當在 scratch 下執行時，__dirname 會是 scratch/
// 為了解決這個問題，我們可以直接把 process.cwd() 或是修改 path 模組的行為？
// 或者是，我們在 notifier.js 裡面，把影片路徑解析做成基於專案根目錄的，或是基於 backend 目錄？
// 在 backend/notifier.js 裡面：
// const fullPath = path.join(__dirname, 'public', cleanVideoPath);
// 因為 notifier.js 是在 backend/ 目錄下，所以 __dirname 就是 backend/，
// 這樣 path.join(__dirname, 'public', cleanVideoPath) 就會是 backend/public/videos/violation_9999.webm。
// 這跟我們從哪裡 require 或是從哪裡啟動 Node.js 無關，因為在 Node.js 中 __dirname 永遠是該模組（notifier.js）所在的實體目錄！
// 所以在 scratch 下執行，__dirname 在 notifier.js 內部依然會是 backend/！
// 這是完全正確的，所以不需要做額外的 __dirname 修改。

const { sendVideoAlert } = require('../backend/notifier');

async function main() {
  const videoDir = path.join(__dirname, '../backend/public/videos');
  if (!fs.existsSync(videoDir)) {
    fs.mkdirSync(videoDir, { recursive: true });
  }
  const videoPath = '/videos/violation_9999.webm';
  const fullPath = path.join(__dirname, '../backend/public', videoPath);
  
  fs.writeFileSync(fullPath, 'dummy webm file content for testing video send');
  console.log(`[Test] 已建立測試影片檔: ${fullPath}`);

  console.log("開始傳送影片警報至 Discord...");
  await sendVideoAlert(9999, videoPath);
  console.log("傳送完畢！");
}

main().catch(err => {
  console.error("測試影片警報失敗:", err);
});
