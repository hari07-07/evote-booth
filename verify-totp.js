const { authenticator } = require('otplib');
const QRCode = require('qrcode');

// Fixed secret for the officer account (in production, store per user in DB)
const TOTP_SECRET = process.env.TOTP_SECRET || 'EVOTEBRIDGESECRET2024';
const APP_NAME = 'EVote Bridge';
const OFFICER_ACCOUNT = 'admin@evotebridge';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Generate the OTP Auth URL (this is what Authenticator apps scan)
    const otpAuthUrl = authenticator.keyuri(
      OFFICER_ACCOUNT,
      APP_NAME,
      TOTP_SECRET
    );

    // Convert URL to QR code image (base64 PNG)
    const qrCodeDataURL = await QRCode.toDataURL(otpAuthUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#0a0f1c',
        light: '#f4f1ea'
      }
    });

    return res.status(200).json({
      success: true,
      qrCode: qrCodeDataURL,
      secret: TOTP_SECRET, // Show secret as backup for manual entry
      otpAuthUrl
    });

  } catch (err) {
    console.error('QR generation error:', err);
    return res.status(500).json({ error: 'Failed to generate QR code: ' + err.message });
  }
};
