-- =============================================================
-- 121Meet Development Seed Data
-- Run with: npx wrangler d1 execute chamber-d1-prod --local --file=db/seed_dev.sql
-- =============================================================

-- ---------------------------------------------------------------
-- 1. Seed a test Chamber (tenant)
-- ---------------------------------------------------------------
INSERT OR IGNORE INTO platform_chambers (
  id, name, city, subdomain, custom_domain, domain_status, status,
  admin_contact_name, admin_email, onboarded, members_count, revenue_total,
  created_at, updated_at
) VALUES (
  'cham_test0000000001',
  'Metro Dev Chamber of Commerce',
  'Testville',
  'metro-dev',
  NULL,
  'none',
  'active',
  'Marcus Vance',
  'admin@metrodev.com',
  1,
  2,
  0.0,
  datetime('now'),
  datetime('now')
);

-- ---------------------------------------------------------------
-- 2. Seed Platform Super Admin
--    Portal:  superadmin
--    Email:   superadmin@121meet.com
-- ---------------------------------------------------------------
INSERT OR IGNORE INTO platform_super_admins (
  id, name, email, phone, is_active, two_factor_enabled, created_at, updated_at
) VALUES (
  'sadm_test000000001',
  'Dev Super Admin',
  'superadmin@121meet.com',
  NULL,
  1,
  0,
  datetime('now'),
  datetime('now')
);

-- ---------------------------------------------------------------
-- 3. Seed Chamber Full Admin user
--    Portal:  admin
--    Email:   admin@metrodev.com
-- ---------------------------------------------------------------
INSERT OR IGNORE INTO users (
  id, chamber_id, member_verification_token, email, phone, name,
  avatar_url, highest_role, status,
  points_balance, profile_completion_pct, onboarding_complete,
  two_factor_enabled, preferred_language, preferred_theme,
  ai_credits_used, ai_credits_limit,
  created_at, updated_at
) VALUES (
  'usr_admin000000001',
  'cham_test0000000001',
  'mvt_admin000000001',
  'admin@metrodev.com',
  NULL,
  'Marcus Vance (Admin)',
  NULL,
  'full_admin',
  'active',
  0, 80, 1, 0,
  'en', 'system',
  0, 50,
  datetime('now'),
  datetime('now')
);

-- Role assignment: full_admin scoped to chamber (self-granted for bootstrap)
INSERT OR IGNORE INTO user_role_assignments (
  id, chamber_id, user_id, role_id, scope_type, scope_id,
  granted_by, granted_at, expires_at, is_active
) VALUES (
  'ura_admin000000001',
  'cham_test0000000001',
  'usr_admin000000001',
  'full_admin',
  'chamber',
  'cham_test0000000001',
  'usr_admin000000001',
  datetime('now'),
  NULL,
  1
);

-- ---------------------------------------------------------------
-- 4. Seed Member user
--    Portal:  member
--    Email:   member@metrodev.com
-- ---------------------------------------------------------------
INSERT OR IGNORE INTO users (
  id, chamber_id, member_verification_token, email, phone, name,
  avatar_url, highest_role, status,
  points_balance, profile_completion_pct, onboarding_complete,
  two_factor_enabled, preferred_language, preferred_theme,
  ai_credits_used, ai_credits_limit,
  created_at, updated_at
) VALUES (
  'usr_member00000001',
  'cham_test0000000001',
  'mvt_member00000001',
  'member@metrodev.com',
  NULL,
  'Sarah Jenkins (Member)',
  NULL,
  'member',
  'active',
  500, 60, 0, 0,
  'en', 'system',
  0, 5,
  datetime('now'),
  datetime('now')
);

-- Role assignment: member scoped to chamber
INSERT OR IGNORE INTO user_role_assignments (
  id, chamber_id, user_id, role_id, scope_type, scope_id,
  granted_by, granted_at, expires_at, is_active
) VALUES (
  'ura_member00000001',
  'cham_test0000000001',
  'usr_member00000001',
  'member',
  'chamber',
  'cham_test0000000001',
  'usr_admin000000001',
  datetime('now'),
  NULL,
  1
);

-- ---------------------------------------------------------------
-- 5. Seed Chapter Admin user
--    Portal:  admin
--    Email:   chapteradmin@metrodev.com
-- ---------------------------------------------------------------
INSERT OR IGNORE INTO users (
  id, chamber_id, member_verification_token, email, phone, name,
  avatar_url, highest_role, status,
  points_balance, profile_completion_pct, onboarding_complete,
  two_factor_enabled, preferred_language, preferred_theme,
  ai_credits_used, ai_credits_limit,
  created_at, updated_at
) VALUES (
  'usr_chap000000001',
  'cham_test0000000001',
  'mvt_chap00000001',
  'chapteradmin@metrodev.com',
  NULL,
  'Paige Chandler (Chapter Admin)',
  NULL,
  'chapter_admin',
  'active',
  100, 75, 1, 0,
  'en', 'system',
  0, 25,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO user_role_assignments (
  id, chamber_id, user_id, role_id, scope_type, scope_id,
  granted_by, granted_at, expires_at, is_active
) VALUES (
  'ura_chap000000001',
  'cham_test0000000001',
  'usr_chap000000001',
  'chapter_admin',
  'chapter',
  'chap_test0000000001',
  'usr_admin000000001',
  datetime('now'),
  NULL,
  1
);

-- ---------------------------------------------------------------
-- 6. Seed Group Admin user
--    Portal:  admin
--    Email:   groupadmin@metrodev.com
-- ---------------------------------------------------------------
INSERT OR IGNORE INTO users (
  id, chamber_id, member_verification_token, email, phone, name,
  avatar_url, highest_role, status,
  points_balance, profile_completion_pct, onboarding_complete,
  two_factor_enabled, preferred_language, preferred_theme,
  ai_credits_used, ai_credits_limit,
  created_at, updated_at
) VALUES (
  'usr_grp0000000001',
  'cham_test0000000001',
  'mvt_grp0000000001',
  'groupadmin@metrodev.com',
  NULL,
  'Gordon Ramsey (Group Admin)',
  NULL,
  'group_admin',
  'active',
  100, 75, 1, 0,
  'en', 'system',
  0, 25,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO user_role_assignments (
  id, chamber_id, user_id, role_id, scope_type, scope_id,
  granted_by, granted_at, expires_at, is_active
) VALUES (
  'ura_grp0000000001',
  'cham_test0000000001',
  'usr_grp0000000001',
  'group_admin',
  'group',
  'grp_test0000000001',
  'usr_admin000000001',
  datetime('now'),
  NULL,
  1
);

-- ---------------------------------------------------------------
-- Verify seeded data
-- ---------------------------------------------------------------
SELECT 'platform_chambers'      AS tbl, COUNT(*) AS rows FROM platform_chambers
UNION ALL
SELECT 'platform_super_admins', COUNT(*) FROM platform_super_admins
UNION ALL
SELECT 'users',                 COUNT(*) FROM users
UNION ALL
SELECT 'user_role_assignments', COUNT(*) FROM user_role_assignments;
