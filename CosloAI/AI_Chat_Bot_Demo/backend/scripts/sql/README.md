## Backend SQL scripts

Manual SQL scripts live in this folder and are safe to run multiple times.

### How to apply
1. Run the SQL script(s) against the backend database (Postgres) in order:
   - `AI_Chat_Bot_Demo/backend/scripts/sql/35_add_revenue_ai.sql`
   - `AI_Chat_Bot_Demo/backend/scripts/sql/37_add_revenue_ai_recommender_config.sql`
   - `AI_Chat_Bot_Demo/backend/scripts/sql/38_add_revenue_ai_style_override.sql`
   - `AI_Chat_Bot_Demo/backend/scripts/sql/39_add_revenue_ai_idempotency.sql`
   - `AI_Chat_Bot_Demo/backend/scripts/sql/40_add_shopify_policy.sql`
   - `AI_Chat_Bot_Demo/backend/scripts/sql/41_add_catalog_intelligence.sql`
   - `AI_Chat_Bot_Demo/backend/scripts/sql/42_add_clerk_state_broaden.sql`
   - `AI_Chat_Bot_Demo/backend/scripts/sql/43_add_clerk_rejected_products.sql`
   - `AI_Chat_Bot_Demo/backend/scripts/sql/44_add_shop_catalog_context.sql`
2. Regenerate Prisma client:
   - `cd AI_Chat_Bot_Demo/backend`
   - `npx prisma generate`
3. Restart the backend server.

Notes:
- These scripts are idempotent (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).
- Do not use Prisma migrations for these changes.

### Revenue AI overview
- Safety: Offers are only shown inside active conversations. Guardrails block offers during tracking/returns/cancellations/complaints/order issues.
- Frequency: Capped by message interval, max offers per session, cooldown, and dedupe window.
- Attribution: Conservative last-touch within the configured window, recorded as influenced revenue.
