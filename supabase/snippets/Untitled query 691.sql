SELECT
  t.*,
  /* trip members */
  jsonb_agg(
    jsonb_build_object(
      'id',       tm.id,
      'user_id',  tm.user_id,
      'role',     tm.role
    )
  ) FILTER (WHERE tm.id IS NOT NULL) AS trip_members,

  /* days (with legs & accommodations) */
  jsonb_agg(
    jsonb_build_object(
      'id',           d.id,
      'date',         d.date,
      'title',        d.title,
      'notes',        d.notes,
      'sort_order',   d.sort_order,

      /* legs for this day */
      'legs', jsonb_agg(
                jsonb_build_object(
                  'id',            l.id,
                  'type',          l.type,
                  'from_name',     l.from_name,
                  'to_name',       l.to_name,
                  'departure_at',  l.departure_at,
                  'arrival_at',    l.arrival_at,
                  'cost',          l.cost,
                  'currency',     l.currency,
                  'notes',         l.notes
                )
              ) FILTER (WHERE l.id IS NOT NULL),

      /* accommodations for this day */
      'accommodations', jsonb_agg(
                jsonb_build_object(
                  'id',       a.id,
                  'name',     a.name,
                  'address',  a.address,
                  'check_in', a.check_in,
                  'check_out',a.check_out,
                  'cost',     a.cost,
                  'currency', a.currency,
                  'notes',    a.notes
                )
              ) FILTER (WHERE a.id IS NOT NULL)
    )
  ) FILTER (WHERE d.id IS NOT NULL) AS days,

  /* restaurants */
  jsonb_agg(
    jsonb_build_object(
      'id',   r.id,
      'name', r.name,
      'address', r.address
    )
  ) FILTER (WHERE r.id IS NOT NULL) AS restaurants,

  /* activities */
  jsonb_agg(
    jsonb_build_object(
      'id',   act.id,
      'type', act.type,
      'name', act.name
    )
  ) FILTER (WHERE act.id IS NOT NULL) AS activities,

  /* documents */
  jsonb_agg(
    jsonb_build_object(
      'id',  d.id,
      'url', d.url,
      'type', d.type
    )
  ) FILTER (WHERE d.id IS NOT NULL) AS documents,

  /* media count (just a number) */
  (SELECT COUNT(*) FROM media m WHERE m.trip_id = t.id) AS media,

  /* expenses (array of {amount_eur, amount}) */
  (SELECT jsonb_agg(
           jsonb_build_object(
             'amount_eur', e.amount_eur,
             'amount',     e.amount
           )
         )
   FROM expenses e
   WHERE e.trip_id = t.id) AS expenses

FROM trips t
LEFT JOIN trip_members tm   ON tm.trip_id   = t.id
LEFT JOIN days d            ON d.trip_id    = t.id
LEFT JOIN legs l            ON l.day_id    = d.id
LEFT JOIN accommodations a ON a.day_id   = d.id
LEFT JOIN restaurants r    ON r.trip_id   = t.id
LEFT JOIN activities act    ON act.trip_id = t.id
LEFT JOIN documents ddoc    ON ddoc.trip_id = t.id
WHERE t.id = '{TRIP_ID}'
GROUP BY t.id;
