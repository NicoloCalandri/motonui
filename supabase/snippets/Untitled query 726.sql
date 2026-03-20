select trip_id,
            trips (
                id, title, destination, cover_image, start_date, end_date, status, created_at
            )
          from trip_members 
-- select id, title, destination, cover_image, start_date, end_date, status,description, created_at from trips;