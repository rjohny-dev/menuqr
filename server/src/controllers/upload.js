const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { randomBytes } = require('crypto');

const getClient = () => new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const EXT_MAP = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

const uploadImage = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

  const ext = EXT_MAP[req.file.mimetype] ?? 'jpg';
  const key = `uploads/${Date.now()}-${randomBytes(6).toString('hex')}.${ext}`;

  try {
    await getClient().send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));

    res.json({ url: `${process.env.R2_PUBLIC_URL}/${key}` });
  } catch (err) {
    console.error('R2 upload error:', err.message);
    res.status(500).json({ error: 'Erro ao fazer upload da imagem' });
  }
};

module.exports = { uploadImage };
