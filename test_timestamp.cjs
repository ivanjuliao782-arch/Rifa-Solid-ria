
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hbsecidlgqcyeftjngra.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhic2VjaWRsZ3FjeWVmdGpuZ3JhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NTc5NTIsImV4cCI6MjA4ODMzMzk1Mn0.ufCy6smp9Ip_J884HNhQ9hWjue29KMC_rSE_FsMWytw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testCreatedAtUpdate() {
  const testNum = 1; // Número que já existe
  console.log(`--- Teste de Update created_at via UPSERT para o número: ${testNum} ---`);

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('rifa_numeros')
    .upsert([{
      numero: testNum,
      status: 'reservado',
      created_at: now
    }], { onConflict: 'numero' })
    .select();

  if (error) {
    console.error('ERRO NO UPSERT:', JSON.stringify(error, null, 2));
  } else {
    console.log('UPSERT SUCESSO. Novo created_at:', data[0].created_at);
    console.log('Esperado:', now);
    if (data[0].created_at.startsWith(now.substring(0, 19))) {
       console.log('SUCESSO: created_at foi atualizado!');
    } else {
       console.log('FALHA: created_at NÃO foi atualizado!');
    }
  }
}

testCreatedAtUpdate();
