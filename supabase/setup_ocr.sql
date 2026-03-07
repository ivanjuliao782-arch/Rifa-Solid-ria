
-- SCRIPT DE CONFIGURAÇÃO DO MÓDULO OCR
-- Execute este script no SQL Editor do Supabase para ativar a automação.

-- 1. Habilitar a extensão para chamadas HTTP (se não estiver ativa)
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- 2. Criar a função que chama a Edge Function
CREATE OR REPLACE FUNCTION public.fn_validate_pix_ocr()
RETURNS TRIGGER AS $$
BEGIN
  -- Só dispara se o status for 'aguardando_verificacao' e tiver uma URL de comprovante
  IF (NEW.status = 'aguardando_verificacao' AND NEW.comprovante_url IS NOT NULL) THEN
    PERFORM
      net.http_post(
        url := 'https://hbsecidlgqcyeftjngra.supabase.co/functions/v1/validate-pix',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('request.headers')::jsonb->>'authorization'
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
