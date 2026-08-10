// Vercel serverless function -- plain email relay, no Claude/Anthropic API involved.
// Requires two environment variables set in the Vercel project settings:
//   RESEND_API_KEY  -- from https://resend.com (free tier: 3,000 emails/mo, 100/day)
//   DAD_EMAIL       -- Pascual's real email address (kept server-side, never sent to the browser)

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    var body = req.body || {};
    var message = body.message;
    var from = body.from;
    var lang = body.lang;

    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'Empty message' });
      return;
    }
    if (!process.env.RESEND_API_KEY || !process.env.DAD_EMAIL) {
      console.error('Missing RESEND_API_KEY or DAD_EMAIL environment variable');
      res.status(500).json({ error: 'Server not configured' });
      return;
    }

    // Basic hygiene: cap length, strip control characters
    var cleanMessage = String(message).slice(0, 500).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    var senderName = (from ? String(from) : 'Sofia').slice(0, 40);
    var isSpanish = lang === 'es';
    var subject = isSpanish
      ? ('Mensaje de ' + senderName + ' (Math Quest)')
      : ('Message from ' + senderName + ' (Math Quest)');

    var resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Math Quest <onboarding@resend.dev>',
        to: [process.env.DAD_EMAIL],
        subject: subject,
        text: cleanMessage
      })
    });

    if (!resendResp.ok) {
      var errText = await resendResp.text();
      console.error('Resend API error:', resendResp.status, errText);
      // TEMP DEBUG: surfacing Resend's real error in the response while we diagnose.
      // Once this is working, tell Claude to remove the detail field below.
      res.status(502).json({ error: 'Failed to send', detail: errText, resendStatus: resendResp.status });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send-dad-message error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
