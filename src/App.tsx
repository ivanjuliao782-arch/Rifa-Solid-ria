/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, ChangeEvent, useEffect, Component, ReactNode } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate
} from 'react-router-dom';
import {
  CheckCircle2,
  MessageCircle,
  Instagram,
  ChevronDown,
  ChevronUp,
  Info,
  ShieldCheck,
  HelpCircle,
  Upload,
  Loader2,
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './lib/supabase';

// Pages
import Login from './Login';
import Admin from './Admin';

// Error Boundary para evitar tela branca em caso de erro
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error('ErrorBoundary capturou erro:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h2 style={{ color: '#dc2626' }}>Ops! Algo deu errado.</h2>
          <p style={{ color: '#666', marginTop: 10 }}>Tente recarregar a página.</p>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 20, padding: '12px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 16, cursor: 'pointer' }}
          >
            Recarregar Página
          </button>
          <p style={{ color: '#999', fontSize: 12, marginTop: 16 }}>{String(this.state.error)}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function LandingPage() {
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [copied, setCopied] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [reservationState, setReservationState] = useState<'idle' | 'reserved' | 'uploading' | 'success'>('idle');
  const [loading, setLoading] = useState(false);
  const [reservedIds, setReservedIds] = useState<string[]>([]);
  const [soldCount, setSoldCount] = useState(0);

  // Nome e telefone mantidos no estado para compatibilidade, mas removidos da UI por pedido do usuário
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pixKey = "32 9109-6358";

  // Buscar contador de números vendidos/reservados
  const fetchStats = async () => {
    if (!supabase) return;
    const { count, error } = await supabase
      .from('rifa_numeros')
      .select('*', { count: 'exact', head: true })
      .or('status.eq.pago,status.eq.aguardando_verificacao');

    if (!error && count !== null) {
      setSoldCount(count);
    }
  };

  useEffect(() => {
    if (!supabase) {
      console.warn('Supabase não configurado. Verifique as variáveis de ambiente.');
      return;
    }
    fetchStats();
    // Realtime para atualizar o contador automaticamente
    const subscription = supabase
      .channel('rifa_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rifa_numeros' }, () => {
        fetchStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const scrollToNumbers = () => {
    const element = document.getElementById('escolha-seu-numero');
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleReserve = async (count: number = 1) => {
    if (!supabase) {
      alert('Erro: Conexão com o banco de dados não configurada.');
      return;
    }

    setLoading(true);
    try {
      // 1. Verificar limite de 20 números por telefone (se informado)
      if (telefone.trim()) {
        const { count: phoneCount, error: phoneError } = await supabase
          .from('rifa_numeros')
          .select('*', { count: 'exact', head: true })
          .eq('telefone', telefone.trim());

        if (!phoneError && phoneCount !== null && phoneCount >= 20) {
          alert('Limite máximo de 20 números por participante atingido.');
          setLoading(false);
          return;
        }
      }

      let numbersToReserve: number[] = [];
      const firstNum = selectedNumbers[0];

      // 1. Pegar números que estão no banco e filtrar disponibilidade no JS
      const { data: allNotLivre } = await supabase
        .from('rifa_numeros')
        .select('numero, status, created_at')
        .neq('status', 'livre');

      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const takenSet = new Set();

      allNotLivre?.forEach(item => {
        const isExpired = item.status === 'reservado' && new Date(item.created_at).getTime() < fiveMinutesAgo;
        if (!isExpired) {
          takenSet.add(item.numero);
        }
      });

      // 2. Definir quais números tentar reservar
      if (count === 0) {
        if (!firstNum || isNaN(firstNum) || firstNum < 1 || firstNum > 2000) {
          alert('Por favor, digite um número válido de 1 a 2000 antes de reservar.');
          setLoading(false);
          return;
        }
        if (takenSet.has(firstNum)) {
          alert('Este número já está reservado ou vendido. Escolha outro!');
          setLoading(false);
          return;
        }
        numbersToReserve = [firstNum];
      } else {
        const available = [];
        for (let i = 1; i <= 2000; i++) {
          if (!takenSet.has(i)) available.push(i);
        }

        if (available.length < count) {
          alert('Não há números disponíveis suficientes. Tente um pacote menor!');
          setLoading(false);
          return;
        }

        numbersToReserve = available.sort(() => Math.random() - 0.5).slice(0, count);
      }

      // 3. Reservar os números (Insert ou Update)
      const successfulIds: string[] = [];
      const successfulNums: number[] = [];

      for (const num of numbersToReserve) {
        // Buscar se já existe algum registro desse número (independente do status)
        const { data: existing, error: selectErr } = await supabase
          .from('rifa_numeros')
          .select('id')
          .eq('numero', num)
          .limit(1)
          .maybeSingle();

        let res;
        let queryError = selectErr;

        if (existing) {
          // Já existe? Atualiza o status e o timestamp (created_at)
          res = await supabase
            .from('rifa_numeros')
            .update({
              status: 'reservado',
              nome: nome || 'Cliente Website',
              telefone: telefone || 'N/A',
              created_at: new Date().toISOString()
            })
            .eq('id', existing.id)
            .select();
        } else {
          // Não existe? Cria um novo
          res = await supabase
            .from('rifa_numeros')
            .insert({
              numero: num,
              status: 'reservado',
              nome: nome || 'Cliente Website',
              telefone: telefone || 'N/A',
              created_at: new Date().toISOString()
            })
            .select();
        }

        if (res.error) {
          queryError = res.error;
        }

        if (res.data && res.data.length > 0) {
          successfulIds.push(res.data[0].id);
          successfulNums.push(res.data[0].numero);
        } else if (queryError) {
          console.error("Supabase Error on Reserve:", queryError);
          // throw the error to be caught by the catch block below
          throw new Error(queryError.message || JSON.stringify(queryError));
        } else if (!res.data || res.data.length === 0) {
          throw new Error('Banco de dados retornou vazio ao reservar, possivelmente bloqueio de segurança.');
        }
      }

      if (successfulNums.length === 0) {
        alert('Houve um problema ao reservar seus números. Tente novamente!');
      } else {
        setReservedIds(successfulIds);
        setSelectedNumbers(successfulNums);
        setReservationState('reserved');
      }
    } catch (error: any) {
      console.error('Erro na reserva:', error);
      alert('Ocorreu um erro ao processar sua reserva. Detalhes: ' + (error.message || JSON.stringify(error)));
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!supabase) {
      alert('Erro: Conexão com o banco de dados não configurada.');
      return;
    }
    const file = e.target.files?.[0];
    if (!file || reservedIds.length === 0) return;

    setLoading(true);
    setReservationState('uploading');

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${reservedIds[0]}-${Math.random()}.${fileExt}`;
      const filePath = `comprovantes/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('comprovantes')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('comprovantes')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('rifa_numeros')
        .update({
          comprovante_url: publicUrl,
          status: 'aguardando_verificacao'
        })
        .in('id', reservedIds);

      if (updateError) throw updateError;

      setReservationState('success');
    } catch (error: any) {
      console.error('Erro no upload:', error);
      alert('Erro ao enviar comprovante: ' + (error.message || 'Erro desconhecido'));
      setReservationState('reserved');
    } finally {
      setLoading(false);
    }
  };

  const copyPix = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(pixKey);
      } else {
        // Fallback para celulares antigos
        const textArea = document.createElement('textarea');
        textArea.value = pixKey;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar:', err);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const faqs = [
    {
      q: "Como sei que é confiável?",
      a: "Somos a Oficina PointCar, oficina estabelecida e conhecida em Matias Barbosa. O sorteio será realizado com base na Loteria Federal, o que garante total transparência e impossibilidade de manipulação."
    },
    {
      q: "Quando será o sorteio?",
      a: "O sorteio está marcado para o dia 05/04/2026. Utilizaremos os números da extração da Loteria Federal desta data para definir os ganhadores."
    },
    {
      q: "Como recebo o prêmio?",
      a: "Entraremos em contato imediatamente com os ganhadores através do WhatsApp ou telefone informado no momento da reserva. O prêmio poderá ser retirado na oficina ou enviado via transportadora (custos de envio a combinar)."
    },
    {
      q: "Posso comprar mais de um número?",
      a: "Sim! Você pode comprar quantos números desejar. Quanto mais números você adquirir, maiores são suas chances de ganhar e mais você ajuda na reconstrução da nossa oficina."
    },
    {
      q: "Como acompanho o resultado?",
      a: "O resultado será divulgado em nossas redes sociais (Instagram e WhatsApp) logo após a apuração da Loteria Federal. Também faremos contato direto com os vencedores."
    },
    {
      q: "O que acontece se todos os números não forem vendidos?",
      a: "O sorteio ocorrerá normalmente na data marcada, independente da quantidade de números vendidos. O compromisso com quem ajudou é nossa prioridade."
    }
  ];

  return (
    <div className="min-h-screen bg-white selection:bg-blue-100 font-sans">
      {/* Floating WhatsApp Support */}
      <a
        href="https://wa.me/553291096358"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-green-500 text-white p-4 rounded-full shadow-2xl hover:bg-green-600 transition-all hover:scale-110 active:scale-95 flex items-center gap-2 group"
      >
        <MessageCircle size={28} />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 ease-in-out whitespace-nowrap font-bold">
          Suporte WhatsApp
        </span>
      </a>

      {/* Container Principal - Max 900px */}
      <main className="max-w-[900px] mx-auto px-6 py-12 flex flex-col gap-24">

        {/* HERO SECTION - IMAGEM DE FUNDO */}
        <section className="relative -mx-6 px-6 py-24 md:py-32 overflow-hidden rounded-b-[3rem] shadow-2xl flex flex-col items-center justify-center text-center min-h-[600px]">
          {/* Background Image */}
          <div
            className="absolute inset-0 z-0"
            style={{
              backgroundImage: 'url("https://i.imgur.com/1LIxDCE.jpg")',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {/* Dark Overlay for Readability */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]"></div>
          </div>

          <div className="relative z-10 flex flex-col gap-8 max-w-3xl">
            <div className="flex flex-col gap-4">
              <span className="text-blue-400 font-bold tracking-[0.3em] uppercase text-xs">Ação Solidária</span>
              <div className="flex flex-col gap-2">
                <h1 className="text-5xl md:text-8xl font-black leading-none text-white tracking-tighter uppercase">
                  Rifa Solidária
                </h1>
                <p className="text-xl md:text-3xl font-medium text-blue-400 italic">
                  reconstrução da oficina PointCar
                </p>
              </div>
              <div className="flex flex-col gap-4 mt-4">
                <div className="text-4xl md:text-7xl font-black text-white tracking-tighter">
                  R$ 120.000.
                </div>
                <p className="text-lg md:text-xl text-gray-200 leading-relaxed font-medium max-w-2xl mx-auto">
                  Foi isso que a enchente levou da nossa oficina. Em poucas horas, anos de trabalho viraram lama.
                </p>
              </div>
            </div>

            <p className="text-base md:text-lg text-gray-300 leading-relaxed max-w-2xl mx-auto">
              A Excel Automotive empresa que acredita em quem trabalha de verdade doou 2 kits de alto desempenho no valor de 700 cada um para nos ajudar a reconstruir. Participe e concorra!.
            </p>

            <div className="flex flex-col gap-6 items-center">
              <button
                onClick={scrollToNumbers}
                className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 px-12 rounded-2xl transition-all shadow-2xl hover:shadow-blue-500/30 transform hover:-translate-y-1 active:scale-95 text-2xl"
              >
                QUERO PARTICIPAR
              </button>
              <div className="flex items-center gap-3 text-white font-bold uppercase tracking-widest text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Bilhetes por apenas R$ 10,00
              </div>
            </div>
          </div>
        </section>

        {/* O QUE VOCÊ PODE GANHAR */}
        <section className="flex flex-col gap-10">
          <div className="text-center flex flex-col gap-2">
            <h2 className="text-3xl font-bold text-gray-900">O Que Você Pode Ganhar</h2>
            <p className="text-gray-600">Serão sorteados 2 Kits de Alta Performance Automotivo.</p>
            <p className="text-sm font-bold text-blue-600 uppercase tracking-wider">Valor estimado de cada kit: R$ 700</p>
            <p className="text-xs text-gray-400">Produtos doados pela Excel Automotive.</p>
          </div>

          <div className="w-full overflow-hidden rounded-2xl shadow-xl border border-gray-100">
            <img
              src="https://i.imgur.com/jfSyjfY.jpeg"
              alt="Kits de Alta Performance Excel Automotive"
              className="w-full h-auto object-cover"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-4">Conteúdo de cada Kit:</h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-gray-700">
              {[
                "2x Aditivo / Água Desmineralizada",
                "2x Aditivo Vermelho (Radiador)",
                "1x Excel Max 9839",
                "1x Excel Max 989",
                "1x Excel MAX 879",
                "1x DPF Cleaner 989",
                "1x Limp Contato 981",
                "1x Excel Lub 978",
                "1x Radiator Flush",
                "1x Super Treatment",
                "1x Max Bio",
                "1x Silicone Automotivo"
              ].map((item, idx) => (
                <li key={idx} className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-8 text-gray-600 text-sm leading-relaxed bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
              São produtos profissionais de altíssima qualidade, utilizados para manutenção automotiva, limpeza técnica, proteção e desempenho superior do motor.
            </p>
          </div>

          <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-4">Para que serve cada produto:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  title: "1️⃣ Aditivo / Água Desmineralizada",
                  qty: "Quantidade: 2",
                  desc: "Utilizada no sistema de arrefecimento do motor, mistura com aditivo de radiador, evita depósitos minerais no sistema e protege radiador e bomba d’água."
                },
                {
                  title: "2️⃣ Aditivo Vermelho (Radiador)",
                  qty: "Quantidade: 2",
                  desc: "Controla a temperatura do motor, evita superaquecimento, protege contra corrosão interna e mantém o sistema de arrefecimento eficiente."
                },
                {
                  title: "3️⃣ Excel Max 9839",
                  qty: "Quantidade: 1",
                  desc: "Limpeza interna do motor, remove depósitos de óleo e ajuda na descarbonização."
                },
                {
                  title: "4️⃣ Excel Max 989",
                  qty: "Quantidade: 1",
                  desc: "Tratamento de combustível, limpeza de sistema de injeção e ajuda na redução de consumo."
                },
                {
                  title: "5️⃣ Excel MAX 879",
                  qty: "Quantidade: 1",
                  desc: "Proteção e lubrificação de peças metálicas, evita ferrugem e reduz atrito em componentes mecânicos."
                },
                {
                  title: "6️⃣ DPF Cleaner 989",
                  qty: "Quantidade: 1",
                  desc: "Limpeza do filtro de partículas (DPF), remove carbonização e melhora fluxo de gases de escape."
                },
                {
                  title: "7️⃣ Limp Contato 981",
                  qty: "Quantidade: 1",
                  desc: "Limpeza de componentes elétricos, remove oxidação e sujeira. Ideal para sensores e conectores."
                },
                {
                  title: "8️⃣ Excel Lub 978",
                  qty: "Quantidade: 1",
                  desc: "Lubrificante multiuso, solta parafusos travados, elimina rangidos e protege contra corrosão."
                },
                {
                  title: "9️⃣ Radiator Flush",
                  qty: "Quantidade: 1",
                  desc: "Limpeza interna do radiador, remove ferrugem e borra, desobstrui canais de circulação."
                },
                {
                  title: "🔟 Super Treatment",
                  qty: "Quantidade: 1",
                  desc: "Aditivo para óleo do motor, reduz desgaste interno e melhora lubrificação."
                },
                {
                  title: "1️⃣1️⃣ Max Bio",
                  qty: "Quantidade: 1",
                  desc: "Limpeza pesada de peças, remove óleo, graxa e sujeira. Produto biodegradável."
                },
                {
                  title: "1️⃣2️⃣ Tubo de Silicone Automotivo",
                  qty: "Quantidade: 1",
                  desc: "Vedação de juntas, selagem de tampas e carcaças. Resistente a alta temperatura."
                }
              ].map((item, idx) => (
                <div key={idx} className="flex flex-col gap-1 p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <h4 className="font-bold text-blue-700">{item.title}</h4>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{item.qty}</p>
                  <p className="text-sm text-gray-600 mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ESCOLHA SEU NÚMERO / RESERVA */}
        <section id="escolha-seu-numero" className="flex flex-col gap-10 bg-blue-50 -mx-6 px-6 py-16 rounded-3xl border border-blue-100">
          <AnimatePresence initial={false}>
            {reservationState === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col gap-10"
              >
                <div className="text-center flex flex-col gap-2">
                  <h2 className="text-3xl font-bold text-gray-900">Escolha Seu Número</h2>
                  <p className="text-xl font-bold text-blue-600">Cada número custa R$ 10</p>

                  {/* Pacotes - Estratégia de Venda */}
                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                    <button
                      onClick={() => handleReserve(1)}
                      className="px-4 py-2 bg-white border border-blue-200 rounded-lg text-sm font-bold text-blue-700 hover:bg-blue-50 transition-all"
                    >
                      1 Número<br /><span className="text-[10px] font-normal text-gray-500">R$ 10</span>
                    </button>
                    <button
                      onClick={() => handleReserve(3)}
                      className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm font-bold text-blue-700 hover:bg-blue-100 transition-all font-mono"
                    >
                      3 Números<br /><span className="text-[10px] font-normal text-blue-500">Mais chances de ganhar</span>
                    </button>
                    <button
                      onClick={() => handleReserve(5)}
                      className="px-4 py-2 bg-blue-600 border border-blue-600 rounded-lg text-sm font-bold text-white hover:bg-blue-700 transition-all shadow-md"
                    >
                      5 Números<br /><span className="text-[10px] font-normal text-blue-100">Pacote mais escolhido</span>
                    </button>
                  </div>

                  {/* Escassez Automática */}
                  {soldCount >= 1600 && (
                    <div className="mt-4 p-2 bg-red-100 text-red-700 text-xs font-bold rounded-lg animate-pulse">
                      ÚLTIMOS NÚMEROS DISPONÍVEIS!
                    </div>
                  )}
                  {soldCount >= 1000 && soldCount < 1600 && (
                    <div className="mt-4 p-2 bg-orange-100 text-orange-700 text-xs font-bold rounded-lg">
                      Metade dos números já foram reservados
                    </div>
                  )}
                </div>

                <div className="max-w-md mx-auto w-full flex flex-col gap-6">
                  <div className="flex flex-col gap-4">
                    {/* Campos Nome e WhatsApp para confirmação */}
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <label htmlFor="nome-input" className="text-sm font-bold text-gray-700 ml-1">Seu nome: <span className="text-gray-400 font-normal">(para confirmação)</span></label>
                        <input
                          id="nome-input"
                          type="text"
                          placeholder="Ex: João Silva"
                          value={nome}
                          onChange={(e) => setNome(e.target.value)}
                          disabled={loading}
                          className="w-full p-4 rounded-xl border-2 border-blue-200 focus:border-blue-500 focus:outline-none text-base transition-all bg-white shadow-sm disabled:opacity-50"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label htmlFor="tel-input" className="text-sm font-bold text-gray-700 ml-1">Seu WhatsApp: <span className="text-gray-400 font-normal">(para receber confirmação)</span></label>
                        <input
                          id="tel-input"
                          type="tel"
                          placeholder="Ex: 32 99999-0000"
                          value={telefone}
                          onChange={(e) => setTelefone(e.target.value)}
                          disabled={loading}
                          className="w-full p-4 rounded-xl border-2 border-blue-200 focus:border-blue-500 focus:outline-none text-base transition-all bg-white shadow-sm disabled:opacity-50"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="number-input" className="text-sm font-bold text-gray-700 ml-1">Digite o número desejado:</label>
                      <input
                        id="number-input"
                        type="number"
                        min="1"
                        max="2000"
                        placeholder="Digite seu número (1 a 2000)"
                        value={selectedNumbers[0] || ''}
                        onChange={(e) => setSelectedNumbers([parseInt(e.target.value)])}
                        disabled={loading}
                        className="w-full p-5 rounded-xl border-2 border-blue-200 focus:border-blue-500 focus:outline-none text-lg transition-all bg-white shadow-sm disabled:opacity-50"
                      />
                    </div>
                    {/* Chave Pix visível antes da reserva */}
                    <div className="text-center p-3 bg-blue-100 rounded-xl border border-blue-200 shadow-sm">
                      <p className="text-xs font-bold text-blue-800 uppercase tracking-widest mb-1">Chave Pix (Celular):</p>
                      <p className="text-2xl font-black text-blue-900 font-mono tracking-tighter">{pixKey}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleReserve(0)}
                    disabled={loading}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-5 px-10 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 active:scale-95 text-xl flex items-center justify-center gap-2 disabled:opacity-70 disabled:transform-none"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : null}
                    RESERVAR NÚMERO
                  </button>

                  {/* Bloco de Informações do Original */}
                  <div className="bg-white p-6 rounded-xl border border-blue-100 shadow-sm flex flex-col gap-4">
                    <div className="flex gap-4 items-start">
                      <Info className="text-blue-500 shrink-0 mt-1" size={24} />
                      <p className="text-sm text-gray-600 leading-relaxed">
                        <strong>Instrução:</strong> Escolha um número disponível. Após a reserva, você terá acesso aos dados para pagamento e envio do comprovante.
                      </p>
                    </div>

                    <div className="pt-2 border-t border-gray-100">
                      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(soldCount / 2000) * 100}%` }}
                          transition={{ duration: 2, ease: "easeOut" }}
                          className="bg-blue-600 h-full"
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-400 uppercase tracking-widest font-bold mt-2">
                        <span>Início</span>
                        <span>Números vendidos: {soldCount} / 2000</span>
                        <span>{((soldCount / 2000) * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Nota solicitada no final da seção */}
                  <p className="text-center font-bold text-gray-500 text-sm italic">
                    São apenas 2.000 números disponíveis.
                  </p>
                </div>
              </motion.div>
            )}

            {(reservationState === 'reserved' || reservationState === 'uploading') && (
              <motion.div
                key="reserved"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col gap-8 max-w-lg mx-auto w-full bg-white p-8 rounded-3xl shadow-xl border border-blue-100"
              >
                <div className="text-center flex flex-col gap-3">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                    <CheckCircle2 size={32} />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedNumbers.length > 1 ? `${selectedNumbers.length} Números Reservados!` : `Número ${selectedNumbers[0]} Reservado!`}
                  </h2>
                  <p className="text-gray-600">Agora realize o pagamento para confirmar sua participação.</p>
                  <p className="text-sm font-bold text-blue-600">Seus números: {selectedNumbers.join(', ')}</p>
                </div>

                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Valor Total</span>
                    <span className="text-2xl font-bold text-blue-600">R$ {selectedNumbers.length * 10},00</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Chave PIX (Celular)</span>
                    <div className="flex gap-2">
                      <code className="flex-1 bg-white p-3 rounded-lg border border-blue-200 text-blue-800 font-mono text-sm break-all">
                        {pixKey}
                      </code>
                      <button
                        onClick={copyPix}
                        className={`p-3 rounded-lg transition-all flex items-center gap-2 ${copied ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                        title="Copiar Chave"
                      >
                        {copied ? <CheckCircle2 size={20} /> : <Copy size={20} />}
                        {copied && <span className="text-xs font-bold">Copiado!</span>}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <Upload size={20} className="text-blue-500" />
                    Enviar Comprovante
                  </h3>
                  <p className="text-sm text-gray-600">Após o pagamento, anexe o comprovante (Imagem ou PDF) abaixo:</p>

                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                  />

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={reservationState === 'uploading'}
                    className="w-full border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/50 p-8 rounded-xl flex flex-col items-center gap-3 transition-all group disabled:opacity-50"
                  >
                    {reservationState === 'uploading' ? (
                      <Loader2 className="animate-spin text-blue-600" size={32} />
                    ) : (
                      <Upload className="text-blue-400 group-hover:text-blue-600 transition-colors" size={32} />
                    )}
                    <span className="font-bold text-blue-600">
                      {reservationState === 'uploading' ? 'Enviando...' : 'Clique para selecionar arquivo'}
                    </span>
                    <span className="text-xs text-gray-400">PNG, JPG ou PDF (Máx 5MB)</span>
                  </button>
                </div>
              </motion.div>
            )}

            {reservationState === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col gap-6 text-center max-w-lg mx-auto w-full bg-white p-10 rounded-3xl shadow-xl border border-green-100"
              >
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 size={48} />
                </div>
                <h2 className="text-3xl font-bold text-gray-900">Sucesso!</h2>
                <p className="text-gray-600 text-lg">
                  Seu comprovante foi enviado para análise. Em breve seus números <strong>{selectedNumbers.join(', ')}</strong> serão confirmados!
                </p>

                {/* Botão de Compartilhamento Solicitado */}
                <div className="flex flex-col gap-3 mt-4">
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Compartilhe e nos ajude:</p>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`Acabei de participar dessa rifa de R$10 para ajudar a levantar uma oficina 🔧\n\nQuem quiser participar também:\n${window.location.href}\n\nEscolha seu número e boa sorte 🍀`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-green-100 text-green-700 px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-green-200 transition-all border border-green-200 shadow-sm"
                  >
                    <MessageCircle size={24} />
                    Compartilhar no WhatsApp
                  </a>
                </div>

                <button
                  onClick={() => {
                    setReservationState('idle');
                    setSelectedNumbers([]);
                    setNome('');
                    setTelefone('');
                  }}
                  className="mt-4 text-blue-600 font-bold hover:underline"
                >
                  Reservar outro número
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* COMO FUNCIONA */}
        <section className="flex flex-col gap-12">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Como Funciona</h2>
            <div className="inline-block bg-red-100 text-red-700 px-6 py-2 rounded-full font-bold text-sm uppercase tracking-widest mb-8">
              APENAS 2.000 NÚMEROS DISPONÍVEIS
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8">
            <div className="flex flex-col gap-6">
              {[
                { step: "01", title: "Escolha seu número", desc: "Selecione um número de 1 a 2.000 disponível na rifa." },
                { step: "02", title: "Faça o pagamento via PIX", desc: "Realize o pagamento de R$ 10 por número escolhido." },
                { step: "03", title: "Envie o comprovante", desc: "Mande o print do pagamento para nosso WhatsApp oficial." },
                { step: "04", title: "Receba a confirmação", desc: "Validaremos seu número e enviaremos seu comprovante de participação." },
                { step: "05", title: "Acompanhe o sorteio oficial", desc: "O sorteio será realizado pela Loteria Federal no dia 05/04/2026." }
              ].map((item, idx) => (
                <div key={idx} className="flex gap-6 items-start">
                  <div className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold shrink-0 shadow-md">
                    {item.step}
                  </div>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-xl font-bold text-gray-900">{item.title}</h3>
                    <p className="text-gray-600 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-gray-50 p-8 rounded-2xl border border-gray-100 flex flex-col gap-4">
              <h4 className="font-bold text-gray-800">Informações Adicionais:</h4>
              <ul className="flex flex-col gap-3 text-gray-600 text-sm">
                <li className="flex gap-2"><strong>•</strong> Pagamento via PIX manual</li>
                <li className="flex gap-2"><strong>•</strong> Confirmação após envio do comprovante</li>
                <li className="flex gap-2"><strong>•</strong> Sorteio pela Loteria Federal</li>
                <li className="flex gap-2"><strong>•</strong> Divulgação pública do resultado</li>
              </ul>
            </div>
          </div>
        </section>

        {/* COMPROMISSO E TRANSPARÊNCIA */}
        <section className="flex flex-col gap-10 bg-gray-900 text-white -mx-6 px-6 py-16 rounded-3xl shadow-2xl">
          <div className="text-center flex flex-col gap-2">
            <ShieldCheck className="mx-auto text-green-400 mb-2" size={48} />
            <h2 className="text-3xl font-bold">Compromisso e Transparência</h2>
            <p className="text-gray-400">Nossa oficina é nossa vida, e sua ajuda será tratada com o máximo respeito.</p>
          </div>

          <ul className="grid grid-cols-1 gap-6 max-w-lg mx-auto w-full">
            {[
              "Sorteio público pela Loteria Federal",
              "Divulgação oficial do resultado",
              "Prestação de contas da arrecadação",
              "Compromisso com honestidade",
              "Transparência total em cada etapa"
            ].map((item, idx) => (
              <li key={idx} className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
                <CheckCircle2 className="text-green-400 shrink-0" size={24} />
                <span className="font-medium">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* FAQ */}
        <section className="flex flex-col gap-10">
          <div className="text-center flex flex-col gap-2">
            <HelpCircle className="mx-auto text-blue-500 mb-2" size={48} />
            <h2 className="text-3xl font-bold text-gray-900">Dúvidas Frequentes</h2>
            <p className="text-gray-600">Tudo o que você precisa saber para participar.</p>
          </div>

          <div className="flex flex-col gap-4">
            {faqs.map((faq, idx) => (
              <div key={idx} className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full p-6 text-left flex justify-between items-center bg-white hover:bg-gray-50 transition-colors"
                >
                  <span className="font-bold text-gray-800">{faq.q}</span>
                  {openFaq === idx ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
                </button>
                <AnimatePresence>
                  {openFaq === idx && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-6 pt-0 text-gray-600 leading-relaxed bg-gray-50/50">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </section>

        {/* RODAPÉ */}
        <footer className="flex flex-col gap-12 pt-12 border-t border-gray-100 text-center">
          <div className="flex flex-col gap-4">
            <h3 className="text-2xl font-bold text-gray-900">Oficina PointCar</h3>
            <p className="text-gray-600">Matias Barbosa – MG</p>
          </div>

          <div className="flex flex-col md:flex-row gap-8 justify-center items-center">
            <a href="https://wa.me/553291096358" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-green-600 font-bold hover:underline">
              <MessageCircle size={24} />
              32 9109-6358 (João)
            </a>
            <a href="https://wa.me/553299913864" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-green-600 font-bold hover:underline">
              <MessageCircle size={24} />
              32 9991-3864 (Saulo)
            </a>
          </div>

          <div className="flex flex-col gap-6 items-center">
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Compartilhe essa causa:</p>
            <a
              href={`https://wa.me/?text=${encodeURIComponent("Olá! Estou participando da Rifa Solidária da Oficina PointCar para ajudar na reconstrução após a enchente. Participe você também e concorra a prêmios! Veja aqui: " + window.location.href)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-green-100 text-green-700 px-8 py-4 rounded-2xl font-bold flex items-center gap-3 hover:bg-green-200 transition-all border border-green-200"
            >
              <MessageCircle size={24} />
              Compartilhar no WhatsApp
            </a>
          </div>

          <div className="max-w-md mx-auto">
            <p className="text-xl font-bold text-gray-900 leading-tight">
              Obrigado por nos ajudar a reconstruir esse sonho. Sua solidariedade é o que nos mantém de pé.
            </p>
          </div>

          <div className="text-xs text-gray-400 pb-2">
            © 2026 Oficina PointCar. Todos os direitos reservados. Sorteio beneficente.
          </div>
          <div className="text-[10px] text-gray-700 pb-8 uppercase tracking-[0.2em] font-medium flex flex-col items-center gap-1">
            <span>Automation Engine</span>
            <span>Developed by Shockwave</span>
            <a
              href="https://instagram.com/shockwave.ia"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-gray-700 hover:text-blue-600 transition-colors mt-1"
            >
              <Instagram size={14} />
              <span>@shockwave.ia</span>
            </a>
          </div>
        </footer>

      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}
