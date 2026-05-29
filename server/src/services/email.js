const nodemailer = require('nodemailer');

let _transporter = null;
const getTransporter = () => {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      auth: {
        user: process.env.BREVO_SMTP_LOGIN,
        pass: process.env.BREVO_SMTP_PASSWORD,
      },
    });
  }
  return _transporter;
};

const FROM = `MenuQR <${process.env.BREVO_SENDER_EMAIL}>`;

const getBaseUrl = () => {
  const urls = (process.env.CLIENT_URL || 'http://localhost:5173').split(',');
  const prod = urls.find((u) => u.trim().startsWith('https'));
  return (prod || urls[0]).trim();
};

const base = (content) => `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;background:#FAF5EC;padding:40px 20px;margin:0">
  <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #E8DDD0;border-radius:8px;padding:40px">
    <div style="margin-bottom:24px">
      <span style="font-family:Georgia,serif;font-size:28px;font-style:italic;color:#C8462E">Menu</span><span style="font-family:Georgia,serif;font-size:28px;color:#1F1812">QR</span>
    </div>
    ${content}
    <p style="margin-top:32px;font-size:12px;color:#8B7D6B">Se você não criou uma conta no MenuQR, ignore este email.</p>
  </div>
</body></html>`;

const sendVerificationEmail = async (email, name, token) => {
  const url = `${getBaseUrl()}/verify-email?token=${token}`;
  await getTransporter().sendMail({
    from: FROM,
    to: email,
    subject: 'Confirme seu email — MenuQR',
    html: base(`
      <h2 style="margin:0 0 8px;color:#1F1812;font-size:20px">Olá, ${name}!</h2>
      <p style="color:#3D3530;line-height:1.6">Clique no botão abaixo para confirmar seu email e ativar sua conta.</p>
      <a href="${url}" style="display:inline-block;margin:24px 0;padding:12px 28px;background:#C8462E;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Confirmar email</a>
      <p style="color:#8B7D6B;font-size:13px">O link expira em 24 horas.<br>Se o botão não funcionar: <a href="${url}" style="color:#C8462E;word-break:break-all">${url}</a></p>
    `),
  });
};

const sendPasswordResetEmail = async (email, name, token) => {
  const url = `${getBaseUrl()}/reset-password?token=${token}`;
  await getTransporter().sendMail({
    from: FROM,
    to: email,
    subject: 'Redefinir senha — MenuQR',
    html: base(`
      <h2 style="margin:0 0 8px;color:#1F1812;font-size:20px">Redefinir senha</h2>
      <p style="color:#3D3530;line-height:1.6">Recebemos uma solicitação para redefinir a senha de <strong>${email}</strong>.</p>
      <a href="${url}" style="display:inline-block;margin:24px 0;padding:12px 28px;background:#C8462E;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Redefinir senha</a>
      <p style="color:#8B7D6B;font-size:13px">O link expira em 1 hora. Se não foi você, ignore este email — sua senha permanece a mesma.</p>
    `),
  });
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
