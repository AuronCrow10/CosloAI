-- Remove restaurant/table booking flow (idempotent)

-- Drop restaurant reservation tables first to satisfy FKs
DROP TABLE IF EXISTS "RestaurantReservationTable" CASCADE;
DROP TABLE IF EXISTS "RestaurantReservation" CASCADE;
DROP TABLE IF EXISTS "RestaurantTable" CASCADE;
DROP TABLE IF EXISTS "RestaurantRoom" CASCADE;

-- Remove restaurant-specific columns from Bot
ALTER TABLE "Bot"
  DROP COLUMN IF EXISTS "bookingMode",
  DROP COLUMN IF EXISTS "restaurantDefaultDurationMinutes",
  DROP COLUMN IF EXISTS "restaurantAllowTableCombining",
  DROP COLUMN IF EXISTS "restaurantMinPartySize",
  DROP COLUMN IF EXISTS "restaurantMaxPartySize";

-- Remove enum used by booking mode
DROP TYPE IF EXISTS "BookingMode";
