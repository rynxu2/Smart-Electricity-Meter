# -*- coding: utf-8 -*-
"""
Web-based OCR Test UI
=====================
Upload meter images and see YOLOv11n + PaddleOCR results visually.

Usage:
  python test_web_ocr.py
  -> Open http://localhost:8501
"""

import base64
import io
import os
import sys
import time
import json
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, UploadFile, File, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
from PIL import Image, ImageDraw

app = FastAPI(title="OCR Test UI")

os.makedirs("test_output", exist_ok=True)

HTML_PAGE = """
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Smart Meter OCR Test — YOLOv11n + PaddleOCR</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    background: #0f172a; color: #e2e8f0;
    min-height: 100vh;
  }
  .header {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border-bottom: 1px solid #334155;
    padding: 24px 32px;
  }
  .header h1 {
    font-size: 24px; font-weight: 700;
    background: linear-gradient(90deg, #38bdf8, #818cf8);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  }
  .header p { color: #94a3b8; margin-top: 4px; font-size: 14px; }
  .container { max-width: 1200px; margin: 0 auto; padding: 32px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  @media (max-width: 800px) { .grid { grid-template-columns: 1fr; } }
  .card {
    background: #1e293b; border: 1px solid #334155;
    border-radius: 12px; padding: 24px;
  }
  .card h2 {
    font-size: 16px; font-weight: 600; margin-bottom: 16px;
    color: #94a3b8;
  }
  .upload-zone {
    border: 2px dashed #475569; border-radius: 12px;
    padding: 48px 24px; text-align: center;
    cursor: pointer; transition: all 0.2s;
  }
  .upload-zone:hover { border-color: #38bdf8; background: #1e293b80; }
  .upload-zone.dragover { border-color: #38bdf8; background: #38bdf810; }
  .upload-zone svg { width: 48px; height: 48px; color: #475569; margin-bottom: 12px; }
  .upload-zone p { color: #94a3b8; }
  .upload-zone input { display: none; }
  .btn {
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    color: white; border: none; padding: 10px 24px;
    border-radius: 8px; font-size: 14px; font-weight: 600;
    cursor: pointer; transition: opacity 0.2s;
  }
  .btn:hover { opacity: 0.9; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-gen {
    background: linear-gradient(135deg, #059669, #10b981);
    margin-top: 12px; width: 100%;
  }
  .preview-img {
    width: 100%; border-radius: 8px;
    border: 1px solid #334155; margin-top: 12px;
  }
  .result-box {
    background: #0f172a; border-radius: 8px;
    padding: 16px; margin-top: 12px;
  }
  .result-row {
    display: flex; justify-content: space-between;
    padding: 8px 0; border-bottom: 1px solid #1e293b;
  }
  .result-row:last-child { border: none; }
  .result-label { color: #94a3b8; font-size: 13px; }
  .result-value { font-weight: 600; font-size: 15px; }
  .result-value.big { font-size: 28px; color: #38bdf8; }
  .pipeline-badge {
    display: inline-block; padding: 2px 10px;
    border-radius: 999px; font-size: 12px; font-weight: 600;
  }
  .pipeline-yolo { background: #065f4620; color: #34d399; border: 1px solid #34d399; }
  .pipeline-fallback { background: #78350f20; color: #fbbf24; border: 1px solid #fbbf24; }
  .fragments { margin-top: 12px; }
  .fragment {
    background: #1e293b; border: 1px solid #334155;
    border-radius: 8px; padding: 10px 14px; margin-top: 6px;
    display: flex; justify-content: space-between; align-items: center;
  }
  .conf-bar {
    width: 100px; height: 6px; background: #334155;
    border-radius: 3px; overflow: hidden;
  }
  .conf-fill { height: 100%; border-radius: 3px; }
  .spinner { display: none; margin: 20px auto; }
  .spinner.active { display: block; }
  .spinner svg { animation: spin 1s linear infinite; width: 40px; height: 40px; color: #38bdf8; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .status { text-align: center; padding: 12px; color: #94a3b8; font-size: 14px; }
  .timer { color: #fbbf24; font-family: monospace; }
  .gen-input { display: flex; gap: 8px; margin-top: 12px; }
  .gen-input input {
    flex: 1; background: #0f172a; border: 1px solid #334155;
    border-radius: 8px; padding: 8px 12px; color: #e2e8f0;
    font-family: monospace; font-size: 16px;
  }
</style>
</head>
<body>

<div class="header">
  <h1>⚡ Smart Meter OCR Test</h1>
  <p>YOLOv11n + PaddleOCR v4 Pipeline — Upload ảnh công tơ điện để test nhận dạng</p>
</div>

<div class="container">
<div class="grid">

  <!-- LEFT: Upload -->
  <div>
    <div class="card">
      <h2>📸 Ảnh đầu vào</h2>
      <div class="upload-zone" id="dropZone" onclick="document.getElementById('fileInput').click()">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
        </svg>
        <p>Kéo thả ảnh vào đây hoặc click để chọn</p>
        <p style="font-size:12px;margin-top:4px;color:#64748b">JPG, PNG — ảnh từ ESP32-CAM hoặc chụp công tơ</p>
        <input type="file" id="fileInput" accept="image/*">
      </div>
      <img id="previewImg" class="preview-img" style="display:none">
    </div>

    <div class="card" style="margin-top:16px">
      <h2>🏭 Tạo ảnh mẫu</h2>
      <p style="font-size:13px;color:#94a3b8">Tạo ảnh công tơ giả để test nhanh</p>
      <div class="gen-input">
        <input type="text" id="genReading" value="15234.6" placeholder="Nhập chỉ số...">
        <button class="btn" onclick="generateSample()">Tạo</button>
      </div>
      <button class="btn btn-gen" onclick="generateAndTest()">Tạo + Test OCR</button>
    </div>
  </div>

  <!-- RIGHT: Results -->
  <div>
    <div class="card">
      <h2>🤖 Kết quả nhận dạng</h2>

      <div class="spinner" id="spinner">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        <p class="status" id="statusText">Đang xử lý...</p>
      </div>

      <div id="resultArea" style="display:none">
        <div class="result-box">
          <div class="result-row">
            <span class="result-label">Giá trị đọc được</span>
            <span class="result-value big" id="resValue">—</span>
          </div>
          <div class="result-row">
            <span class="result-label">Pipeline</span>
            <span id="resPipeline"></span>
          </div>
          <div class="result-row">
            <span class="result-label">Confidence</span>
            <span class="result-value" id="resConf">—</span>
          </div>
          <div class="result-row">
            <span class="result-label">Raw text</span>
            <span class="result-value" id="resRaw" style="font-family:monospace">—</span>
          </div>
          <div class="result-row">
            <span class="result-label">Thời gian</span>
            <span class="result-value timer" id="resTime">—</span>
          </div>
        </div>

        <h2 style="margin-top:20px">📊 Chi tiết phát hiện</h2>
        <div id="fragmentList" class="fragments"></div>

        <h2 style="margin-top:20px">🖼️ Ảnh annotated</h2>
        <img id="annotatedImg" class="preview-img" style="display:none">
      </div>

      <div id="emptyState" class="status">
        Upload ảnh để bắt đầu test
      </div>
    </div>
  </div>

</div>
</div>

<script>
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

['dragenter','dragover'].forEach(e => {
  dropZone.addEventListener(e, ev => { ev.preventDefault(); dropZone.classList.add('dragover'); });
});
['dragleave','drop'].forEach(e => {
  dropZone.addEventListener(e, ev => { ev.preventDefault(); dropZone.classList.remove('dragover'); });
});
dropZone.addEventListener('drop', ev => {
  if (ev.dataTransfer.files.length) processFile(ev.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files.length) processFile(fileInput.files[0]);
});

function processFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('previewImg').src = e.target.result;
    document.getElementById('previewImg').style.display = 'block';
  };
  reader.readAsDataURL(file);

  const fd = new FormData();
  fd.append('file', file);
  runOCR(fd);
}

async function runOCR(formData) {
  document.getElementById('spinner').classList.add('active');
  document.getElementById('resultArea').style.display = 'none';
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('statusText').textContent = 'Đang chạy YOLOv11n + PaddleOCR...';

  try {
    const res = await fetch('/api/test-ocr', { method: 'POST', body: formData });
    const data = await res.json();
    showResults(data);
  } catch (e) {
    document.getElementById('statusText').textContent = 'Lỗi: ' + e.message;
  }
  document.getElementById('spinner').classList.remove('active');
}

function showResults(data) {
  document.getElementById('resultArea').style.display = 'block';
  document.getElementById('resValue').textContent = data.value !== null ? data.value + ' kWh' : 'Không đọc được';
  document.getElementById('resConf').textContent = (data.confidence * 100).toFixed(1) + '%';
  document.getElementById('resRaw').textContent = '"' + data.raw_text + '"';
  document.getElementById('resTime').textContent = data.elapsed + 's';

  const pipeline = data.pipeline || 'unknown';
  const isYolo = pipeline.includes('yolo') || pipeline.includes('paddle');
  document.getElementById('resPipeline').innerHTML =
    `<span class="pipeline-badge ${isYolo ? 'pipeline-yolo' : 'pipeline-fallback'}">${pipeline}</span>`;

  const list = document.getElementById('fragmentList');
  list.innerHTML = '';
  (data.all_results || []).forEach((r, i) => {
    const pct = Math.round(r.confidence * 100);
    const color = pct >= 80 ? '#34d399' : pct >= 60 ? '#fbbf24' : '#f87171';
    list.innerHTML += `
      <div class="fragment">
        <div>
          <strong style="font-family:monospace;font-size:16px">"${r.text}"</strong>
          ${r.bbox ? `<span style="font-size:11px;color:#64748b;margin-left:8px">bbox: [${r.bbox}]</span>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:13px">${pct}%</span>
          <div class="conf-bar"><div class="conf-fill" style="width:${pct}%;background:${color}"></div></div>
        </div>
      </div>`;
  });

  if (data.annotated_b64) {
    const img = document.getElementById('annotatedImg');
    img.src = 'data:image/jpeg;base64,' + data.annotated_b64;
    img.style.display = 'block';
  }
}

async function generateSample() {
  const reading = document.getElementById('genReading').value || '12345.6';
  const res = await fetch('/api/generate?reading=' + encodeURIComponent(reading));
  const data = await res.json();
  if (data.image_b64) {
    document.getElementById('previewImg').src = 'data:image/jpeg;base64,' + data.image_b64;
    document.getElementById('previewImg').style.display = 'block';
  }
}

async function generateAndTest() {
  const reading = document.getElementById('genReading').value || '12345.6';
  document.getElementById('spinner').classList.add('active');
  document.getElementById('resultArea').style.display = 'none';
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('statusText').textContent = 'Tạo ảnh + chạy OCR...';

  try {
    const res = await fetch('/api/generate-and-test?reading=' + encodeURIComponent(reading));
    const data = await res.json();
    if (data.image_b64) {
      document.getElementById('previewImg').src = 'data:image/jpeg;base64,' + data.image_b64;
      document.getElementById('previewImg').style.display = 'block';
    }
    showResults(data);
  } catch (e) {
    document.getElementById('statusText').textContent = 'Lỗi: ' + e.message;
  }
  document.getElementById('spinner').classList.remove('active');
}
</script>
</body>
</html>
"""


@app.get("/", response_class=HTMLResponse)
async def index():
    return HTML_PAGE


@app.post("/api/test-ocr")
async def test_ocr(file: UploadFile = File(...)):
    from app.ocr_service import extract_digits

    image_bytes = await file.read()
    image = Image.open(io.BytesIO(image_bytes))

    t0 = time.time()
    result = extract_digits(image)
    elapsed = round(time.time() - t0, 2)

    # Create annotated image
    annotated_b64 = None
    try:
        annotated = image.copy().convert("RGB")
        draw = ImageDraw.Draw(annotated)
        for r in result.get("all_results", []):
            if r.get("bbox"):
                x1, y1, x2, y2 = r["bbox"]
                color = (0, 255, 0) if r["confidence"] >= 0.6 else (255, 165, 0)
                draw.rectangle([x1, y1, x2, y2], outline=color, width=3)
                draw.text((x1, max(0, y1 - 15)),
                          f"{r['text']} ({r['confidence']:.0%})", fill=color)
        buf = io.BytesIO()
        annotated.save(buf, format="JPEG", quality=90)
        annotated_b64 = base64.b64encode(buf.getvalue()).decode()
    except Exception:
        pass

    return {**result, "elapsed": elapsed, "annotated_b64": annotated_b64}


@app.get("/api/generate")
async def generate(reading: str = "15234.6"):
    from test_esp32_ocr import generate_sample_meter

    path = generate_sample_meter(reading=reading, output_path="test_output/sample_meter.jpg")
    with open(path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()
    return {"image_b64": img_b64, "reading": reading}


@app.get("/api/generate-and-test")
async def generate_and_test(reading: str = "15234.6"):
    from test_esp32_ocr import generate_sample_meter
    from app.ocr_service import extract_digits

    path = generate_sample_meter(reading=reading, output_path="test_output/sample_meter.jpg")
    image = Image.open(path)

    with open(path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()

    t0 = time.time()
    result = extract_digits(image)
    elapsed = round(time.time() - t0, 2)

    # Annotated
    annotated_b64 = None
    try:
        annotated = image.copy().convert("RGB")
        draw = ImageDraw.Draw(annotated)
        for r in result.get("all_results", []):
            if r.get("bbox"):
                x1, y1, x2, y2 = r["bbox"]
                color = (0, 255, 0) if r["confidence"] >= 0.6 else (255, 165, 0)
                draw.rectangle([x1, y1, x2, y2], outline=color, width=3)
                draw.text((x1, max(0, y1 - 15)),
                          f"{r['text']} ({r['confidence']:.0%})", fill=color)
        buf = io.BytesIO()
        annotated.save(buf, format="JPEG", quality=90)
        annotated_b64 = base64.b64encode(buf.getvalue()).decode()
    except Exception:
        pass

    return {**result, "elapsed": elapsed, "image_b64": img_b64, "annotated_b64": annotated_b64}


if __name__ == "__main__":
    print("\n" + "=" * 50)
    print("  Smart Meter OCR Test UI")
    print("  http://localhost:8501")
    print("=" * 50 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=8501)
