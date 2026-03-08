## Catalog Intelligence QA

### Setup
1. Run the SQL script:
   - `AI_Chat_Bot_Demo/backend/scripts/sql/41_add_catalog_intelligence.sql`
2. Regenerate Prisma client:
   - `cd AI_Chat_Bot_Demo/backend`
   - `npx prisma generate`
3. Restart backend.

### Manual checks
1. Sync Shopify products for a bot.
2. Verify schema build:
   - `GET /api/shopify/catalog-schema?shopDomain=...`
   - Confirm `attributes` and `productTypes` populated.
3. Rebuild schema:
   - `POST /api/shopify/catalog-schema/rebuild` with `{ "shopDomain": "..." }`
4. Clerk flow:
   - Broad request (e.g., “I need shoes”) should ask 1–2 questions.
   - Provide a value from the question; assistant should return 3 option shortlist cards.
   - Reply “first” or “second”; assistant should show details + CTA card.
5. Language:
   - Start conversation in Italian/Spanish; clerk questions and shortlist text should remain in that language.

### Automated tests
Run backend unit tests:
```
npm test -- --runInBand
```
