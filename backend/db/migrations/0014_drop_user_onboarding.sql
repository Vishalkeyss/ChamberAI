-- Migration 0014: Drop User Onboarding Columns
-- Canonical context: Onboarding is strictly tenant/chamber scoped (platform_chambers.onboarded and chamber_settings.onboarding_wizard_completed).
-- Individual users do not have an onboarding wizard or interactive checklist.

ALTER TABLE users DROP COLUMN onboarding_steps_json;
ALTER TABLE users DROP COLUMN onboarding_complete;
