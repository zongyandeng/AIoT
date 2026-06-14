/**
 * 測試 Socket.io 即時影格與邊界框廣播通訊
 */
const { io } = require('socket-client-mock'); // 我們可以使用 node 的 socket.io-client 庫
const fs = require('fs');
const path = require('path');

// 由於 node 環境下沒有瀏覽器，我們使用真實的 socket.io-client 進行測試
const socketClient = require('socket.io-client');

async function testSocketCommunication() {
  console.log("開始測試 Socket.io 即時影格與偵測廣播...");
  const socket = socketClient('http://127.0.0.1:3001');

  socket.on('connect', () => {
    console.log("[成功] Socket.io 客戶端已連線至後端伺服器 (ID:", socket.id, ")");
    
    // 1. 模擬前端通知開始即時辨識
    socket.emit('start_stream');
    console.log("[發送] start_stream 事件已發送。");

    // 2. 準備測試影格
    const imgPath = path.join(__dirname, '../bus.jpg');
    if (!fs.existsSync(imgPath)) {
      console.error(`[錯誤] 找不到測試圖片 ${imgPath}`);
      socket.disconnect();
      return;
    }
    const imgBuffer = fs.readFileSync(imgPath);
    const base64Img = `data:image/jpeg;base64,${imgBuffer.toString('base64')}`;

    console.log("[發送] 正在發送測試影格 (client_frame) 以進行 YOLO 偵測...");
    socket.emit('client_frame', base64Img);
  });

  // 3. 監聽後端回傳的邊界框
  socket.on('frame_detections', (detections) => {
    console.log("[接收] 收到 YOLO 偵測到的邊界框廣播 (frame_detections)：");
    console.log(JSON.stringify(detections, null, 2));

    // 驗證偵測結果
    if (detections && detections.length > 0) {
      console.log(`[成功] YOLO 成功識別出 ${detections.length} 個物件！`);
      
      // 計算並確認即時指標
      let frameSafe = 0;
      let frameViolation = 0;
      detections.forEach(det => {
        const isViolation = det.className.includes('no-') || det.className === 'violation';
        if (isViolation) frameViolation++;
        else if (det.className === 'helmet' || det.className === 'vest') frameSafe++;
      });
      console.log(`[即時計數驗證] 安全合規: ${frameSafe}, 違規未配戴: ${frameViolation}`);
    } else {
      console.warn("[警告] 偵測到 0 個物件，請檢查 YOLO 模型是否載入正確。");
    }

    // 測試完畢，斷開連線
    socket.disconnect();
  });

  socket.on('disconnect', () => {
    console.log("[資訊] Socket.io 客戶端連線已關閉。");
  });

  socket.on('connect_error', (err) => {
    console.error("[失敗] Socket.io 連線錯誤:", err.message);
    socket.disconnect();
  });
}

// 延遲 1 秒執行，確保讀取無誤
setTimeout(testSocketCommunication, 1000);
