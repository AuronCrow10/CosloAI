## Manual DB Scripts

These scripts are intended to be applied manually in staging/production.

### How to apply
1. Connect to the target database.
2. Run the `*_up.sql` file for the change you want.
3. If rollback is needed, run the corresponding `*_down.sql`.

Example:
```sql
-- apply
\i db/scripts/45_add_shopify_shopping_state_up.sql

-- rollback
\i db/scripts/45_add_shopify_shopping_state_down.sql
```
