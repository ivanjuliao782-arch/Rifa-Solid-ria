-- Execute este SQL no Editor SQL do seu projeto Supabase:

CREATE TABLE rifa_numeros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'reservado', -- 'pago', 'aguardando_verificacao', 'reservado'
  comprovante_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Realtime para esta tabela
ALTER PUBLICATION supabase_realtime ADD TABLE rifa_numeros;

-- Criar bucket de storage para comprovantes
-- No painel do Supabase, vá em Storage e crie um bucket chamado 'comprovantes' (público).
