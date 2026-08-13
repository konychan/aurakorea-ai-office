// 브라우저가 보낸 세션 쿠키가 유효한지 확인만 한다 (파일을 읽거나 내려주지 않는다).
const crypto = require('crypto');

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

module.exports = (req, res) => {
  const expected = process.env.SITE_PASSWORD || '';
  if (!expected) {
    res.status(200).json({ ok: false, error: 'SITE_PASSWORD가 설정되어 있지 않습니다.' });
    return;
  }
  const cookies = parseCookies(req.headers.cookie);
  const validToken = crypto.createHmac('sha256', expected).update('aurakorea-office-session').digest('hex');
  res.status(200).json({ ok: cookies.auk_session === validToken });
};
