import { Database } from '../src/lib/supabase/database.types';

type Trips = Database['public']['Tables']['trips']['Insert'];
const t: Trips = {
  title: 'Test',
  destination: 'Test',
  owner_id: '00000000-0000-0000-0000-000000000001'
};
console.log(t);
