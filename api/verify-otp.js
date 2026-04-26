const twilio = require('twilio');

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { code } = req.body;

  if (!code || code.length !== 6) {
    return res.status(400).json({ valid: false, error: 'Invalid code format' });
  }

  try {
    const check = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SID)
      .verificationChecks.create({
        to: process.env.OFFICER_PHONE,
        code: String(code)
      });

    return res.status(200).json({ valid: check.status === 'approved' });
  } catch (err) {
    console.error('Twilio verify error:', err);
    return res.status(500).json({ valid: false, error: err.message });
  }
};
