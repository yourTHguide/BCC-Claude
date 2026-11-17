-- Rollback for supabase/production/bcc_phase2_capacity_12.sql: returns the
-- same 12 dates to "no capacity" (unlimited), but only where the value is
-- still the 12 this release set (a date raised to 22 by an operator is left
-- alone). Expected result: UPDATE 12 (fewer if any were changed since).

UPDATE event_dates
SET capacity = NULL
WHERE capacity = 12
  AND id IN ('c34707a6-59b5-4cea-9a94-819071d39cb8', '58d972cf-5d78-413c-aa7d-086ed0fc5fa6', '896bfef6-edda-4e8e-a7c2-26566b4aedb6', 'b2b29ecd-5105-4739-9225-b364ed6e8179', '4495165d-cd7c-4f1e-a71a-179cd0bf0f5e', '63c02b93-8e5a-4cf4-ba7f-66b26c3eb126', '6a266ea1-a82f-436c-b795-820f4a58c2bc', '9c8db38a-fca7-452d-b60f-9b8e943c8c6b', 'b9a515cc-67e4-42e9-807d-cd58bfc97700', 'e6888659-e9a6-4f56-84da-0c08ec30bf73', '58e6487e-5345-4f72-9ef7-01573d28a9a1', '5da17e76-375b-4038-a9f1-cad45b5be9fd');
