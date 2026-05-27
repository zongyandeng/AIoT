import cv2
import threading
import time
from ultralytics import YOLO

class ThreadedCamera:
    def __init__(self, src):
        self.cap = cv2.VideoCapture(src)
        self.frame = None
        self.running = True
        self.lock = threading.Lock()
        if not self.cap.isOpened(): 
            print(f"錯誤：無法開啟影像來源 {src}")
        # 啟動子執行緒，負責瘋狂讀取最新畫面
        threading.Thread(target=self.update, daemon=True).start()

    def update(self):
        while self.running:
            if self.cap.isOpened():
                ret, frame = self.cap.read()
                if ret:
                    with self.lock: 
                        self.frame = frame
                else: 
                    time.sleep(0.01)
            else: 
                time.sleep(0.1)

    def read(self):
        with self.lock:
            return self.frame.copy() if self.frame is not None else None

    def stop(self):
        self.running = False
        self.cap.release()

# --- 主程式 ---
# 1. 使用剛才下載好的公車圖片作為串流源（OpenCV 也能讀單圖），或者你可以換成你的影片路徑例如 "test.mp4"
source_src = "bus.jpg" 
cam = ThreadedCamera(source_src)

# 2. 載入模型
model = YOLO('yolo11n.pt')

print("正在啟動優化後的影像串流... 按下 Ctrl + C 可停止群組運算")

try:
    while True:
        frame = cam.read()
        if frame is None:
            time.sleep(0.1)
            continue

        # 3. 進行推論（verbose=False 可以讓 Terminal 畫面乾淨，device='cpu' 防卡死）
        results = model(frame, verbose=False, device='cpu')
        
        # 4. 算出偵測到幾個物件並印在 Terminal
        boxes = results[0].boxes
        print(f"\r當前畫面即時偵測到：{len(boxes)} 個物件", end="")
        
        # 註：因為 WSL2 預設開視窗需要額外設定環境變數，這裡我們先把結果儲存成圖片
        # 之後整合後端時，我們會直接把這些數據打包成 JSON 傳給 Node.js！
        time.sleep(1) # 每秒偵測一次

except KeyboardInterrupt:
    print("\n監控已手動停止。")
    cam.stop()
