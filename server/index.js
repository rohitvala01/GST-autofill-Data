import express from 'express';
import cors from 'cors';
import multer from 'multer';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { autoFillGstLogin, launchBrowserWithDashboard } from './automation.js';

const app = express();
const PORT = process.env.PORT || 5001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fixed Excel File Path in workspace root
const FIXED_EXCEL_PATH = path.join(__dirname, '../data.xlsx');

app.use(cors());
app.use(express.json());

// Configure Multer for file uploads (stored in memory)
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Helper to parse Excel buffer and return clean GST Holder objects
 */
function parseExcelData(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Convert sheet to JSON rows
  const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  // Map flexible column headers (Name, GSTIN, Username, Password)
  const parsedHolders = rawData.map((row, index) => {
    const keys = Object.keys(row);

    const nameKey = keys.find(k => /name|firm|holder|client|company/i.test(k)) || keys[0] || `Client ${index + 1}`;
    const gstinKey = keys.find(k => /gstin|gst|trade/i.test(k));
    const usernameKey = keys.find(k => /user|username|id|login/i.test(k)) || keys[1];
    const passwordKey = keys.find(k => /pass|password|pwd/i.test(k)) || keys[2];

    return {
      id: index + 1,
      name: String(row[nameKey] || `GST Holder ${index + 1}`).trim(),
      gstin: gstinKey ? String(row[gstinKey]).trim() : '',
      username: usernameKey ? String(row[usernameKey]).trim() : '',
      password: passwordKey ? String(row[passwordKey]).trim() : ''
    };
  }).filter(item => item.username || item.name);

  return parsedHolders;
}

// 1. GET Fixed Excel Holders API
app.get('/api/holders', (req, res) => {
  try {
    if (!fs.existsSync(FIXED_EXCEL_PATH)) {
      return res.status(404).json({ 
        error: `Excel file not found at ${FIXED_EXCEL_PATH}. Please create data.xlsx.` 
      });
    }

    const fileBuffer = fs.readFileSync(FIXED_EXCEL_PATH);
    const holders = parseExcelData(fileBuffer);
    return res.json({
      success: true,
      count: holders.length,
      excelPath: FIXED_EXCEL_PATH,
      holders
    });
  } catch (err) {
    console.error('Error reading fixed Excel file:', err);
    return res.status(500).json({ error: 'Failed to read data.xlsx: ' + err.message });
  }
});

// 2. Upload Excel File API (Optional override)
app.post('/api/upload-excel', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No Excel file uploaded' });
    }

    const holders = parseExcelData(req.file.buffer);
    return res.json({
      success: true,
      count: holders.length,
      holders
    });
  } catch (err) {
    console.error('Error parsing uploaded file:', err);
    return res.status(500).json({ error: 'Failed to read Excel file: ' + err.message });
  }
});

// 3. Trigger Playwright GST Autofill API
app.post('/api/autofill-login', async (req, res) => {
  const { username, password, gstin, name } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      error: 'Missing required credentials: username and password must be provided.'
    });
  }

  try {
    console.log(`[API] Received request to auto-fill GST login for: ${name || username}`);
    const result = await autoFillGstLogin({ username, password, gstin });

    return res.json(result);
  } catch (error) {
    console.error('[API Error]', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to trigger Playwright automation'
    });
  }
});

// Launch Browser with Dashboard endpoint
app.post('/api/launch-browser', async (req, res) => {
  try {
    const clientUrl = req.body.url || 'http://localhost:5174';
    const result = await launchBrowserWithDashboard(clientUrl);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 GST Autofill Server running on http://localhost:${PORT}`);
  console.log(`📁 Reading fixed Excel from: ${FIXED_EXCEL_PATH}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use!`);
    console.error(`💡 Tip: If a previous server instance is running, kill it or run with PORT=5002 npm run dev\n`);
  } else {
    console.error('Server error:', err);
  }
});
