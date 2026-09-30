-- Migration: 0008_content_and_learning.sql
-- Modules 9, 12, 13, 14, 15, 17: Content, Communications, Jobs, LMS, Gamification & Media (16 tables)
-- Canonical Reference: database/DB_tables_reference.md & database/DB_schema.dbml

-- 9.1 announcements
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visibility TEXT DEFAULT 'public' CHECK(visibility IN ('public', 'staff_only')),
  audience TEXT DEFAULT 'all' CHECK(audience IN ('all', 'chapter', 'group', 'event_attendees')),
  chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
  target_event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
  include_non_members INTEGER NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_announcements_chamber ON announcements(chamber_id);
CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements(status);

-- 9.2 broadcasts
CREATE TABLE IF NOT EXISTS broadcasts (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  channels_json TEXT NOT NULL,
  chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  audience TEXT DEFAULT 'all_members' CHECK(audience IN ('all_members', 'chapter', 'admins_only')),
  sent_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sent_at TEXT,
  recipients_count INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  clicked_count INTEGER NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'sending' CHECK(status IN ('sending', 'sent', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_broadcasts_chamber ON broadcasts(chamber_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_sent_at ON broadcasts(sent_at);

-- 9.3 email_campaigns
CREATE TABLE IF NOT EXISTS email_campaigns (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  campaign_type TEXT NOT NULL CHECK(campaign_type IN ('newsletter', 'daily_digest', 'promotional', 'event_digest')),
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  audience TEXT DEFAULT 'all' CHECK(audience IN ('all', 'chapter', 'group', 'active_members')),
  chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
  scheduled_at TEXT,
  sent_at TEXT,
  recipients_count INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  opened_count INTEGER NOT NULL DEFAULT 0,
  clicked_count INTEGER NOT NULL DEFAULT 0,
  bounced_count INTEGER NOT NULL DEFAULT 0,
  ai_generated INTEGER NOT NULL DEFAULT 0,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_chamber ON email_campaigns(chamber_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status);

-- 12.1 job_postings
CREATE TABLE IF NOT EXISTS job_postings (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  business_id TEXT NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  posted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  job_type TEXT NOT NULL,
  city TEXT,
  category TEXT,
  salary_range TEXT,
  chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'closed', 'draft')),
  views_count INTEGER NOT NULL DEFAULT 0,
  applicants_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_job_postings_chamber ON job_postings(chamber_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_business ON job_postings(business_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_status ON job_postings(status);

-- 12.2 job_applications
CREATE TABLE IF NOT EXISTS job_applications (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  applicant_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  resume_url TEXT,
  cover_note TEXT,
  portfolio_url TEXT,
  pipeline_status TEXT DEFAULT 'new' CHECK(pipeline_status IN ('new', 'shortlisted', 'interview', 'hired', 'rejected')),
  is_member INTEGER NOT NULL DEFAULT 0,
  member_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_job_applications_chamber ON job_applications(chamber_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_job ON job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON job_applications(pipeline_status);

-- 13.1 courses
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT,
  level TEXT DEFAULT 'intermediate' CHECK(level IN ('beginner', 'intermediate', 'advanced')),
  instructor_name TEXT,
  lessons_count INTEGER NOT NULL DEFAULT 0,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  price REAL NOT NULL DEFAULT 0.0,
  ceu_credits REAL NOT NULL DEFAULT 0.0,
  description TEXT,
  enrolled_count INTEGER NOT NULL DEFAULT 0,
  avg_rating REAL NOT NULL DEFAULT 5.0,
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_courses_chamber ON courses(chamber_id);
CREATE INDEX IF NOT EXISTS idx_courses_published ON courses(is_published);

-- 13.2 course_enrollments
CREATE TABLE IF NOT EXISTS course_enrollments (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  progress_pct INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'enrolled' CHECK(status IN ('enrolled', 'in_progress', 'completed')),
  completed_at TEXT,
  certificate_key TEXT,
  ceu_credits REAL NOT NULL DEFAULT 0.0,
  enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(course_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_chamber ON course_enrollments(chamber_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_course ON course_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_user ON course_enrollments(user_id);

-- 13.3 ceu_credits
CREATE TABLE IF NOT EXISTS ceu_credits (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_name TEXT NOT NULL,
  credits REAL NOT NULL DEFAULT 0.0,
  source TEXT NOT NULL CHECK(source IN ('course', 'manual')),
  source_course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
  course_enrollment_id TEXT REFERENCES course_enrollments(id) ON DELETE SET NULL,
  external_certificate_key TEXT,
  status TEXT NOT NULL DEFAULT 'approved' CHECK(status IN ('approved', 'new')),
  added_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  completed_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ceu_credits_chamber ON ceu_credits(chamber_id);
CREATE INDEX IF NOT EXISTS idx_ceu_credits_user ON ceu_credits(user_id);

-- 13.4 ceu_requirements
CREATE TABLE IF NOT EXISTS ceu_requirements (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL UNIQUE REFERENCES platform_chambers(id) ON DELETE CASCADE,
  required_credits REAL NOT NULL DEFAULT 20.0,
  renewal_cycle TEXT NOT NULL DEFAULT 'annual',
  cycle_start_date TEXT,
  cycle_end_date TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_ceu_req_chamber ON ceu_requirements(chamber_id);

-- 14.1 points_history
CREATE TABLE IF NOT EXISTS points_history (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('earned', 'redeemed')),
  reason TEXT NOT NULL,
  related_event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
  related_referral_id TEXT REFERENCES referrals(id) ON DELETE SET NULL,
  claim_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_points_history_chamber ON points_history(chamber_id);
CREATE INDEX IF NOT EXISTS idx_points_history_user ON points_history(user_id);

-- 14.2 rewards
CREATE TABLE IF NOT EXISTS rewards (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  points_cost INTEGER NOT NULL,
  reward_type TEXT NOT NULL CHECK(reward_type IN ('event_discount', 'directory_featured', 'free_ticket', 'store_credit')),
  reward_value REAL NOT NULL DEFAULT 0.0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rewards_chamber ON rewards(chamber_id);
CREATE INDEX IF NOT EXISTS idx_rewards_active ON rewards(is_active);

-- 15.1 photo_albums
CREATE TABLE IF NOT EXISTS photo_albums (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  event_date TEXT,
  description TEXT,
  cover_photo_url TEXT,
  photo_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_photo_albums_chamber ON photo_albums(chamber_id);

-- 15.2 photo_album_images
CREATE TABLE IF NOT EXISTS photo_album_images (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  album_id TEXT NOT NULL REFERENCES photo_albums(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_photo_images_chamber ON photo_album_images(chamber_id);
CREATE INDEX IF NOT EXISTS idx_photo_images_album ON photo_album_images(album_id);

-- 17.1 resources
CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT,
  description TEXT,
  file_key TEXT NOT NULL,
  file_size_bytes INTEGER,
  file_type TEXT,
  visibility TEXT NOT NULL DEFAULT 'all_members' CHECK(visibility IN ('all_members', 'public', 'board_only', 'tier_restricted')),
  downloads_count INTEGER NOT NULL DEFAULT 0,
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_resources_chamber ON resources(chamber_id);
CREATE INDEX IF NOT EXISTS idx_resources_visibility ON resources(visibility);

-- 17.2 news_releases
CREATE TABLE IF NOT EXISTS news_releases (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  business_id TEXT NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  submitted_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_news_releases_chamber ON news_releases(chamber_id);
CREATE INDEX IF NOT EXISTS idx_news_releases_business ON news_releases(business_id);
CREATE INDEX IF NOT EXISTS idx_news_releases_status ON news_releases(status);

-- 17.3 blog_posts
CREATE TABLE IF NOT EXISTS blog_posts (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  category TEXT,
  cover_image_key TEXT,
  body TEXT NOT NULL,
  excerpt TEXT,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'published')),
  publish_date TEXT,
  is_featured INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  UNIQUE(chamber_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_blog_posts_chamber ON blog_posts(chamber_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
