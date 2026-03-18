import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts"
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

serve(async (req) => {
  try {
    const { record } = await req.json()
    const { id, comprovante_url, numero } = record

    console.log(`[OCR] Processando Rifa #${numero}`)

    if (!comprovante_url) return new Response(JSON.stringify({ error: 'No URL' }), { status: 400 })

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    // 1. Download image
    let filePath = comprovante_url.includes('/public/comprovantes/')
      ? comprovante_url.split('/comprovantes/').pop()
      : comprovante_url

    const { data: fileData, error: dlErr } = await supabase.storage.from('comprovantes').download(filePath)
    if (dlErr) throw dlErr

    // 2. Base64
    const arrayBuffer = await fileData.arrayBuffer()
    const base64Image = encode(new Uint8Array(arrayBuffer))

    // 3. Gemini Prompt - CONFIGURAÇÃO FINAL DE SEGURANÇA
    const prompt = `Analise este comprovante de PIX com ATENÇÃO TOTAL AOS DETALHES.
    
    CRITÉRIOS OBRIGATÓRIOS PARA "VALIDO":
    1. FAVORECIDO: O nome deve ser "JOAO CARLOS CESCA IRANI DA SILVA" (ou variações próximas como João Carlos Cesca).
    2. CNPJ: Deve ser "50.958.484/0001-54".
    3. VALOR: Deve ser claramente visível e compatível com R$ 10,00 (ou múltiplos de 10).
    4. DATA/HORA: O pagamento deve ter sido feito HOJE ou em data recente (Março ou Abril de 2026). (Nota: 21/04/2026 é a data do SORTEIO, os pagamentos ocorrem antes disso).
    5. AUTENTICIDADE: Não pode haver sinais de edição, montagem, rasuras ou ser uma imagem genérica.

    REGRAS DE RESPOSTA:
    - Se encontrar o Nome e o CNPJ corretos, e o valor/data baterem, responda exatamente: VALIDO
    - Se o nome/CNPJ estiverem errados, ou houver suspeita de fraude, responda: INVALIDO

    IMPORTANTE: Responda apenas UMA PALAVRA. Na dúvida, barre.`

    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: base64Image } }] }]
      })
    })

    const result = await aiRes.json()
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.toUpperCase().trim() || ""
    console.log(`[AI] Rifa #${numero}: ${text}`)

    const newStatus = text === "VALIDO" ? 'pago' : 'revisao_admin'

    await supabase.from('rifa_numeros').update({ status: newStatus }).eq('id', id)

    return new Response(JSON.stringify({ success: true, status: newStatus, raw: text }), { status: 200 })

  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
