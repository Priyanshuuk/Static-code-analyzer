const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { executeCode, parseCode } = require('./executor');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ──────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));

// ─── Rate Limiter ───────────────────────────────────────────
const executeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: {
    output: '',
    error: 'Rate limit exceeded. Maximum 30 executions per minute.',
    executionTime: 0,
  },
});

const SUPPORTED_LANGUAGES = ['c', 'cpp', 'python', 'java', 'javascript', 'typescript', 'go', 'rust'];

// ─── Validation middleware ──────────────────────────────────
function validateCodeRequest(req, res, next) {
  const { language, code } = req.body;
  if (!language || !code) {
    return res.status(400).json({ output: '', error: 'Missing "language" and "code".', executionTime: 0 });
  }
  const lang = language.toLowerCase().trim();
  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    return res.status(400).json({ output: '', error: `Unsupported language: "${language}". Supported: ${SUPPORTED_LANGUAGES.join(', ')}.`, executionTime: 0 });
  }
  if (typeof code !== 'string' || code.trim().length === 0) {
    return res.status(400).json({ output: '', error: 'Code cannot be empty.', executionTime: 0 });
  }
  if (code.length > 50000) {
    return res.status(400).json({ output: '', error: 'Code exceeds 50,000 character limit.', executionTime: 0 });
  }
  req.body.language = lang;
  next();
}

// ─── POST /execute ──────────────────────────────────────────
app.post('/execute', executeLimiter, validateCodeRequest, async (req, res) => {
  const { language, code, input } = req.body;
  try {
    const startTime = Date.now();
    const result = await executeCode(language, code, input || '');
    const executionTime = Date.now() - startTime;
    return res.status(200).json({
      output: result.output || '',
      error: result.error || '',
      executionTime,
    });
  } catch (err) {
    console.error('[Execute Error]', err.message);
    return res.status(500).json({ output: '', error: `Internal error: ${err.message}`, executionTime: 0 });
  }
});

// ─── POST /parse ──
app.post('/parse', executeLimiter, validateCodeRequest, async (req, res) => {
  const { language, code } = req.body;
  try {
    const startTime = Date.now();
    const result = await parseCode(language, code);
    const parseTime = Date.now() - startTime;
    return res.status(200).json({ ...result, parseTime });
  } catch (err) {
    console.error('[Parse Error]', err.message);
    return res.status(500).json({ success: false, errors: [err.message], warnings: [], message: 'Internal error', parseTime: 0 });
  }
});

// ─── Health Check ──
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), supportedLanguages: SUPPORTED_LANGUAGES });
});

// ─── Start ──
app.listen(PORT, () => {
  console.log(`\n  ⚡ SCA API running on http://localhost:${PORT}`);
  console.log(`  📋 POST /execute  — Run code`);
  console.log(`  🔍 POST /parse    — Syntax check`);
  console.log(`  💚 GET  /health   — Health check`);
  console.log(`  🌐 Languages: ${SUPPORTED_LANGUAGES.join(', ')}\n`);
});
