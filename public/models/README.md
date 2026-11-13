# Modello YOLO per il riconoscimento dei pezzi

La modalità tutor e «Analizza» usano, se presente, un modello YOLO eseguito sul
dispositivo (onnxruntime-web, WebAssembly) per riconoscere i pezzi senza
chiamare Claude. Il modello **non è incluso** nel repository: va addestrato (o
scaricato) ed esportato in ONNX.

File attesi in questa cartella:

| File | Contenuto |
| --- | --- |
| `chess-pieces.onnx` | modello YOLO (v5, v8, v11 o end-to-end v10/26) esportato in ONNX, ingresso 640×640 |
| `chess-pieces.json` | `{ "classes": ["black-bishop", …], "inputSize": 640 }` — nomi delle classi nell'ordine del modello |

Senza `chess-pieces.json` si assumono le 12 classi del dataset «Chess Pieces» di
Roboflow in ordine alfabetico (`black-bishop … white-rook`). I nomi delle classi
possono essere di qualunque forma comune: `white-king`, `black_pawn`, `wK`,
`bp`, `K`/`k`; le classi che non sono pezzi (es. `board`) vengono ignorate.

## Addestrare ed esportare

```bash
pip install ultralytics
python scripts/yolo/train_export.py --data path/al/dataset/data.yaml --epochs 80
```

Lo script addestra YOLOv8n (piccolo e veloce sul telefono), lo esporta in ONNX
e scrive qui sia il modello sia il file delle classi. Con un modello già
addestrato (`best.pt`):

```bash
python scripts/yolo/train_export.py --weights best.pt
```

Dataset consigliati: «Chess Pieces» (Roboflow Universe) o foto proprie della
propria scacchiera etichettate (anche 100–200 foto migliorano molto il
riconoscimento sui propri pezzi). Il file `.onnx` è escluso da git
(`.gitignore`): per pubblicarlo con l'app su GitHub Pages copialo nel workflow
di deploy oppure rimuovi la riga dal `.gitignore`.

In alternativa si può indicare un modello ospitato altrove impostando nel
browser `localStorage['cm.vision.modelUrl']` (accanto deve esserci il `.json`).
