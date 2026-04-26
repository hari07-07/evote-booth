const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { voter_name, voter_id_number, home_booth, voted_at_booth, officer_name, timestamp } = req.body;

  if (!voter_name || !voter_id_number || !home_booth || !voted_at_booth || !officer_name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const ts = timestamp || new Date().toISOString();
  const readableTime = new Date(ts).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });

  try {
    // 1. Save to Supabase
    const { error: dbError } = await supabase.from('voters').insert([{
      voter_name,
      voter_id_number,
      home_booth,
      voted_at_booth,
      officer_name,
      email_sent_to: process.env.RECEIVER_EMAIL,
      timestamp: ts
    }]);

    if (dbError) {
      console.error('Supabase error:', dbError);
      return res.status(500).json({ error: 'Database error: ' + dbError.message });
    }

    // 2. Send Gmail
    await transporter.sendMail({
      from: `"EVote Bridge" <${process.env.GMAIL_USER}>`,
      to: process.env.RECEIVER_EMAIL,
      subject: `⚠️ EVote Alert — ${voter_name} voted at ${voted_at_booth}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;border:1px solid #ddd;">
          <div style="background:#0a0f1c;color:white;padding:24px 32px;">
            <h2 style="margin:0;font-size:20px;">⬡ EVote Bridge</h2>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.6);font-size:12px;">Cross-Booth Voter Verification — Module 2</p>
          </div>
          <div style="background:#c0392b;color:white;padding:12px 32px;font-weight:bold;font-size:13px;">
            ⚠️ ACTION REQUIRED — Mark this voter as VOTED immediately
          </div>
          <div style="padding:32px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr style="border-bottom:1px solid #eee;">
                <td style="padding:12px 0;color:#666;font-size:12px;text-transform:uppercase;width:40%">Voter Name</td>
                <td style="padding:12px 0;font-weight:bold;font-size:16px;">${voter_name}</td>
              </tr>
              <tr style="border-bottom:1px solid #eee;">
                <td style="padding:12px 0;color:#666;font-size:12px;text-transform:uppercase;">Voter ID</td>
                <td style="padding:12px 0;font-weight:bold;font-size:16px;">${voter_id_number}</td>
              </tr>
              <tr style="border-bottom:1px solid #eee;">
                <td style="padding:12px 0;color:#666;font-size:12px;text-transform:uppercase;">Home Booth</td>
                <td style="padding:12px 0;font-weight:bold;font-size:16px;">${home_booth}</td>
              </tr>
              <tr style="border-bottom:1px solid #eee;">
                <td style="padding:12px 0;color:#666;font-size:12px;text-transform:uppercase;">Voted At Booth</td>
                <td style="padding:12px 0;font-weight:bold;font-size:16px;">${voted_at_booth}</td>
              </tr>
              <tr style="border-bottom:1px solid #eee;">
                <td style="padding:12px 0;color:#666;font-size:12px;text-transform:uppercase;">Verified By</td>
                <td style="padding:12px 0;font-weight:bold;font-size:16px;">${officer_name}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;color:#666;font-size:12px;text-transform:uppercase;">Time</td>
                <td style="padding:12px 0;font-weight:bold;font-size:16px;">${readableTime} IST</td>
              </tr>
            </table>
            <div style="background:#fff3cd;border:1px solid #f0ad4e;padding:16px;margin-top:20px;border-radius:4px;">
              <strong>🚨 Duplicate voting prevention:</strong> This voter has already cast their vote at ${voted_at_booth}. Do NOT allow them to vote again at your booth.
            </div>
          </div>
          <div style="background:#f0f0f0;padding:16px 32px;font-size:11px;color:#999;border-top:1px solid #ddd;">
            Automated alert from EVote Bridge · Design Thinking Prototype · National Engineering College
          </div>
        </div>
      `
    });

    return res.status(200).json({ success: true, message: 'Saved and email sent!' });

  } catch (err) {
    console.error('Notify error:', err);
    return res.status(500).json({ error: err.message });
  }
};
