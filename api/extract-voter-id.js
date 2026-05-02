const { createWorker } = require('tesseract.js');
const sharp = require('sharp');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let worker = null;

  try {
    // Get base64 image from request body
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'No image provided' });

    // Convert base64 to buffer
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Preprocess image with Sharp
    const processed = await sharp(imageBuffer)
      .resize(2000, null, { withoutEnlargement: true })
      .grayscale()
      .normalize()
      .sharpen({ sigma: 1.5 })
      .linear(1.4, -30)
      .threshold(128)
      .png()
      .toBuffer();

    // Run Tesseract OCR
    worker = await createWorker('eng', 1);
    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,/-:\'',
      preserve_interword_spaces: '1',
    });

    const { data } = await worker.recognize(processed);
    const rawText = data.text;

    // Parse the extracted text
    const parsed = parseVoterID(rawText);

    return res.status(200).json({
      success: true,
      raw_text: rawText,
      ocr_confidence: Math.round(data.confidence),
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
  } finally {
    if (worker) await worker.terminate();
  }
};

// ══════════════════════════════
// PARSING LOGIC
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
  if (epicMatch) {
    result.epic_number.value = epicMatch[1];
    result.epic_number.confidence = 95;
  }

  // 2. DOB
  const dobPatterns = [
    /(?:DOB|DATE OF BIRTH|D\.O\.B)[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /\b(\d{2}[\/\-]\d{2}[\/\-]\d{4})\b/,
    /\b(\d{4}[\/\-]\d{2}[\/\-]\d{2})\b/,
  ];
  for (const p of dobPatterns) {
    const m = rawText.match(p);
    if (m) { result.dob.value = m[1].trim(); result.dob.confidence = 90; break; }
  }

  // 3. Gender
  if (/\bFEMALE\b/i.test(rawText)) {
    result.gender.value = 'Female'; result.gender.confidence = 92;
  } else if (/\bMALE\b/i.test(rawText)) {
    result.gender.value = 'Male'; result.gender.confidence = 92;
  } else if (/\bOTHER\b/i.test(rawText)) {
    result.gender.value = 'Other'; result.gender.confidence = 85;
  }

  // 4. Voter Name
  const namePatterns = [
    /(?:ELECTOR['']?S?\s+NAME|NAME OF ELECTOR)[:\s]+([A-Z][A-Z\s\.]{2,40})/i,
    /(?:^|\n)\s*NAME[:\s]+([A-Z][A-Z\s\.]{2,40})/im,
  ];
  for (const p of namePatterns) {
    const m = rawText.match(p);
    if (m) {
      const cleaned = toTitleCase(m[1]);
      if (cleaned.length > 2) { result.name.value = cleaned; result.name.confidence = 88; break; }
    }
  }

  // Fallback: ALL CAPS line
  if (!result.name.value) {
    const caps = lines.filter(l =>
      /^[A-Z][A-Z\s\.]{3,35}$/.test(l) &&
      !/(INDIA|ELECTION|COMMISSION|VOTER|IDENTITY|CARD|GOVERNMENT|REPUBLIC|PHOTO)/.test(l) &&
      l.split(/\s+/).length >= 2
    );
    if (caps.length) { result.name.value = toTitleCase(caps[0]); result.name.confidence = 65; }
  }

  // 5. Father/Mother Name
  const fatherPatterns = [
    /(?:FATHER['']?S?\s+NAME|S\/O|SON OF)[:\s]+([A-Z][A-Z\s\.]{2,40})/i,
    /(?:MOTHER['']?S?\s+NAME|D\/O|DAUGHTER OF)[:\s]+([A-Z][A-Z\s\.]{2,40})/i,
    /(?:W\/O|WIFE OF|H\/O)[:\s]+([A-Z][A-Z\s\.]{2,40})/i,
  ];
  for (const p of fatherPatterns) {
    const m = rawText.match(p);
    if (m) {
      const cleaned = toTitleCase(m[1]);
      if (cleaned.length > 2) { result.father_name.value = cleaned; result.father_name.confidence = 85; break; }
    }
  }

  // 6. Address
  const addrMatch = rawText.match(/(?:ADDRESS|ADDR|RESIDENCE)[:\s\n]+([A-Za-z0-9\s,\.\-\/]+(?:\n[A-Za-z0-9\s,\.\-\/]+){0,3})/i);
  if (addrMatch) {
    result.address.value = addrMatch[1].replace(/\n/g, ', ').replace(/\s+/g, ' ').trim();
    result.address.confidence = 72;
  }

  return result;
}

function toTitleCase(str) {
  return str
    .replace(/[^A-Za-z\s\.]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
