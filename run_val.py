from ultralytics import YOLO
import sys

def val_model():
    model_path = '/home/edison/aiot_workspace/runs/detect/yolo_low_vram/low_vram_run-9/weights/best.pt'
    yaml_path = '/home/edison/aiot_workspace/dataset.yaml'
    
    print(f"Loading model: {model_path}")
    model = YOLO(model_path)
    
    print("Running validation...")
    metrics = model.val(
        data=yaml_path,
        project='/home/edison/aiot_workspace/runs/detect/yolo_low_vram',
        name='val_run',
        split='val',
        device='cpu' # Use CPU for quick validation to prevent OOM
    )
    print("Validation finished successfully!")

if __name__ == '__main__':
    val_model()
