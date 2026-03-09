
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

serve(async (req) => {
  try {
    const { record } = await req.json()
    const { id, comprovante_url, numero } = record

    if (!comprovante_url) {
      return new Response(JSON.stringify({ error: 'No image URL' }), { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    // 1. Baixar a imagem do Storage
    // Extrair apenas o nome do arquivo se a URL for completa (public URL)
    let filePath = comprovante_url
    if (comprovante_url.includes('/storage/v1/object/public/comprovantes/')) {
      filePath = comprovante_url.split('/comprovantes/').pop()
    }

    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('comprovantes')
      .download(filePath)

    if (downloadError) throw downloadError

    // 2. Converter para Base64 para o Gemini
    const arrayBuffer = await fileData.arrayBuffer()
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

    // 3. Chamar Gemini para OCR e Validação
    // Usamos o Gemini pois ele é muito mais preciso para ler comprovantes reais (borrados/fotos)
    const prompt = `Analise este comprovante de PIX. Verifique se:
    1. O texto contém a palavra "PIX".
    2. O destino ou chave PIX é "32 99109-6358".
    Responda APENAS "VALIDO" ou "INVALIDO".`

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: "image/jpeg", data: base64Image } }
          ]
        }]
      })
    })

    const result = await response.json()
    const textResult = result.candidates?.[0]?.content?.parts?.[0]?.text?.toUpperCase() || ""

    // 4. Decisão de Status
    let newStatus = 'revisao_admin'
    if (textResult.includes("VALIDO")) {
      newStatus = 'pago'
    }

    // 5. Atualizar o Banco de Dados
    const { error: updateError } = await supabase
      .from('rifa_numeros')
      .update({ status: newStatus })
      .eq('id', id)

    if (updateError) throw updateError

    return new Response(JSON.stringify({ success: true, status: newStatus }), {
      headers: { "Content-Type": "application/json" },
    })

  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
