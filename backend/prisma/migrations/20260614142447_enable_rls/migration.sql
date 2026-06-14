-- Deny-all Row Level Security on every domain table.
-- Authorization is enforced in the NestJS application layer (see docs/05 §2),
-- NOT via RLS policies. Enabling RLS with no policies closes Supabase's public
-- PostgREST/anon API (deny-by-default) while the backend, which connects as the
-- table-owner role, continues to bypass RLS. No policies are added on purpose.

ALTER TABLE public."Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ProjectMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Column" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TaskAssignee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Label" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TaskLabel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ChecklistItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Comment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CommentMention" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Attachment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ActivityLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RefreshToken" ENABLE ROW LEVEL SECURITY;
