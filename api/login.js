// 비밀번호 확인 후 서명된 세션 쿠키를 내려준다. 비밀번호 원문은 쿠키에 담기지 않는다.
const crypto = require('crypto');

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }
  const expected = process.env.SITE_PASSWORD || '';
  const password = (req.body && req.body.password) || '';

  if (!expected || password !== expected) {
    res.status(401).json({ ok: false, error: '비밀번호가 올바르지 않습니다.' });
    return;
  }

  const token = crypto.createHmac('sha256', expected).update('aurakorea-office-session').digest('hex');
  res.setHeader('Set-Cookie', `auk_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
  res.status(200).json({ ok: true });
};
