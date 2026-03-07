
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hbsecidlgqcyeftjngra.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhic2VjaWRsZ3FjeWVmdGpuZ3JhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NTc5NTIsImV4cCI6MjA4ODMzMzk1Mn0.ufCy6smp9Ip_J884HNhQ9hWjue29KMC_rSE_FsMWytw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkDb() {
  const { count, error } = await supabase
    .from('rifa_numeros')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error('Error counting rows:', JSON.stringify(error, null, 2));
  } else {
    console.log('Total rows in rifa_numeros:', count);
  }

  const { data: samples, error: sampleError } = await supabase
    .from('rifa_numeros')
    .select('numero, status')
    .limit(10);
  
  if (sampleError) {
    console.error('Error fetching samples:', JSON.stringify(sampleError, null, 2));
  } else {
    console.log('Sample rows:', JSON.stringify(samples, null, 2));
  }
}

checkDb();
