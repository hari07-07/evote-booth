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

  const { voter_name, voter_id_number, home_booth, voted_at_booth, officer_name } = req.body;

  if (!voter_name || !voter_id_number || !home_booth || !voted_at_booth || !officer_name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const readable = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });

  try {
    // 1. Save to Supabase (no voted_at — uses created_at automatically)
    const { error: dbErr } = await supabase.from('voters').insert([{
      voter_name,
      voter_id_number,
      home_booth,
      voted_at_booth,
      officer_name,
      email_sent_to: process.env.RECEIVER_EMAIL
    }]);

    if (dbErr) {
      console.error('DB error:', dbErr);
      return res.status(500).json({ error: 'Database error: ' + dbErr.message });
    }

    // 2. Send Gmail
    await transporter.sendMail({
      from: `"EVote Bridge" <${process.env.GMAIL_USER}>`,
      to: process.env.RECEIVER_EMAIL,
      subject: `⚠️ EVote Alert — ${voter_name} voted at ${voted_at_booth}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9">
          <div style="background:#07090f;color:white;padding:24px 32px">
            <h2 style="margin:0;font-size:20px">▲ EVote Bridge</h2>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.5);font-size:12px">Cross-Booth Voter Verification — Module 2</p>
          </div>
          <div style="background:#dc2626;color:white;padding:12px 32px;font-weight:bold;font-size:13px">
            ⚠️ ACTION REQUIRED — Mark this voter as VOTED immediately
          </div>
          <div style="padding:32px;background:white">
            <table style="width:100%;border-collapse:collapse">
              <tr style="border-bottom:1px solid #eee">
                <td style="padding:12px 0;color:#666;font-size:12px;text-transform:uppercase;width:40%">Voter Name</td>
                <td style="padding:12px 0;font-weight:bold;font-size:16px">${voter_name}</td>
              </tr>
              <tr style="border-bottom:1px solid #eee">
                <td style="padding:12px 0;color:#666;font-size:12px;text-transform:uppercase">Voter ID</td>
                <td style="padding:12px 0;font-weight:bold;font-size:16px">${voter_id_number}</td>
              </tr>
              <tr style="border-bottom:1px solid #eee">
                <td style="padding:12px 0;color:#666;font-size:12px;text-transform:uppercase">Home Booth</td>
                <td style="padding:12px 0;font-weight:bold;font-size:16px">${home_booth}</td>
              </tr>
              <tr style="border-bottom:1px solid #eee">
                <td style="padding:12px 0;color:#666;font-size:12px;text-transform:uppercase">Voted At Booth</td>
                <td style="padding:12px 0;font-weight:bold;font-size:16px">${voted_at_booth}</td>
              </tr>
              <tr style="border-bottom:1px solid #eee">
                <td style="padding:12px 0;color:#666;font-size:12px;text-transform:uppercase">Verified By</td>
                <td style="padding:12px 0;font-weight:bold;font-size:16px">${officer_name}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;color:#666;font-size:12px;text-transform:uppercase">Time</td>
                <td style="padding:12px 0;font-weight:bold;font-size:16px">${readable} IST</td>
              </tr>
            </table>
            <div style="background:#fef3c7;border:1px solid #f59e0b;padding:16px;margin-top:20px;border-radius:4px">
              <strong>🚨 This voter has already voted at ${voted_at_booth}. Do NOT allow voting again at your booth.</strong>
            </div>
          </div>
          <div style="background:#f0f0f0;padding:16px 32px;font-size:11px;color:#999;border-top:1px solid #ddd">
            Automated alert · EVote Bridge · Design Thinking Prototype · National Engineering College
          </div>
        </div>
      `
    });

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Notify error:', err);
    return res.status(500).json({ error: err.message });
  }
};