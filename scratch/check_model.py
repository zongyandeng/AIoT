from ultralytics import YOLO
import os

def check():
    paths = {
        "yolo26n.pt": "../yolo26n.pt",
        "yolo11n.pt": "../yolo11n.pt",
        "best.pt": "../runs/detect/yolo_low_vram/low_vram_run-9/weights/best.pt"
    }
    
    for name, rel_path in paths.items():
        abs_path = os.path.abspath(os.path.join(os.path.dirname(__file__), rel_path))
        if os.path.exists(abs_path):
            try:
                model = YOLO(abs_path)
                print(f"=== {name} ===")
                print(f"路徑: {abs_path}")
                print(f"類別數量: {len(model.names)}")
                print(f"前 10 個類別: {list(model.names.items())[:10]}")
            except Exception as e:
                print(f"讀取 {name} 失敗: {str(e)}")
        else:
            print(f"檔案不存在: {abs_path}")

if __name__ == "__main__":
    check()
