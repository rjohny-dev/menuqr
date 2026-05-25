-- MenuQR Database Schema
-- Run this in your PostgreSQL database (Supabase SQL Editor)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS restaurants (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_restaurants_slug    ON restaurants(slug);
CREATE INDEX IF NOT EXISTS idx_restaurants_user_id ON restaurants(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_rest_id  ON categories(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_items_category_id   ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_active        ON items(category_id, active);

-- Migration: add missing columns if upgrading from old schema
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS description VARCHAR(500);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS whatsapp    VARCHAR(20);
