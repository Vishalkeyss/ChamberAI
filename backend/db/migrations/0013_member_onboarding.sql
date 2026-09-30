-- Migration 0013: Member Onboarding Steps JSON
-- Adds onboarding_steps_json column to users table for tracking 4-step interactive checklist
-- Required by Prompt 02.4: Member Overview Dashboard & Interactive Onboarding Checklist

ALTER TABLE users ADD COLUMN onboarding_steps_json TEXT NOT NULL DEFAULT '{"profile": false, "card": false, "network": false, "team": false}';
