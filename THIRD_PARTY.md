# OCR dependencies

- Tesseract.js 7.0.0: https://github.com/naptha/tesseract.js — Apache-2.0. Bundled notices: `public/ocr/tesseract.min.js.LICENSE.txt`.
- Tesseract.js-core: https://github.com/naptha/tesseract.js-core — Apache-2.0 and bundled notices. See `public/ocr/core/LICENSE`.
- Japanese / English trained data: https://tessdata.projectnaptha.com/4.0.0/ (jpn.traineddata.gz, eng.traineddata.gz), Tesseract OCR traineddata — Apache-2.0, https://github.com/tesseract-ocr/tessdata.

- Current OCR model: `public/ocr/japanese-v2/Japanese.traineddata.gz` from https://github.com/tesseract-ocr/tessdata_best/blob/main/script/Japanese.traineddata (Apache-2.0). Converted to an integer LSTM model using `combine_tessdata -c` (Tesseract 5.5.0), then compressed with `gzip -n`, to support Tesseract.js 7's WASM runtime. SHA-256 of the bundled gzip: `c73456285cc32d557b0e7e6c6fa740ca80c43b5fa481fc157ec57eb04c874763`.
- The original Japanese/English models remain bundled for compatibility with previously opened tabs; new scans use the versioned Japanese model and a separate IndexedDB model cache.
