const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { executeCode } = require('./executor');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ──────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));

// ─── Rate Limiter (5 runs per minute per IP) ────────────────
const executeLimiter = rateLimit({
  windowMs: 60 * 1000,    
  max: 5,                     
  standardHeaders: true,      
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: {
    output: '',
    error: 'Rate limit exceeded. Maximum 5 executions per minute. Please wait and try again.',
    executionTime: 0,
  },
});

// ─── Supported Languages ────────────────────────────────────
const SUPPORTED_LANGUAGES = ['c', 'python', 'java'];

// ─── POST /execute ──────────────────────────────────────────
app.post('/execute', executeLimiter, async (req, res) => {
  const { language, code, input } = req.body;

  // --- Validation ---
  // 1. Check required fields exist
  if (!language || !code) {
    return res.status(400).json({
      output: '',
      error: 'Missing required fields: "language" and "code" are required.',
      executionTime: 0,
    });
  }

  // 2. Check language is supported
  const lang = language.toLowerCase().trim();
  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    return res.status(400).json({
      output: '',
      error: `Unsupported language: "${language}". Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}.`,
      executionTime: 0,
    });
  }

  // 3. Check code is not empty / whitespace only
  if (typeof code !== 'string' || code.trim().length === 0) {
    return res.status(400).json({
      output: '',
      error: 'Code cannot be empty.',
      executionTime: 0,
    });
  }

  // 4. Code length limit (50KB)
  if (code.length > 50000) {
    return res.status(400).json({
      output: '',
      error: 'Code exceeds maximum length of 50,000 characters.',
      executionTime: 0,
    });
  }

  // --- Execute ---
  try {
    const startTime = Date.now();
    const result = await executeCode(lang, code, input || '');
    const executionTime = Date.now() - startTime;

    return res.status(200).json({
      output: result.output || '',
      error: result.error || '',
      executionTime,
    });
  } catch (err) {
    console.error('[Execute Error]', err.message);
    return res.status(500).json({
      output: '',
      error: `Internal server error: ${err.message}`,
      executionTime: 0,
    });
  }
});

// ─── Health Check ───────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Start Server ───────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  ⚡ SCA API running on http://localhost:${PORT}`);
  console.log(`  📋 POST /execute  — Run code`);
  console.log(`  💚 GET  /health   — Health check\n`);
});
