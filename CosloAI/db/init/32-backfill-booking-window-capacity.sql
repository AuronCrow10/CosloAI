-- Backfill per-window capacity into booking weekly schedules.
-- This script adds "maxSimultaneousBookings" to each time window object.
-- For BookingService schedules, it uses BookingService.maxSimultaneousBookings (fallback 1).
-- For legacy Bot bookingWeeklySchedule, it uses Bot.bookingMaxSimultaneousBookings (fallback 1).

-- BookingService.weeklySchedule (service-level schedules)
UPDATE "BookingService" bs
SET "weeklySchedule" = (
  SELECT jsonb_object_agg(day, windows)
  FROM (
    SELECT
      key AS day,
      jsonb_agg(
        CASE
          WHEN (value ? 'maxSimultaneousBookings') THEN value
          ELSE value || jsonb_build_object(
            'maxSimultaneousBookings',
            COALESCE(bs."maxSimultaneousBookings", 1)
          )
        END
        ORDER BY ord
      ) AS windows
    FROM jsonb_each(bs."weeklySchedule") AS e(key, arr)
    CROSS JOIN LATERAL jsonb_array_elements(arr) WITH ORDINALITY AS w(value, ord)
    GROUP BY key
  ) t
)
WHERE bs."weeklySchedule" IS NOT NULL
  AND jsonb_typeof(bs."weeklySchedule") = 'object';

-- Bot.bookingWeeklySchedule (legacy single-service schedules)
UPDATE "Bot" b
SET "bookingWeeklySchedule" = (
  SELECT jsonb_object_agg(day, windows)
  FROM (
    SELECT
      key AS day,
      jsonb_agg(
        CASE
          WHEN (value ? 'maxSimultaneousBookings') THEN value
          ELSE value || jsonb_build_object(
            'maxSimultaneousBookings',
            COALESCE(b."bookingMaxSimultaneousBookings", 1)
          )
        END
        ORDER BY ord
      ) AS windows
    FROM jsonb_each(b."bookingWeeklySchedule") AS e(key, arr)
    CROSS JOIN LATERAL jsonb_array_elements(arr) WITH ORDINALITY AS w(value, ord)
    GROUP BY key
  ) t
)
WHERE b."bookingWeeklySchedule" IS NOT NULL
  AND jsonb_typeof(b."bookingWeeklySchedule") = 'object';
