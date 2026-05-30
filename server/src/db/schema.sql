-- MenuQR Database Schema
-- Run this in your PostgreSQL database (Supabase SQL Editor)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                        VARCHAR(100) NOT NULL,
  email                       VARCHAR(255) UNIQUE NOT NULL,
  password_hash               VARCHAR(255) NOT NULL,
  email_verified              BOOLEAN DEFAULT false,
  verification_token_hash     TEXT,
  verification_token_expires  TIMESTAMP,
  reset_token_hash            TEXT,
  reset_token_expires         TIMESTAMP,
  failed_attempts             INTEGER DEFAULT 0,
  locked_until                TIMESTAMP,
  created_at                  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS restaurants (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(100) UNIQUE NOT NULL,
  logo_url    TEXT,
  description VARCHAR(500),
  whatsapp    VARCHAR(20),
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  "order"       INTEGER DEFAULT 0,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  name        VARCHAR(200) NOT NULL,
  description TEXT,
  price       DECIMAL(10, 2) NOT NULL CHECK (price > 0),
  image_url   TEXT,
  active      BOOLEAN DEFAULT true,
  "order"     INTEGER DEFAULT 0,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Refresh tokens (one row per active session / device)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

-- Token blocklist for JWT revocation on logout
CREATE TABLE IF NOT EXISTS token_blocklist (
  jti        TEXT PRIMARY KEY,
  expires_at TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_token_blocklist_expires ON token_blocklist(expires_at);

-- Option groups per item (e.g. "Tamanho", "Sabor", "Complementos")
CREATE TABLE IF NOT EXISTS item_option_groups (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id     UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  required    BOOLEAN NOT NULL DEFAULT false,
  min_qty     INTEGER NOT NULL DEFAULT 0,
  max_qty     INTEGER NOT NULL DEFAULT 1,
  "order"     INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Individual options within a group (e.g. "Pequeno", "Grande +R$5")
CREATE TABLE IF NOT EXISTS item_options (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id    UUID NOT NULL REFERENCES item_option_groups(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  price_add   DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (price_add >= 0),
  "order"     INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_restaurants_slug    ON restaurants(slug);
CREATE INDEX IF NOT EXISTS idx_restaurants_user_id ON restaurants(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_rest_id  ON categories(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_items_category_id   ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_active        ON items(category_id, active);
CREATE INDEX IF NOT EXISTS idx_option_groups_item  ON item_option_groups(item_id);
CREATE INDEX IF NOT EXISTS idx_options_group       ON item_options(group_id);

-- Migration: add missing columns if upgrading from old schema
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempts            INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until               TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified             BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_hash           TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires        TIMESTAMP;
ALTER TABLE restaurants  ADD COLUMN IF NOT EXISTS description     VARCHAR(500);
ALTER TABLE restaurants  ADD COLUMN IF NOT EXISTS whatsapp        VARCHAR(20);

-- Migration: rename verification_token (plaintext) → verification_token_hash
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'verification_token'
  ) THEN
    ALTER TABLE users RENAME COLUMN verification_token TO verification_token_hash;
  END IF;
END $$;

-- Migration: add verification_token_hash if not present (fresh DB via old ADD COLUMN path)
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_hash TEXT;

-- Migration: enforce one restaurant per user (required for ON CONFLICT (user_id))
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'restaurants_user_id_key'
      AND conrelid = 'restaurants'::regclass
  ) THEN
    ALTER TABLE restaurants ADD CONSTRAINT restaurants_user_id_key UNIQUE (user_id);
  END IF;
END;
$$;
