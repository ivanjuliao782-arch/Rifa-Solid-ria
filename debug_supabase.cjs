
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hbsecidlgqcyeftjngra.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhic2VjaWRsZ3FjeWVmdGpuZ3JhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NTc5NTIsImV4cCI6MjA4ODMzMzk1Mn0.ufCy6smp9Ip_J884HNhQ9hWjue29KMC_rSE_FsMWytw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugReservation() {
  const testNum = Math.floor(Math.random() * 2000) + 1;
  console.log(`--- Teste de Reserva para o número: ${testNum} ---`);

  // 1. Verificar se existe
  const { data: existing, error: fetchError } = await supabase
    .from('rifa_numeros')
    .select('*')
    .eq('numero', testNum);
  
  if (fetchError) {
    console.error('Erro ao buscar número:', JSON.stringify(fetchError, null, 2));
  } else {
    console.log(`Existem ${existing.length} registros para o número ${testNum}`);
    if (existing.length > 0) {
      console.log('Dados existentes:', JSON.stringify(existing, null, 2));
    }
  }

  // 2. Tentar Inserir (se não existir)
  if (!existing || existing.length === 0) {
    console.log('Tentando INSERT...');
    const { data: inserted, error: insertError } = await supabase
      .from('rifa_numeros')
      .insert({
        numero: testNum,
        status: 'reservado',
        nome: 'Teste Debug',
        telefone: '123'
      })
      .select();
    
    if (insertError) {
      console.error('ERRO NO INSERT:', JSON.stringify(insertError, null, 2));
    } else {
      console.log('INSERT SUCESSO:', JSON.stringify(inserted, null, 2));
    }
  } else {
    // 3. Tentar Update (se existir e estiver livre ou reservado)
    console.log('Tentando UPDATE...');
    const { data: updated, error: updateError } = await supabase
      .from('rifa_numeros')
      .update({
        status: 'reservado',
        nome: 'Teste Debug Update'
      })
      .eq('id', existing[0].id)
      .select();
    
    if (updateError) {
      console.error('ERRO NO UPDATE:', JSON.stringify(updateError, null, 2));
    } else {
      console.log('UPDATE SUCESSO:', JSON.stringify(updated, null, 2));
    }
  }
}

debugReservation();
