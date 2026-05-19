-- Migration: Add OCR metadata columns to readings table
-- Run this in Supabase SQL Editor AFTER 003_device_monitoring.sql

-- Add annotated image URL and OCR metadata columns
ALTER TABLE readings
  ADD COLUMN IF NOT EXISTS annotated_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ocr_raw_text text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ocr_pipeline text DEFAULT NULL;

-- Documentation
COMMENT ON COLUMN readings.annotated_url IS 'URL of annotated image with YOLO bounding boxes and OCR text overlay';
COMMENT ON COLUMN readings.ocr_raw_text IS 'Raw OCR text before decimal parsing';
COMMENT ON COLUMN readings.ocr_pipeline IS 'OCR pipeline used (yolo11n+paddleocr or paddleocr-fullimage)';
