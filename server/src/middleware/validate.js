const { z } = require('zod');

// Middleware factory: validates req.body against a Zod schema
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    // Zod v4 uses .issues; v3 used .errors (which was an alias for .issues)
    const issues = result.error.issues ?? result.error.errors ?? [];
    const first = issues[0];
    return res.status(400).json({ error: first?.message ?? 'Dados inválidos' });
  }
  req.body = result.data; // use sanitized/transformed data
  next();
};

// Regex de IPs e hostnames privados/reservados que não devem ser acessados
const PRIVATE_HOST_RE = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|::1|0\.0\.0\.0)/i;

// Preprocessor: converte string vazia/undefined em null; valida URL segura
const urlOrNull = z.preprocess(
  (val) => (val === '' || val === undefined ? null : val),
  z
    .string()
    .url('URL inválida')
    .max(500)
    .refine((url) => url.startsWith('https://'), 'A URL deve começar com https://')
    .refine((url) => {
      try {
        const { hostname } = new URL(url);
        return !PRIVATE_HOST_RE.test(hostname);
      } catch { return false; }
    }, 'URL aponta para endereço não permitido')
    .nullable()
    .optional()
);

// ─── Auth ──────────────────────────────────────────────────────────────────────

const registerSchema = z.object({
  name: z.string({ required_error: 'Nome é obrigatório' })
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome muito longo')
    .trim(),
  email: z.string({ required_error: 'Email é obrigatório' })
    .email('Email inválido')
    .max(255)
    .toLowerCase()
    .trim(),
  password: z.string({ required_error: 'Senha é obrigatória' })
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .max(128, 'Senha muito longa')
    .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
    .regex(/[0-9]/, 'Senha deve conter pelo menos um número'),
});

const loginSchema = z.object({
  email: z.string({ required_error: 'Email é obrigatório' })
    .email('Email inválido')
    .max(255)
    .toLowerCase()
    .trim(),
  password: z.string({ required_error: 'Senha é obrigatória' })
    .min(1, 'Senha é obrigatória')
    .max(128),
});

// ─── Restaurant ───────────────────────────────────────────────────────────────

const restaurantCreateSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100).trim(),
  slug: z.string()
    .min(2, 'Slug deve ter pelo menos 2 caracteres')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  logo_url: urlOrNull,
  description: z.preprocess(
    (val) => (val === '' ? null : val),
    z.string().max(500).trim().nullable().optional()
  ),
  whatsapp: z.preprocess(
    (val) => (val === '' ? null : val),
    z.string()
      .regex(/^\d{10,15}$/, 'WhatsApp deve conter apenas dígitos (10 a 15 caracteres)')
      .nullable()
      .optional()
  ),
});

const restaurantUpdateSchema = restaurantCreateSchema.partial();

// ─── Categories ───────────────────────────────────────────────────────────────

const categoryCreateSchema = z.object({
  name: z.string({ required_error: 'Nome é obrigatório' }).min(1).max(100).trim(),
  order: z.number().int().min(0).optional(),
});

const categoryUpdateSchema = categoryCreateSchema.partial();

// ─── Items ────────────────────────────────────────────────────────────────────

const itemCreateSchema = z.object({
  name: z.string({ required_error: 'Nome é obrigatório' }).min(1).max(200).trim(),
  description: z.preprocess(
    (val) => (val === '' ? null : val),
    z.string().max(1000).trim().nullable().optional()
  ),
  price: z.number({ required_error: 'Preço é obrigatório' })
    .positive('Preço deve ser positivo')
    .max(99999.99, 'Preço máximo excedido'),
  image_url: urlOrNull,
  active: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
});

const itemUpdateSchema = itemCreateSchema.partial();

// ─── Option groups & options ──────────────────────────────────────────────────

const optionGroupCreateSchema = z.object({
  name:     z.string({ required_error: 'Nome é obrigatório' }).min(1).max(100).trim(),
  required: z.boolean().optional(),
  min_qty:  z.number().int().min(0).max(20).optional(),
  max_qty:  z.number().int().min(1).max(20).optional(),
  order:    z.number().int().min(0).optional(),
});

const optionGroupUpdateSchema = optionGroupCreateSchema.partial();

const optionCreateSchema = z.object({
  name:      z.string({ required_error: 'Nome é obrigatório' }).min(1).max(100).trim(),
  price_add: z.number().min(0).max(99999.99).optional(),
  order:     z.number().int().min(0).optional(),
});

const optionUpdateSchema = optionCreateSchema.partial();

const resendVerificationSchema = z.object({
  email: z.string().email('Email inválido').max(255).toLowerCase().trim(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido').max(255).toLowerCase().trim(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token obrigatório'),
  password: z.string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .max(128, 'Senha muito longa')
    .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
    .regex(/[0-9]/, 'Senha deve conter pelo menos um número'),
});

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  restaurantCreateSchema,
  restaurantUpdateSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  itemCreateSchema,
  itemUpdateSchema,
  optionGroupCreateSchema,
  optionGroupUpdateSchema,
  optionCreateSchema,
  optionUpdateSchema,
};
