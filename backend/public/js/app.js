// ==========================================================================
// 🔌 CLIENT SIDE APPLICATION: SOCKET.IO + CHART.JS + GEMINI API + WEBCAM YOLO
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // ⏱️ 實時時鐘更新
    setInterval(() => {
        const now = new Date();
        document.getElementById('time-display').textContent = now.toLocaleTimeString('zh-TW');
    }, 1000);

    // 🔌 Socket.io 連接
    const socket = io();
    
    // UI 元件宣告
    const statusText = document.querySelector('.status-text');
    const pulseDot = document.querySelector('.pulse-dot');
    const safeCountEl = document.getElementById('safe-count');
    const violationCountEl = document.getElementById('violation-count');
    const logsWrapper = document.getElementById('logs-wrapper');
    const alertToast = document.getElementById('alert-toast');
    const toastDesc = document.querySelector('.toast-desc');

    // 📷 Webcam & Canvas 控制元件
    const toggleStreamBtn = document.getElementById('toggle-stream-btn');
    const saveSnapshotBtn = document.getElementById('save-snapshot-btn');
    const webcamVideo = document.getElementById('webcam-video');
    const liveStreamImg = document.getElementById('live-stream-img');
    const detectionCanvas = document.getElementById('detection-canvas');
    const canvasCtx = detectionCanvas.getContext('2d');

    let safeCount = 0;
    let violationCount = 0;

    // 狀態變數
    let isStreaming = false;
    let streamObject = null;
    let sendFrameInterval = null;
    let animationFrameId = null;
    let currentDetections = [];
    
    // Socket 連線狀態監聽
    socket.on('connect', () => {
        statusText.textContent = "系統已連線";
        pulseDot.classList.remove('danger');
    });

    socket.on('disconnect', () => {
        statusText.textContent = "連線中斷";
        pulseDot.classList.add('danger');
    });

    // ==========================================================================
    // 📊 CHART.JS 初始化
    // ==========================================================================
    const ctx = document.getElementById('realtimeChart').getContext('2d');
    
    // 霓虹漸層色彩主題
    const chartGradientSafe = ctx.createLinearGradient(0, 0, 0, 300);
    chartGradientSafe.addColorStop(0, 'rgba(46, 213, 115, 0.4)');
    chartGradientSafe.addColorStop(1, 'rgba(46, 213, 115, 0.0)');

    const chartGradientDanger = ctx.createLinearGradient(0, 0, 0, 300);
    chartGradientDanger.addColorStop(0, 'rgba(255, 71, 87, 0.4)');
    chartGradientDanger.addColorStop(1, 'rgba(255, 71, 87, 0.0)');

    const realtimeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [], // 時間標籤
            datasets: [
                {
                    label: '安全配戴',
                    data: [],
                    borderColor: '#2ed573',
                    backgroundColor: chartGradientSafe,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: '#2ed573'
                },
                {
                    label: '安全違規',
                    data: [],
                    borderColor: '#ff4757',
                    backgroundColor: chartGradientDanger,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: '#ff4757'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#707880',
                        font: { family: 'Outfit', size: 12 }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: { color: '#707880', font: { family: 'Fira Code', size: 10 } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: { color: '#707880', font: { family: 'Outfit', size: 12 }, stepSize: 1 },
                    beginAtZero: true
                }
            }
        }
    });

    // 限制圖表點數在 15 點以內
    function updateChart(time, safe, violation) {
        realtimeChart.data.labels.push(time);
        realtimeChart.data.datasets[0].data.push(safe);
        realtimeChart.data.datasets[1].data.push(violation);

        if (realtimeChart.data.labels.length > 15) {
            realtimeChart.data.labels.shift();
            realtimeChart.data.datasets[0].data.shift();
            realtimeChart.data.datasets[1].data.shift();
        }

        realtimeChart.update('none'); // 靜默更新
    }

    // ==========================================================================
    // 🎥 WEBCAM 視訊與 YOLO 偵測框繪製邏輯
    // ==========================================================================
    
    // 繪圖循環：負責將視訊與 YOLO 邊界框合併繪製到 Canvas 上
    function drawVideoFrame() {
        if (!isStreaming) return;

        // 動態匹配視訊的解析度，確保比例正確
        if (detectionCanvas.width !== webcamVideo.videoWidth) {
            detectionCanvas.width = webcamVideo.videoWidth || 640;
            detectionCanvas.height = webcamVideo.videoHeight || 480;
        }

        const width = detectionCanvas.width;
        const height = detectionCanvas.height;

        // 1. 繪製當前視訊畫面影格為底圖
        canvasCtx.drawImage(webcamVideo, 0, 0, width, height);

        // 2. 依序繪製當前的所有 YOLO 偵測邊界框
        currentDetections.forEach(det => {
            // 座標解構 (假設 Python 傳回 0.0 ~ 1.0 的相對比例座標)
            const x1 = det.x1 * width;
            const y1 = det.y1 * height;
            const x2 = det.x2 * width;
            const y2 = det.y2 * height;
            const boxWidth = x2 - x1;
            const boxHeight = y2 - y1;

            const isViolation = det.className.includes('no-') || det.className === 'violation';
            const color = isViolation ? '#ff4757' : '#2ed573'; // 紅色 (違規) / 綠色 (安全)

            // 繪製邊界框
            canvasCtx.strokeStyle = color;
            canvasCtx.lineWidth = 3;
            canvasCtx.strokeRect(x1, y1, boxWidth, boxHeight);

            // 繪製標籤背景
            canvasCtx.fillStyle = color;
            const labelText = `${translateClassName(det.className)} ${(det.confidence * 100).toFixed(0)}%`;
            canvasCtx.font = 'bold 13px Outfit, system-ui, -apple-system, sans-serif';
            const textWidth = canvasCtx.measureText(labelText).width;
            
            canvasCtx.fillRect(x1, y1 - 24, textWidth + 12, 24);

            // 寫入標籤文字
            canvasCtx.fillStyle = '#ffffff';
            canvasCtx.fillText(labelText, x1 + 6, y1 - 7);
        });

        // 遞迴呼叫下一影格
        animationFrameId = requestAnimationFrame(drawVideoFrame);
    }

    // 擷取當前影像並傳送給後端
    function sendFrameToServer() {
        if (!isStreaming) return;

        // 使用一個隱藏的暫存 Canvas 來壓縮圖片大小以提高傳輸速度 (640x480)
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 640;
        tempCanvas.height = 480;
        const tempCtx = tempCanvas.getContext('2d');
        
        // 繪製 video 影格到暫存畫布上
        tempCtx.drawImage(webcamVideo, 0, 0, 640, 480);
        
        // 轉為 JPEG 格式 base64 字串，品質設為 0.5 (體積約 20~30KB，最適合即時傳輸)
        const base64Img = tempCanvas.toDataURL('image/jpeg', 0.5);
        
        // 透過 Socket.io 發送影格
        socket.emit('client_frame', base64Img);
    }

    // 啟動/暫停即時辨識事件
    async function toggleStream() {
        if (!isStreaming) {
            // 開啟鏡頭
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 } }
                });
                
                streamObject = stream;
                webcamVideo.srcObject = stream;
                
                webcamVideo.onloadedmetadata = () => {
                    webcamVideo.play();
                    isStreaming = true;
                    
                    // UI 切換：顯示 Canvas 畫布，隱藏原本靜態示範圖 bus.jpg
                    detectionCanvas.style.display = 'block';
                    liveStreamImg.style.display = 'none';
                    
                    // 啟動 Canvas 繪圖循環
                    drawVideoFrame();
                    
                    // 每 250ms (4 FPS) 發送影格給後端推論
                    sendFrameInterval = setInterval(sendFrameToServer, 250);
                    
                    // 更新按鈕外觀為「暫停」紅色樣式
                    toggleStreamBtn.innerHTML = '<i class="fa-solid fa-pause"></i> 暫停即時辨識';
                    toggleStreamBtn.classList.remove('btn-primary');
                    toggleStreamBtn.classList.add('btn-danger');
                    
                    // 通知後端串流已開始
                    socket.emit('start_stream');
                    console.log("[Webcam] 鏡頭即時串流已啟動");
                };
            } catch (err) {
                console.error("無法存取鏡頭:", err);
                alert("無法存取您的視訊鏡頭。請確保已給予瀏覽器相機使用權限。");
            }
        } else {
            // 暫停鏡頭
            isStreaming = false;
            
            // 停止計時器與繪圖循環
            if (sendFrameInterval) clearInterval(sendFrameInterval);
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            
            // 關閉相機串流軌道
            if (streamObject) {
                streamObject.getTracks().forEach(track => track.stop());
                streamObject = null;
            }
            webcamVideo.srcObject = null;
            
            // 還原 UI：顯示靜態示範圖，隱藏即時 Canvas
            liveStreamImg.style.display = 'block';
            detectionCanvas.style.display = 'none';
            
            // 清除畫布內容與暫存框線
            canvasCtx.clearRect(0, 0, detectionCanvas.width, detectionCanvas.height);
            currentDetections = [];
            
            // 還原按鈕外觀為「啟動」藍色樣式
            toggleStreamBtn.innerHTML = '<i class="fa-solid fa-play"></i> 啟動即時辨識';
            toggleStreamBtn.classList.remove('btn-danger');
            toggleStreamBtn.classList.add('btn-primary');
            
            // 通知後端串流已停止
            socket.emit('stop_stream');
            console.log("[Webcam] 鏡頭即時串流已關閉");
        }
    }

    // 截圖存檔事件
    async function saveSnapshot() {
        let base64Data = "";
        
        if (isStreaming) {
            // 若正在進行即時辨識，直接截取繪製了視訊影格和 YOLO 框線的 detectionCanvas 內容
            base64Data = detectionCanvas.toDataURL('image/jpeg', 0.9);
        } else {
            // 若處於暫停/靜態狀態，截取當前 liveStreamImg 影像
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = liveStreamImg.naturalWidth || 640;
            tempCanvas.height = liveStreamImg.naturalHeight || 480;
            const tempCtx = tempCanvas.getContext('2d');
            
            tempCtx.drawImage(liveStreamImg, 0, 0, tempCanvas.width, tempCanvas.height);
            base64Data = tempCanvas.toDataURL('image/jpeg', 0.9);
        }

        saveSnapshotBtn.disabled = true;
        saveSnapshotBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 儲存中...';

        try {
            // 1. 同步傳送給後端儲存至 WSL `image/Instant_screenshot` 目錄
            const response = await fetch('/api/snapshot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64Data })
            });
            const result = await response.json();
            
            if (result.success) {
                // 顯示精美 Toast 提示
                toastDesc.innerHTML = `📸 截圖存檔成功！檔案已存入 <code>image/Instant_screenshot/</code> 目錄下。`;
                alertToast.classList.add('active');
                setTimeout(() => alertToast.classList.remove('active'), 4000);
            } else {
                throw new Error(result.error);
            }
        } catch (err) {
            console.error("截圖失敗:", err);
            alert("截圖儲存失敗: " + err.message);
        } finally {
            saveSnapshotBtn.disabled = false;
            saveSnapshotBtn.innerHTML = '<i class="fa-solid fa-camera"></i> 截圖存檔';
        }
    }

    // 綁定按鈕監聽器
    toggleStreamBtn.addEventListener('click', toggleStream);
    saveSnapshotBtn.addEventListener('click', saveSnapshot);

    // ==========================================================================
    // 🔔 接收資料庫偵測結果 (SOCKET.IO 事件，用於日誌清單與圖表更新)
    // ==========================================================================
    
    let isFirstLog = true;
    function clearPlaceholderIfNeeded() {
        if (isFirstLog) {
            logsWrapper.innerHTML = '';
            isFirstLog = false;
        }
    }

    // 渲染單個偵測日誌
    function renderLog(data) {
        clearPlaceholderIfNeeded();

        const isViolation = data.className.includes('no-') || data.className === 'violation';
        const indicatorClass = isViolation ? 'danger' : 'safe';
        const tagClass = isViolation ? 'danger' : 'safe';
        const tagText = isViolation ? '安全違規' : '安全配戴';
        
        const timestamp = new Date(data.createdAt).toLocaleTimeString('zh-TW');

        const logHtml = `
            <div class="log-item">
                <div class="log-left">
                    <span class="log-indicator ${indicatorClass}"></span>
                    <div>
                        <span class="log-name">${translateClassName(data.className)}</span>
                        <div class="log-time">${timestamp}</div>
                    </div>
                </div>
                <div class="log-right">
                    <span class="log-conf">Acc: ${(data.confidence * 100).toFixed(0)}%</span>
                    <span class="status-tag ${tagClass}">${tagText}</span>
                </div>
            </div>
        `;
        logsWrapper.insertAdjacentHTML('afterbegin', logHtml);

        // UI 保持上限 50 筆
        if (logsWrapper.children.length > 50) {
            logsWrapper.removeChild(logsWrapper.lastChild);
        }

        // 更新計數器與警報
        if (isViolation) {
            violationCount++;
            violationCountEl.textContent = violationCount;
            triggerToastAlert(translateClassName(data.className));
        } else {
            safeCount++;
            safeCountEl.textContent = safeCount;
        }
    }

    // 繁體中文類別名稱字典
    function translateClassName(name) {
        const dict = {
            'bus': '公車 (Bus)',
            'person': '作業人員 (Person)',
            'helmet': '已戴安全帽',
            'vest': '已穿反光背心',
            'no-helmet': '🚨 未戴安全帽',
            'no-vest': '🚨 未穿反光背心',
            'violation': '🚨 安全違規行為'
        };
        return dict[name] || name;
    }

    // 觸發懸浮 Toast 警報
    let toastTimeout;
    function triggerToastAlert(itemName) {
        toastDesc.innerHTML = `⚠️ 偵測到 <strong>${itemName}</strong> 進入作業危險管制區！`;
        alertToast.classList.add('active');

        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            alertToast.classList.remove('active');
        }, 5000);
    }

    // 接收即時影格的 YOLO 邊界框偵測結果
    socket.on('frame_detections', (detections) => {
        if (!isStreaming) return;
        currentDetections = detections;
    });

    // 接收伺服器初始歷史紀錄
    socket.on('initial_data', (logs) => {
        if (logs.length > 0) {
            const reversedLogs = [...logs].reverse();
            
            // 渲染日誌
            logs.forEach(log => renderLog(log));

            // 群組 5 秒區間的圖表初始數據
            const chartData = {};
            reversedLogs.forEach(log => {
                const timeStr = new Date(log.createdAt).toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
                if (!chartData[timeStr]) {
                    chartData[timeStr] = { safe: 0, violation: 0 };
                }
                const isViolation = log.className.includes('no-') || log.className === 'violation';
                if (isViolation) chartData[timeStr].violation++;
                else chartData[timeStr].safe++;
            });

            Object.keys(chartData).forEach(time => {
                updateChart(time, chartData[time].safe, chartData[time].violation);
            });
        }
    });

    // 接收非同步寫入資料庫的新違規紀錄 (用於日誌控制台與圖表實時跳動)
    socket.on('new_detection', (data) => {
        renderLog(data);
        
        const timeStr = new Date(data.createdAt).toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const isViolation = data.className.includes('no-') || data.className === 'violation';
        
        updateChart(timeStr, isViolation ? 0 : 1, isViolation ? 1 : 0);
    });

    // ==========================================================================
    // 📑 頁面切換控制 (TABS NAVIGATION)
    // ==========================================================================
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // ==========================================================================
    // 🧠 GEMINI AI 安全分析報告生成
    // ==========================================================================
    const generateReportBtn = document.getElementById('generate-report-btn');
    const geminiLoader = document.getElementById('gemini-loader');
    const geminiReportContent = document.getElementById('gemini-report-content');

    generateReportBtn.addEventListener('click', async () => {
        geminiReportContent.style.display = 'none';
        geminiLoader.style.display = 'flex';
        generateReportBtn.disabled = true;

        try {
            const response = await fetch('/api/gemini-report');
            const data = await response.json();
            
            if (data.success) {
                let htmlReport = data.report;
                
                // 將 Markdown 轉為 HTML 清晰展現
                htmlReport = htmlReport
                    .replace(/### (.*)/g, '<h3>$1</h3>')
                    .replace(/\*\* (.*)/g, '<strong>$1</strong>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/-\s(.*)/g, '<li>$1</li>')
                    .replace(/\n\n/g, '<br><br>');
                
                geminiReportContent.innerHTML = htmlReport;
            } else {
                geminiReportContent.innerHTML = `
                    <div class="report-empty" style="color:var(--danger);">
                        <i class="fa-solid fa-circle-exclamation"></i>
                        <p>生成安全報告時發生錯誤：${data.error}</p>
                    </div>
                `;
            }
        } catch (error) {
            geminiReportContent.innerHTML = `
                <div class="report-empty" style="color:var(--danger);">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    <p>伺服器連線失敗：${error.message}</p>
                </div>
            `;
        } finally {
            geminiLoader.style.display = 'none';
            geminiReportContent.style.display = 'block';
            generateReportBtn.disabled = false;
        }
    });
});
