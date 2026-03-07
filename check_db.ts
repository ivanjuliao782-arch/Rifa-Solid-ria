
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkDb() {
  const { count, error } = await supabase
    .from('rifa_numeros')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error('Error counting rows:', error);
  } else {
    console.log('Total rows in rifa_numeros:', count);
  }

  const { data: samples, error: sampleError } = await supabase
    .from('rifa_numeros')
    .select('numero, status')
    .limit(10);
  
  if (sampleError) {
    console.error('Error fetching samples:', sampleError);
  } else {
    console.log('Sample rows:', samples);
  }
}

checkDb();
