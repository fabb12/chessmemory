"""Addestra (facoltativo) ed esporta in ONNX il modello YOLO dei pezzi degli scacchi.

Uso:
  python scripts/yolo/train_export.py --data dataset/data.yaml [--epochs 80] [--model yolov8n.pt]
  python scripts/yolo/train_export.py --weights runs/detect/train/weights/best.pt

Scrive public/models/chess-pieces.onnx e public/models/chess-pieces.json
(nomi delle classi nell'ordine del modello), letti dall'app nel browser.
"""

import argparse
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "models"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", help="data.yaml del dataset (formato YOLO/Ultralytics)")
    parser.add_argument("--weights", help="pesi già addestrati (.pt): salta l'addestramento")
    parser.add_argument("--model", default="yolov8n.pt", help="modello di partenza (default: yolov8n.pt)")
    parser.add_argument("--epochs", type=int, default=80)
    parser.add_argument("--imgsz", type=int, default=640)
    args = parser.parse_args()

    from ultralytics import YOLO  # import qui: serve solo per questo script

    if args.weights:
        model = YOLO(args.weights)
    elif args.data:
        model = YOLO(args.model)
        # Foto scattate da ogni lato e un po' inclinate: rotazioni e prospettiva leggere.
        model.train(data=args.data, epochs=args.epochs, imgsz=args.imgsz, degrees=10, perspective=0.0005, fliplr=0.5)
    else:
        parser.error("serve --data (per addestrare) oppure --weights (per esportare)")

    onnx_path = Path(model.export(format="onnx", imgsz=args.imgsz, opset=12, simplify=True, dynamic=False))
    OUT.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(onnx_path, OUT / "chess-pieces.onnx")
    names = model.names
    classes = [names[i] for i in sorted(names)] if isinstance(names, dict) else list(names)
    (OUT / "chess-pieces.json").write_text(json.dumps({"classes": classes, "inputSize": args.imgsz}, indent=2) + "\n")
    print(f"Modello scritto in {OUT / 'chess-pieces.onnx'} con {len(classes)} classi: {classes}")


if __name__ == "__main__":
    main()
