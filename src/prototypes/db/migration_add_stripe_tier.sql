-- Migration: Add Stripe subscription and tier columns to users table
-- Run this against your Supabase/PostgreSQL database

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free',
    ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
    ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
    ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
