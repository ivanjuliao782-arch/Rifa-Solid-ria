
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hbsecidlgqcyeftjngra.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhic2VjaWRsZ3FjeWVmdGpuZ3JhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NTc5NTIsImV4cCI6MjA4ODMzMzk1Mn0.ufCy6smp9Ip_J884HNhQ9hWjue29KMC_rSE_FsMWytw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkColumns() {
  const { data, error } = await supabase
    .from('rifa_numeros')
    .select('*')
    .limit(1);

  if (error) {
    console.error('ERRO AO BUSCAR COLUNAS:', error);
  } else if (data && data.length > 0) {
    console.log('COLUNAS ENCONTRADAS:', Object.keys(data[0]));
    console.log('DADO DE EXEMPLO:', JSON.stringify(data[0], null, 2));
  } else {
    console.log('Nenhum dado encontrado para inferir colunas.');
  }
}

checkColumns();
