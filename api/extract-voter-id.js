const https = require('https');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'No image provided' });

    const ocrResult = await callOCRSpace(image);

    if (!ocrResult.success) {
      return res.status(500).json({ error: ocrResult.error });
    }

    const rawText = ocrResult.text;
    const parsed = parseVoterID(rawText);

    return res.status(200).json({
      success: true,
      raw_text: rawText,
      ocr_confidence: ocrResult.confidence,
      data: {
        name: parsed.name.value,
        father_name: parsed.father_name.value,
        dob: parsed.dob.value,
        gender: parsed.gender.value,
        epic_number: parsed.epic_number.value,
        address: parsed.address.value,
      },
      confidence: {
        name: parsed.name.confidence,
        father_name: parsed.father_name.confidence,
        dob: parsed.dob.confidence,
        gender: parsed.gender.confidence,
        epic_number: parsed.epic_number.confidence,
        address: parsed.address.confidence,
      }
    });

  } catch (err) {
    console.error('OCR error:', err);
    return res.status(500).json({ error: err.message });
  }
};

// ══════════════════════════════
// OCR.SPACE API
// ══════════════════════════════
function callOCRSpace(base64Image) {
  return new Promise((resolve) => {
    const apiKey = '3ef639928088957';
    const imageData = base64Image.startsWith('data:') ? base64Image : `data:image/jpeg;base64,${base64Image}`;
    const boundary = '----Boundary' + Date.now();

    const fields = [
      ['apikey', apiKey],
      ['base64Image', imageData],
      ['language', 'eng'],
      ['isOverlayRequired', 'false'],
      ['detectOrientation', 'true'],
      ['scale', 'true'],
      ['OCREngine', '2'],
    ];

    let body = '';
    fields.forEach(([name, value]) => {
      body += `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
    });
    body += `--${boundary}--\r\n`;

    const bodyBuf = Buffer.from(body, 'utf-8');

    const req = https.request({
      hostname: 'api.ocr.space',
      path: '/parse/image',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuf.length,
      },
      timeout: 20000
    }, (response) => {
      let data = '';
      response.on('data', c => data += c);
      response.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.IsErroredOnProcessing) {
            resolve({ success: false, error: json.ErrorMessage?.[0] || 'OCR failed' });
            return;
          }
          const result = json.ParsedResults?.[0];
          resolve({
            success: true,
            text: result?.ParsedText || '',
            confidence: 85
          });
        } catch (e) {
          resolve({ success: false, error: 'Invalid OCR response' });
        }
      });
    });

    req.on('error', e => resolve({ success: false, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'OCR timed out. Try again.' }); });
    req.write(bodyBuf);
    req.end();
  });
}

// ══════════════════════════════
// PARSE VOTER ID TEXT
// ══════════════════════════════
function parseVoterID(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  const result = {
    name: { value: '', confidence: 0 },
    father_name: { value: '', confidence: 0 },
    dob: { value: '', confidence: 0 },
    gender: { value: '', confidence: 0 },
    epic_number: { value: '', confidence: 0 },
    address: { value: '', confidence: 0 }
  };

  // 1. EPIC Number
  const epicMatch = rawText.toUpperCase().match(/\b([A-Z]{3}[0-9]{7})\b/);
  if (epicMatch) { result.epic_number.value = epicMatch[1]; result.epic_number.confidence = 95; }

  // 2. DOB
  const dobPatterns = [
    /(?:DOB|DATE OF BIRTH|D\.O\.B|BIRTH DATE)[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /\b(\d{2}[\/\-]\d{2}[\/\-]\d{4})\b/,
    /\b(\d{1,2}\s+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+\d{4})\b/i,
  ];
  for (const p of dobPatterns) {
    const m = rawText.match(p);
    if (m) { result.dob.value = m[1].trim(); result.dob.confidence = 90; break; }
  }

  // 3. Gender
  if (/\bFEMALE\b/i.test(rawText)) { result.gender.value = 'Female'; result.gender.confidence = 92; }
  else if (/\bMALE\b/i.test(rawText)) { result.gender.value = 'Male'; result.gender.confidence = 92; }
  else if (/\b(OTHER|TRANSGENDER)\b/i.test(rawText)) { result.gender.value = 'Other'; result.gender.confidence = 85; }

  // 4. Name
  const namePatterns = [
    /(?:ELECTOR'?S?\s*NAME|NAME\s+OF\s+ELECTOR)[:\s]+([A-Z][A-Z\s\.]{2,40})/i,
    /(?:^|\n)\s*NAME[:\s]+([A-Z][A-Z\s\.]{2,40})/im,
    /(?:VOTER'?S?\s*NAME)[:\s]+([A-Z][A-Z\s\.]{2,40})/i,
  ];
  for (const p of namePatterns) {
    const m = rawText.match(p);
    if (m) {
      const c = toTitleCase(m[1]);
      if (c.length > 2) { result.name.value = c; result.name.confidence = 88; break; }
    }
  }

  // Fallback name: ALL CAPS line
  if (!result.name.value) {
    const skip = /(INDIA|ELECTION|COMMISSION|VOTER|IDENTITY|CARD|GOVERNMENT|REPUBLIC|PHOTO|ELECTORAL)/;
    const caps = lines.filter(l => /^[A-Z][A-Z\s\.]{3,35}$/.test(l) && !skip.test(l) && l.split(/\s+/).length >= 2);
    if (caps.length) { result.name.value = toTitleCase(caps[0]); result.name.confidence = 65; }
  }

  // 5. Father/Mother
  const fatherPatterns = [
    /(?:FATHER'?S?\s*NAME|S\/O|SON\s+OF)[:\s]+([A-Z][A-Z\s\.]{2,40})/i,
    /(?:MOTHER'?S?\s*NAME|D\/O|DAUGHTER\s+OF)[:\s]+([A-Z][A-Z\s\.]{2,40})/i,
    /(?:W\/O|WIFE\s+OF|H\/O)[:\s]+([A-Z][A-Z\s\.]{2,40})/i,
  ];
  for (const p of fatherPatterns) {
    const m = rawText.match(p);
    if (m) {
      const c = toTitleCase(m[1]);
      if (c.length > 2) { result.father_name.value = c; result.father_name.confidence = 85; break; }
    }
  }

  // 6. Address
  const addrMatch = rawText.match(/(?:ADDRESS|ADDR|RESIDENCE|ADD)[:\s\n]+([A-Za-z0-9\s,\.\-\/]+(?:\n[A-Za-z0-9\s,\.\-\/]+){0,3})/i);
  if (addrMatch) {
    result.address.value = addrMatch[1].replace(/\n/g, ', ').replace(/\s+/g, ' ').trim();
    result.address.confidence = 72;
  }

  return result;
}

function toTitleCase(str) {
  return str.replace(/[^A-Za-z\s\.]/g, '').replace(/\s+/g, ' ').trim()
    .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}
