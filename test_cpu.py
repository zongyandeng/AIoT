from ultralytics import YOLO

# 1. 載入官方 Nano 模型
model = YOLO('yolo11n.pt') 

# 2. 進行預測，並強制指定使用 CPU 跑
print("正在執行 CPU 推論...")
results = model('https://ultralytics.com/images/bus.jpg', device='cpu')

# 3. 儲存結果圖片
results[0].save() 
print("推論完成！結果圖片已儲存。")
