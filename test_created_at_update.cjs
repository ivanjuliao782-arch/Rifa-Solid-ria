
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hbsecidlgqcyeftjngra.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhic2VjaWRsZ3FjeWVmdGpuZ3JhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NTc5NTIsImV4cCI6MjA4ODMzMzk1Mn0.ufCy6smp9Ip_J884HNhQ9hWjue29KMC_rSE_FsMWytw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testUpdateCreatedAt() {
  const { data: initial } = await supabase
    .from('rifa_numeros')
    .select('id, created_at')
    .limit(1)
    .single();

  if (!initial) {
     console.log('Nenhum dado para testar update.');
     return;
  }

  console.log(`ID: ${initial.id}, Old created_at: ${initial.created_at}`);

  const now = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from('rifa_numeros')
    .update({ 
      nome: 'Teste Timestamp Update',
      created_at: now
    })
    .eq('id', initial.id)
    .select();

  if (error) {
     console.error('ERRO NO UPDATE created_at:', JSON.stringify(error, null, 2));
  } else {
     console.log('Update SUCESSO. New created_at:', updated[0].created_at);
     if (updated[0].created_at.startsWith(now.substring(0, 19))) {
        console.log('created_at FOI ATUALIZADO!');
     } else {
        console.log('created_at NÃO FOI ATUALIZADO (Ignorado pelo Postgres)!');
     }
  }
}

testUpdateCreatedAt();
