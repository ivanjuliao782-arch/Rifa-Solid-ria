
-- SCRIPT DE CONFIGURAÇÃO DO MÓDULO OCR
-- Execute este script no SQL Editor do Supabase para ativar a automação.

-- 1. Habilitar a extensão para chamadas HTTP (se não estiver ativa)
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- 2. Criar a função que chama a Edge Function
CREATE OR REPLACE FUNCTION public.fn_validate_pix_ocr()
RETURNS TRIGGER AS $$
DECLARE
  auth_header text;
  -- Fallback para garantir que a Edge Function seja chamada com sucesso mesmo sem contexto de sessão
  api_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhic2VjaWRsZ3FjeWVmdGpuZ3JhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NTc5NTIsImV4cCI6MjA4ODMzMzk1Mn0.ufCy6smp9Ip_J884HNhQ9hWjue29KMC_rSE_FsMWytw';
BEGIN
  -- Tenta obter o header de autorização da sessão, se disponível
  BEGIN
    auth_header := current_setting('request.headers')::jsonb->>'authorization';
  EXCEPTION WHEN OTHERS THEN
    auth_header := NULL;
  END;

  -- Se não encontrar o header na sessão, usa a chave anon como fallback
  IF auth_header IS NULL OR auth_header = '' THEN
    auth_header := 'Bearer ' || api_key;
  END IF;

  -- Só dispara se o status for 'aguardando_verificacao' e tiver uma URL de comprovante
  IF (NEW.status = 'aguardando_verificacao' AND NEW.comprovante_url IS NOT NULL) THEN
    PERFORM
      net.http_post(
        url := 'https://hbsecidlgqcyeftjngra.supabase.co/functions/v1/validate-pix',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', auth_header
        ),
        body := jsonb_build_object('record', row_to_json(NEW))
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Criar o Gatilho (Trigger)
-- Nota: Usamos AFTER UPDATE pois no App.tsx a reserva primeiro cria o registro e depois faz o UPDATE com a URL da imagem.
DROP TRIGGER IF EXISTS tr_validate_pix_on_upload ON public.rifa_numeros;
CREATE TRIGGER tr_validate_pix_on_upload
  AFTER UPDATE ON public.rifa_numeros
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_validate_pix_ocr();

-- INSTRUÇÕES ADICIONAIS:
-- 1. Vá em Edge Functions no painel do Supabase.
-- 2. Adicione o segredo GEMINI_API_KEY com uma chave válida do Google AI Studio.
-- 3. O sistema passará a validar automaticamente sem que você precise mexer no código do site!
