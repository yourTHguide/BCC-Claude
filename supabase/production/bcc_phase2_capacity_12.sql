-- BCC Phase 2: standard capacity of 12 per date (one van). PRODUCTION.
-- Approved by Guide 17 Nov 2026: 12 per date; raise to ~22 for a date only
-- after a second van and staffing are confirmed (via the dashboard).
-- Applies to the 12 upcoming Bangkok Club Crawl dates that existed on
-- 17 Nov 2026 (20 Nov to 26 Dec), and only where no capacity is set yet.
-- Rollback: supabase/rollback/bcc_phase2_capacity_12_down.sql
-- Expected result: UPDATE 12

UPDATE event_dates
SET capacity = 12
WHERE capacity IS NULL
  AND id IN ('c34707a6-59b5-4cea-9a94-819071d39cb8', '58d972cf-5d78-413c-aa7d-086ed0fc5fa6', '896bfef6-edda-4e8e-a7c2-26566b4aedb6', 'b2b29ecd-5105-4739-9225-b364ed6e8179', '4495165d-cd7c-4f1e-a71a-179cd0bf0f5e', '63c02b93-8e5a-4cf4-ba7f-66b26c3eb126', '6a266ea1-a82f-436c-b795-820f4a58c2bc', '9c8db38a-fca7-452d-b60f-9b8e943c8c6b', 'b9a515cc-67e4-42e9-807d-cd58bfc97700', 'e6888659-e9a6-4f56-84da-0c08ec30bf73', '58e6487e-5345-4f72-9ef7-01573d28a9a1', '5da17e76-375b-4038-a9f1-cad45b5be9fd');
