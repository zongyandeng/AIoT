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
    const liveStreamPlaceholder = document.getElementById('live-stream-placeholder');
    const detectionCanvas = document.getElementById('detection-canvas');
    const canvasCtx = detectionCanvas.getContext('2d');

    // ⚙️ 影像來源設定元件
    const videoSourceSelect = document.getElementById('video-source-select');
    const localSourceGroup = document.getElementById('local-source-group');
    const localDeviceSelect = document.getElementById('local-device-select');
    const ipcamSourceGroup = document.getElementById('ipcam-source-group');

    let safeCount = 0;
    let violationCount = 0;
    let latestSafeCount = 0;
    let latestViolationCount = 0;
    let chartUpdateInterval = null;

    // 狀態變數
    let isStreaming = false;
    let streamObject = null;
    let sendFrameInterval = null;
    let chartInterval = null;
    let animationFrameId = null;
    let currentDetections = [];
    let latestIpCamImage = null; // 用於儲存後端傳回的最新 IP Cam 影像


    // 偵測並更新本機相機裝置清單
    async function updateCameraList() {
        try {
            // 請求相機權限以利 enumerateDevices() 取得裝置名稱
            const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
            // 取得權限後立即關閉暫存鏡頭軌道，避免佔用
            tempStream.getTracks().forEach(track => track.stop());
            
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            
            localDeviceSelect.innerHTML = '';
            if (videoDevices.length === 0) {
                localDeviceSelect.innerHTML = '<option value="">未偵測到本機/USB 攝影機</option>';
                return;
            }
            videoDevices.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `Camera ${index + 1}`;
                localDeviceSelect.appendChild(option);
            });
        } catch (err) {
            console.warn("無法取得相機清單 (可能無相機或未授權):", err);
            localDeviceSelect.innerHTML = '<option value="">無法取得相機 (未授權)</option>';
        }
    }
    updateCameraList();

    // 監聽影像來源切換
    videoSourceSelect.addEventListener('change', () => {
        const source = videoSourceSelect.value;
        if (source === 'local') {
            localSourceGroup.style.display = 'flex';
            ipcamSourceGroup.style.display = 'none';
        } else {
            localSourceGroup.style.display = 'none';
            ipcamSourceGroup.style.display = 'flex';
        }
        
        // 切換來源時，如果正在串流則先停止
        if (isStreaming) {
            toggleStream();
        }
    });

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
    
    // 繪製 YOLO 偵測邊界框的共享邏輯
    function drawDetections(width, height) {
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
    }

    // 繪圖循環：負責將本機/USB 視訊與 YOLO 邊界框合併繪製到 Canvas 上 (本機模式專用)
    function drawVideoFrame() {
        if (!isStreaming || videoSourceSelect.value !== 'local') return;

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
        drawDetections(width, height);

        // 遞迴呼叫下一影格
        animationFrameId = requestAnimationFrame(drawVideoFrame);
    }

    // 擷取當前影像並傳送給後端 (本機模式專用)
    function sendFrameToServer() {
        if (!isStreaming || videoSourceSelect.value !== 'local') return;

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
        const sourceMode = videoSourceSelect.value;
        
        if (!isStreaming) {
            if (sourceMode === 'local') {
                // --- 1. 本機 / USB 攝影機模式 ---
                try {
                    const selectedDeviceId = localDeviceSelect.value;
                    const constraints = {
                        video: {
                            deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
                            width: { ideal: 640 },
                            height: { ideal: 480 },
                            frameRate: { ideal: 15 }
                        }
                    };
                    const stream = await navigator.mediaDevices.getUserMedia(constraints);
                    
                    streamObject = stream;
                    webcamVideo.srcObject = stream;
                    
                    webcamVideo.onloadedmetadata = () => {
                        webcamVideo.play();
                        isStreaming = true;
                        
                        // UI 切換：顯示 Canvas 畫布，隱藏靜態佔位區
                        detectionCanvas.style.display = 'block';
                        liveStreamPlaceholder.style.display = 'none';
                        saveSnapshotBtn.disabled = false;
                        
                        // 啟動 Canvas 繪圖循環
                        drawVideoFrame();
                        
                        // 每 250ms (4 FPS) 發送影格給後端推論
                        sendFrameInterval = setInterval(sendFrameToServer, 250);
                        
                        // 每 2 秒 (2000ms) 定時將最新偵測數更新至圖表，保持平滑趨勢
                        chartUpdateInterval = setInterval(() => {
                            if (!isStreaming) return;
                            const timeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
                            updateChart(timeStr, latestSafeCount, latestViolationCount);
                        }, 2000);
                        
                        // 更新按鈕外觀為「暫停」紅色樣式
                        toggleStreamBtn.innerHTML = '<i class="fa-solid fa-pause"></i> 暫停即時辨識';
                        toggleStreamBtn.classList.remove('btn-primary');
                        toggleStreamBtn.classList.add('btn-danger');
                        
                        // 通知後端本機串流已開始
                        socket.emit('start_stream');
                        console.log("[Webcam] 本機/USB 鏡頭即時串流已啟動");
                    };
                } catch (err) {
                    console.error("無法存取鏡頭:", err);
                    alert("無法存取您的視訊鏡頭。請確保已給予瀏覽器相機使用權限。");
                }
            } else if (sourceMode === 'ipcam') {
                // --- 2. 網路攝影機 IP Cam 模式 ---
                isStreaming = true;
                
                // UI 切換：顯示 Canvas 畫布，隱藏靜態佔位區
                detectionCanvas.style.display = 'block';
                liveStreamPlaceholder.style.display = 'none';
                saveSnapshotBtn.disabled = false;
                
                // 每 2 秒 (2000ms) 定時將最新偵測數更新至圖表
                chartUpdateInterval = setInterval(() => {
                    if (!isStreaming) return;
                    const timeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    updateChart(timeStr, latestSafeCount, latestViolationCount);
                }, 2000);
                
                // 更新按鈕外觀為「暫停」紅色樣式
                toggleStreamBtn.innerHTML = '<i class="fa-solid fa-pause"></i> 暫停即時辨識';
                toggleStreamBtn.classList.remove('btn-primary');
                toggleStreamBtn.classList.add('btn-danger');
                
                // 通知後端啟動 IP Cam 串流 (後端將直接讀取 .env)
                socket.emit('start_ip_cam');
                console.log("[IP Cam] IP Cam 串流已請求啟動");
            }
        } else {
            // --- 停止串流 (適用於所有模式) ---
            isStreaming = false;
            
            // 停止計時器與繪圖循環
            if (sendFrameInterval) clearInterval(sendFrameInterval);
            if (chartUpdateInterval) clearInterval(chartUpdateInterval);
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            
            // 關閉相機串流軌道
            if (streamObject) {
                streamObject.getTracks().forEach(track => track.stop());
                streamObject = null;
            }
            webcamVideo.srcObject = null;
            
            // 還原 UI：顯示靜態佔位區，隱藏即時 Canvas
            liveStreamPlaceholder.style.display = 'flex';
            detectionCanvas.style.display = 'none';
            saveSnapshotBtn.disabled = true;
            
            // 清除畫布內容與暫存框線
            canvasCtx.clearRect(0, 0, detectionCanvas.width, detectionCanvas.height);
            currentDetections = [];
            latestIpCamImage = null;
            
            // 重置即時計數器與介面顯示
            latestSafeCount = 0;
            latestViolationCount = 0;
            safeCountEl.textContent = '0';
            violationCountEl.textContent = '0';
            
            // 還原按鈕外觀為「啟動」藍色樣式
            toggleStreamBtn.innerHTML = '<i class="fa-solid fa-play"></i> 啟動即時辨識';
            toggleStreamBtn.classList.remove('btn-danger');
            toggleStreamBtn.classList.add('btn-primary');
            
            if (sourceMode === 'local') {
                // 通知後端串流已停止
                socket.emit('stop_stream');
                console.log("[Webcam] 本機/USB 鏡頭即時串流已關閉");
            } else {
                // 通知後端停止 IP Cam 串流
                socket.emit('stop_ip_cam');
                console.log("[IP Cam] IP Cam 串流已關閉");
            }
        }
    }

    // 截圖存檔事件
    async function saveSnapshot() {
        if (!isStreaming) return;
        
        // 直接截取繪製了視訊影格和 YOLO 框線的 detectionCanvas 內容
        const base64Data = detectionCanvas.toDataURL('image/jpeg', 0.9);

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

        // 歷史日誌不更新即時面板的指標計數器，僅在此寫入輔助日誌
        if (isViolation) {
            // 歷史日誌載入時不在此觸發 Toast，Toast 改由 new_detection 專責即時觸發
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

        // 計算當前影格的即時安全與違規計數
        let frameSafe = 0;
        let frameViolation = 0;

        detections.forEach(det => {
            const isViolation = det.className.includes('no-') || det.className === 'violation';
            if (isViolation) {
                frameViolation++;
            } else if (det.className === 'helmet' || det.className === 'vest') {
                frameSafe++;
            }
        });

        latestSafeCount = frameSafe;
        latestViolationCount = frameViolation;

        // 即時更新指標卡數值
        safeCountEl.textContent = latestSafeCount;
        violationCountEl.textContent = latestViolationCount;
    });

    // 接收後端推送的 IP Cam 影格與 YOLO 偵測結果
    socket.on('ip_cam_frame', (data) => {
        if (!isStreaming || videoSourceSelect.value !== 'ipcam') return;
        
        currentDetections = data.detections;
        
        // 1. 計算當前影格的即時安全與違規計數
        let frameSafe = 0;
        let frameViolation = 0;
        currentDetections.forEach(det => {
            const isViolation = det.className.includes('no-') || det.className === 'violation';
            if (isViolation) {
                frameViolation++;
            } else if (det.className === 'helmet' || det.className === 'vest') {
                frameSafe++;
            }
        });
        latestSafeCount = frameSafe;
        latestViolationCount = frameViolation;
        
        safeCountEl.textContent = latestSafeCount;
        violationCountEl.textContent = latestViolationCount;
        
        // 2. 將接收到的 base64 影像渲染到 Canvas 上
        if (data.image) {
            const img = new Image();
            img.onload = () => {
                latestIpCamImage = img;
                if (!isStreaming || videoSourceSelect.value !== 'ipcam') return;
                
                if (detectionCanvas.width !== img.width) {
                    detectionCanvas.width = img.width || 640;
                    detectionCanvas.height = img.height || 480;
                }
                const width = detectionCanvas.width;
                const height = detectionCanvas.height;
                
                // 繪製底圖
                canvasCtx.drawImage(img, 0, 0, width, height);
                // 繪製 YOLO 偵測框
                drawDetections(width, height);
            };
            img.src = data.image;
        }
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

    // 接收非同步寫入資料庫的新違規紀錄 (僅用於日誌控制台與觸發懸浮警告 Toast)
    socket.on('new_detection', (data) => {
        renderLog(data);
        
        const isViolation = data.className.includes('no-') || data.className === 'violation';
        if (isViolation) {
            triggerToastAlert(translateClassName(data.className));
        }
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
