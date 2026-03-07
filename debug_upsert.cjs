
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hbsecidlgqcyeftjngra.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhic2VjaWRsZ3FjeWVmdGpuZ3JhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NTc5NTIsImV4cCI6MjA4ODMzMzk1Mn0.ufCy6smp9Ip_J884HNhQ9hWjue29KMC_rSE_FsMWytw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testUpsert() {
  const testNum = Math.floor(Math.random() * 2000) + 1;
  console.log(`--- Teste de UPSERT para o número: ${testNum} ---`);

  const reservation = {
    numero: testNum,
    status: 'reservado',
    nome: 'Debug Upsert',
    telefone: '999',
    reservado_em: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('rifa_numeros')
    .upsert([reservation], { onConflict: 'numero' })
    .select();

  if (error) {
    console.error('ERRO NO UPSERT:', JSON.stringify(error, null, 2));
  } else {
    console.log('UPSERT SUCESSO:', JSON.stringify(data, null, 2));
    
    // Agora tenta dar um upsert no MESMO número para testar o UPDATE via upsert
    console.log(`--- Teste de UPDATE via UPSERT para o número: ${testNum} ---`);
    const { data: data2, error: error2 } = await supabase
      .from('rifa_numeros')
      .upsert([{ ...reservation, nome: 'Debug Upsert V2' }], { onConflict: 'numero' })
      .select();

    if (error2) {
      console.error('ERRO NO UPDATE VIA UPSERT:', JSON.stringify(error2, null, 2));
    } else {
      console.log('UPDATE VIA UPSERT SUCESSO:', JSON.stringify(data2, null, 2));
    }
  }
}

testUpsert();
