import 'dotenv/config';

export const isLuhnValid = (value) => {
  if (!value || typeof value !== 'string') return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = value.length - 1; i >= 0; i--) {
    let digit = parseInt(value.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return (sum % 10) === 0;
};

export const validateApiKey = (req) => {
  const apiKey = req.headers['x-api-key'] || req.query?.['x-api-key'];
  let rawKeys = process.env.API_KEYS || '';
  
  // Clean up any accidental literal quotes if they were pasted into Vercel
  rawKeys = rawKeys.replace(/['"]+/g, '');
  
  const validKeys = rawKeys.split(',').map(k => k.trim()).filter(k => k.length > 0);

  if (!apiKey || !validKeys.includes(apiKey.trim())) {
    return false;
  }
  return true;
};

export const MOCK_BUSINESSES = {
  "100234567890003": "RenderKit API Solutions LLC",
  "100987654321006": "Global Tech Corp",
  "100555444333224": "Al-Futtaim Group",
  "100111222333442": "Emirates Group"
};

export function validateZuploSecret(req, res) {
  const secret = req.headers['x-zuplo-secret'];
  let validSecret = (process.env.SECRET_ZUPLO || '').trim().replace(/['"]+/g, '');
  
  if (!secret) {
    res.status(401).json({
      status: 'error',
      code: 'DIRECT_ACCESS_FORBIDDEN',
      message: 'Access via api.renderkit.com only (Secret Missing).'
    });
    return false;
  }
  if (secret.trim() !== validSecret) {
    const receivedHint = `${secret.slice(0, 2)}...${secret.slice(-2)}`;
    const expectedHint = `${validSecret.slice(0, 2)}...${validSecret.slice(-2)}`;
    res.status(401).json({
      status: 'error',
      code: 'DIRECT_ACCESS_FORBIDDEN',
      message: `Access via api.renderkit.com only (Mismatch: Got ${receivedHint}, Expected ${expectedHint}).`
    });
    return false;
  }
  return true;
}

export function validateRequest(req, res) {
  const zuploSecret = req.headers['x-zuplo-secret'];
  const freeTier = req.headers['x-free-tier'];
  let validSecret = (process.env.SECRET_ZUPLO || '').trim().replace(/['"]+/g, '');

  if (zuploSecret && zuploSecret.trim() === validSecret) {
    req.tier = 'paid';
    return true;
  }

  if (freeTier === 'true') {
    req.tier = 'free';
    return true;
  }

  res.status(401).json({
    status: 'error',
    code: 'AUTH_REQUIRED',
    message: 'Include x-api-key via api.renderkit.com or pass x-free-tier:true for free tier (100 calls/month)'
  });
  return false;
}

export function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-api-key,x-zuplo-secret');
}
