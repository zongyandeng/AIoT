import sys
import json
import base64
import os
import argparse
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
                
                # 執行 YOLO 推論 ( verbose=False 關閉大量除錯日誌，device='cpu' 確保在 CPU 上流暢執行)
                results = model(img, verbose=False, device='cpu')
                
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
            
    except Exception as e:
        # 防止解析錯誤導致 Python 程序崩潰中斷
        print(json.dumps({"status": "error", "message": f"接收指令解析失敗: {str(e)}"}))
        sys.stdout.flush()
