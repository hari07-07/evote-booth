const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { voter_name, voter_id_number, home_booth, voted_at_booth, officer_name, timestamp } = req.body;

    if (!voter_name || !voter_id_number || !home_booth || !voted_at_booth || !officer_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 1. Save to Supabase
    const { error: dbError } = await supabase.from('voters').insert([{
      voter_name,
      voter_id_number,
      home_booth,
      voted_at_booth,
      officer_name,
      email_sent_to: process.env.RECEIVER_EMAIL,
      timestamp: timestamp || new Date().toISOString()
    }]);

    if (dbError) {
      console.error('Supabase error:', dbError);
      return res.status(500).json({ error: 'Database save failed: ' + dbError.message });
    }

    // 2. Send Email via Resend
    const { error: emailError } = await resend.emails.send({
      from: 'EVote Bridge <onboarding@resend.dev>',
      to: process.env.RECEIVER_EMAIL,
      subject: `⚠️ EVote Alert — ${voter_name} has voted at ${voted_at_booth}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Courier New', monospace; background: #f4f1ea; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border: 3px solid #0a0f1c; padding: 0; }
            .header { background: #0a0f1c; color: white; padding: 24px 32px; }
            .header h1 { margin: 0; font-size: 20px; letter-spacing: -0.02em; }
            .header p { margin: 4px 0 0; color: rgba(255,255,255,0.6); font-size: 12px; }
            .alert-bar { background: #e74c3c; color: white; padding: 12px 32px; font-size: 13px; font-weight: bold; letter-spacing: 0.05em; }
            .body { padding: 32px; }
            .field { margin-bottom: 16px; border-bottom: 1px solid #eee; padding-bottom: 16px; }
            .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7280; margin-bottom: 4px; }
            .value { font-size: 16px; font-weight: bold; color: #0a0f1c; }
            .footer { background: #f4f1ea; padding: 16px 32px; font-size: 11px; color: #6b7280; border-top: 2px solid #0a0f1c; }
            .action-box { background: #fff3cd; border: 2px solid #f0ad4e; padding: 16px; margin: 20px 0; border-radius: 2px; }
            .action-box p { margin: 0; font-size: 14px; font-weight: bold; color: #856404; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⬡ EVote Bridge</h1>
              <p>Cross-Booth Voter Verification System — Module 2</p>
            </div>
            <div class="alert-bar">⚠️ ACTION REQUIRED — VOTER HAS CAST VOTE AT DIFFERENT BOOTH</div>
            <div class="body">
              <div class="action-box">
                <p>🚨 Please mark this voter as VOTED in your records immediately to prevent duplicate voting.</p>
              </div>
              <div class="field">
                <div class="label">Voter Name</div>
                <div class="value">${voter_name}</div>
              </div>
              <div class="field">
                <div class="label">Voter ID Number</div>
                <div class="value">${voter_id_number}</div>
              </div>
              <div class="field">
                <div class="label">Home Booth (Your Booth)</div>
                <div class="value">${home_booth}</div>
              </div>
              <div class="field">
                <div class="label">Voted At Booth</div>
                <div class="value">${voted_at_booth}</div>
              </div>
              <div class="field">
                <div class="label">Verified By Officer</div>
                <div class="value">${officer_name}</div>
              </div>
              <div class="field" style="border:none;">
                <div class="label">Timestamp</div>
                <div class="value">${new Date(timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</div>
              </div>
            </div>
            <div class="footer">
              This is an automated alert from EVote Bridge. Do not reply to this email.<br/>
              Design Thinking Prototype — National Engineering College
            </div>
          </div>
        </body>
        </html>
      `
    });

    if (emailError) {
      console.error('Email error:', emailError);
      return res.status(500).json({ error: 'Email send failed: ' + emailError.message });
    }

    return res.status(200).json({ success: true, message: 'Voter recorded and email sent!' });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};
