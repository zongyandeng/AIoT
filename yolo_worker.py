import sys
import json
import base64
import os
import argparse
import threading
import time
import cv2
from io import BytesIO
from PIL import Image
from ultralytics import YOLO


# 支援命令行參數解析，方便未來切換模型或擴充參數
parser = argparse.ArgumentParser(description="YOLO AIoT Worker")
parser.add_argument('--model', type=str, default='yolo11n.pt', help='YOLO model file path or name')
args = parser.parse_args()

# 載入模型 (後端 Node.js 呼叫時會將工作目錄切換至 backend，故模型相對路徑會是相對於 backend)
model_path = args.model
try:
    model = YOLO(model_path)
    # 向 Node.js 回報 Python 已經準備就緒
    print(json.dumps({"status": "ready", "model": model_path}))
    sys.stdout.flush()
except Exception as err:
    print(json.dumps({"status": "error", "message": f"無法載入模型檔 {model_path}: {str(err)}"}))
    sys.stdout.flush()
    sys.exit(1)

# ==========================================================================
# 🎥 網路攝影機 IP Cam (RTSP) 背景串流與辨識控制
# ==========================================================================
ip_cam_thread = None
ip_cam_running = False
ip_cam_lock = threading.Lock()

def ip_cam_loop(rtsp_url):
    global ip_cam_running, model
    print(json.dumps({"status": "info", "message": f"IP Cam 背景執行緒啟動，連線至: {rtsp_url}"}))
    sys.stdout.flush()
    
    cap = cv2.VideoCapture(rtsp_url)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1) # 最小化快取
    
    reconnect_delay = 2.0
    
    while ip_cam_running:
        if not cap.isOpened():
            print(json.dumps({"status": "info", "message": f"IP Cam 連線中斷，將於 {reconnect_delay} 秒後重連..."}))
            sys.stdout.flush()
            time.sleep(reconnect_delay)
            cap = cv2.VideoCapture(rtsp_url)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            continue
            
        ret, frame = cap.read()
        if not ret:
            time.sleep(0.05)
            continue
            
        try:
            # 為了降低 IPC 傳輸大小，若畫面太大則進行縮放 (上限 640x480)
            h, w = frame.shape[:2]
            if w > 640 or h > 480:
                scale = min(640.0 / w, 480.0 / h)
                new_w, new_h = int(w * scale), int(h * scale)
                frame_resized = cv2.resize(frame, (new_w, new_h))
            else:
                frame_resized = frame
                
            # YOLO 推論 (verbose=False 關閉大量日誌，device='cpu')
            results = model(frame_resized, verbose=False, device='cpu', conf=0.15)
            
            # 收集邊界框偵測結果
            detections = []
            boxes = results[0].boxes
            orig_h, orig_w = frame_resized.shape[0], frame_resized.shape[1]
            
            for box in boxes:
                cls_id = int(box.cls[0])
                name = model.names[cls_id]
                confidence = float(box.conf[0])
                xyxy = box.xyxy[0].tolist()
                
                detections.append({
                    "className": name,
                    "confidence": round(confidence, 2),
                    "x1": round(xyxy[0] / orig_w, 4),
                    "y1": round(xyxy[1] / orig_h, 4),
                    "x2": round(xyxy[2] / orig_w, 4),
                    "y2": round(xyxy[3] / orig_h, 4)
                })
                
            # 將 frame 轉換成 JPEG Base64 格式
            _, buffer = cv2.imencode('.jpg', frame_resized, [int(cv2.IMWRITE_JPEG_QUALITY), 50])
            base64_str = base64.b64encode(buffer).decode('utf-8')
            image_data = f"data:image/jpeg;base64,{base64_str}"
            
            # 輸出 JSON 影格辨識結果給 Node.js
            response = {
                "status": "success",
                "action": "ip_cam_frame",
                "image": image_data,
                "detections": detections
            }
            print(json.dumps(response))
            sys.stdout.flush()
            
            # 控制推論頻率約 4 FPS (每 250ms 推論一次)
            # 在等待時間內，藉由 grab() 快速排空 OpenCV 內部快取緩衝區以防畫面延遲
            t_end = time.time() + 0.25
            while time.time() < t_end and ip_cam_running:
                cap.grab()
                time.sleep(0.01)
                
        except Exception as ex:
            print(json.dumps({"status": "info", "message": f"IP Cam YOLO 推論錯誤: {str(ex)}"}))
            sys.stdout.flush()
            time.sleep(0.1)
            
    cap.release()
    print(json.dumps({"status": "info", "message": "IP Cam 背景執行緒已停止並釋放資源"}))
    sys.stdout.flush()

# 透過 stdin 進入持續接收影格進行推論的循環 (以 JSON IPC 機製實作)
for line in sys.stdin:
    try:
        line_str = line.strip()
        if not line_str:
            continue
            
        data = json.loads(line_str)
        action = data.get("action")
        
        # 1. 處理影像辨識請求
        if action == "detect":
            img_data = data.get("image")
            if not img_data:
                continue
                
            # 去除前端 Base64 可能攜帶的 DataURL 前綴
            if img_data.startswith("data:image"):
                base64_str = img_data.split(",")[1]
            else:
                base64_str = img_data
                
            try:
                # 將 Base64 解碼並轉成 PIL Image 物件
                img_bytes = base64.b64decode(base64_str)
                img = Image.open(BytesIO(img_bytes))
                
                # 執行 YOLO 推論 ( verbose=False 關閉大量除錯日誌，device='cpu' 確保在 CPU 上流暢執行，conf=0.15 降低置信度門檻以提升日常近景敏感度)
                results = model(img, verbose=False, device='cpu', conf=0.15)
                
                # 收集此張圖片的所有邊界框偵測結果
                detections = []
                boxes = results[0].boxes
                
                # 取得原圖寬高以進行相對比例轉換
                orig_shape = results[0].orig_shape  # 格式為 (height, width)
                orig_h, orig_w = orig_shape[0], orig_shape[1]
                
                for box in boxes:
                    cls_id = int(box.cls[0])
                    name = model.names[cls_id]
                    confidence = float(box.conf[0])
                    
                    # 取得絕對像素座標 [x1, y1, x2, y2]
                    xyxy = box.xyxy[0].tolist()
                    
                    # 轉換為 0.0 ~ 1.0 的相對比例座標，以保證前端 Canvas 任意縮放時依然能百分之百精準繪製
                    detections.append({
                        "className": name,
                        "confidence": round(confidence, 2),
                        "x1": round(xyxy[0] / orig_w, 4),
                        "y1": round(xyxy[1] / orig_h, 4),
                        "x2": round(xyxy[2] / orig_w, 4),
                        "y2": round(xyxy[3] / orig_h, 4)
                    })
                
                # 輸出 JSON 格式的完整影格辨識結果給 Node.js
                response = {
                    "status": "success",
                    "action": "detect",
                    "detections": detections
                }
                print(json.dumps(response))
                sys.stdout.flush()
                
            except Exception as ex:
                print(json.dumps({"status": "error", "message": f"影像辨識過程失敗: {str(ex)}"}))
                sys.stdout.flush()
                
        # 2. 處理動態更換模型請求 (預留調整彈性)
        elif action == "change_model":
            new_model = data.get("model")
            if new_model:
                try:
                    model = YOLO(new_model)
                    print(json.dumps({"status": "model_changed", "model": new_model}))
                except Exception as ex:
                    print(json.dumps({"status": "error", "message": f"更換模型檔失敗: {str(ex)}"}))
            else:
                print(json.dumps({"status": "error", "message": "更換模型參數無效"}))
            sys.stdout.flush()

        # 3. 啟動網路攝影機 IP Cam 讀取執行緒
        elif action == "start_ip_cam":
            rtsp_url = data.get("rtsp_url")
            if rtsp_url:
                # 確保舊執行緒已被要求停止並正常關閉
                if ip_cam_running:
                    ip_cam_running = False
                    if ip_cam_thread:
                        ip_cam_thread.join(timeout=2.0)
                
                # 啟動新執行緒
                ip_cam_running = True
                ip_cam_thread = threading.Thread(
                    target=ip_cam_loop,
                    args=(rtsp_url,),
                    daemon=True
                )
                ip_cam_thread.start()
            else:
                print(json.dumps({"status": "error", "message": "啟動 IP Cam 失敗，缺少 rtsp_url"}))
                sys.stdout.flush()

        # 4. 停止網路攝影機 IP Cam 讀取執行緒
        elif action == "stop_ip_cam":
            if ip_cam_running:
                ip_cam_running = False
                if ip_cam_thread:
                    ip_cam_thread.join(timeout=2.0)
                print(json.dumps({"status": "info", "message": "已要求停止 IP Cam 背景執行緒"}))
            else:
                print(json.dumps({"status": "info", "message": "IP Cam 背景執行緒本來就未在執行中"}))
            sys.stdout.flush()
            
    except Exception as e:
        # 防止解析錯誤導致 Python 程序崩潰中斷
        print(json.dumps({"status": "error", "message": f"接收指令解析失敗: {str(e)}"}))
        sys.stdout.flush()

