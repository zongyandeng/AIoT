/**
 * 測試 LINE Notify 警報發送
 */
const fs = require('fs');
const path = require('path');

// 載入 .env 變數
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
  console.error("無法載入 .env 檔:", e.message);
}

// 強制啟用 LINE 進行單獨測試
process.env.ENABLE_LINE = 'true';
process.env.ENABLE_DISCORD = 'false';

const { sendAlert } = require('./notifier');

async function main() {
  const token = process.env.LINE_NOTIFY_TOKEN;
  if (!token || token === 'YOUR_LINE_NOTIFY_TOKEN') {
    console.error("\n[錯誤] 偵測到 LINE_NOTIFY_TOKEN 尚未設定！");
    console.log("請按照以下步驟設定：");
    console.log("1. 登入 LINE Notify 官網 (https://notify-bot.line.me/)");
    console.log("2. 點擊右上角「個人頁面」，並點選「發行權杖」");
    console.log("3. 選擇要接收通知的聊天室（例如：透過 1對1 接收 LINE Notify 通知）並產生 Token");
    console.log("4. 開啟 D:\\MyDesktop\\antigravity2.0\\yolo_db\\backend\\.env 檔案，並將:");
    console.log("   LINE_NOTIFY_TOKEN=YOUR_LINE_NOTIFY_TOKEN");
    console.log("   替換成您剛剛產生的 Token（例如 LINE_NOTIFY_TOKEN=abc123xyz...）");
    console.log("5. 記得在 .env 中把 ENABLE_LINE 設為 true 喔！\n");
    return;
  }

  console.log("正在讀取測試圖片 (bus.jpg)...");
  const imgPath = path.join(__dirname, '../bus.jpg');
  if (!fs.existsSync(imgPath)) {
    console.error(`找不到測試圖片：${imgPath}`);
    return;
  }
  const imgBuffer = fs.readFileSync(imgPath);

  console.log(`開始向 LINE Notify 發送測試警報 (Token: ${token.substring(0, 5)}...)...`);
  await sendAlert('no-vest', 0.8876, imgBuffer);
  
  console.log("LINE Notify 測試腳本執行完畢，請確認手機 LINE 是否有收到 LINE Notify 的違規通報！");
}

main().catch(err => {
  console.error("LINE Notify 測試執行失敗:", err);
});
