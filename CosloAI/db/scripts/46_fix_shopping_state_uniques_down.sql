-- Drop unique constraints added for ShoppingSessionState
ALTER TABLE "ShoppingSessionState"
  DROP CONSTRAINT IF EXISTS "ShoppingSessionState_bot_conversation_unique";

ALTER TABLE "ShoppingSessionState"
  DROP CONSTRAINT IF EXISTS "ShoppingSessionState_bot_session_unique";
