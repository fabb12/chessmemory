# Modello YOLO per il riconoscimento dei pezzi

La modalità tutor e «Analizza» usano un modello YOLO eseguito sul dispositivo
(onnxruntime-web, WebAssembly) per riconoscere i pezzi senza chiamare Claude.
Gira nel browser di chi usa l'app: non serve installare nulla.

## Modello incluso

`chess-pieces.onnx` (10,6 MB) è YOLOv8n esportato dai pesi pubblici di
[wojciechc1/AI_Chess](https://github.com/wojciechc1/AI_Chess) (licenza MIT;
dettagli e avvertenza sulla licenza AGPL di Ultralytics in
`LICENSE-chess-pieces.txt`).

Limiti misurati: sulla scacchiera usata per l'addestramento è preciso
(confidenze 0,7–0,98); su scacchiere e pezzi molto diversi (es. legno
chiaro/scuro) sbaglia spesso colore e tipo. L'app ne tiene conto: YOLO da solo
non smentisce mai Claude, e senza Claude basta solo quando tutta la scacchiera
corrisponde a una mossa legale con poche case incerte. Per la massima
affidabilità conviene riaddestrarlo con foto della propria scacchiera (sotto).

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
riconoscimento sui propri pezzi). Il nuovo `.onnx` sostituisce quello
incluso: aggiorna anche `LICENSE-chess-pieces.txt`.

In alternativa si può indicare un modello ospitato altrove impostando nel
browser `localStorage['cm.vision.modelUrl']` (accanto deve esserci il `.json`).
