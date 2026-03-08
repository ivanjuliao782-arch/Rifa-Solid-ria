import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { useNavigate } from 'react-router-dom';
import { 
  Loader2, 
  LogOut, 
  Download, 
  Eye, 
  CheckCircle2, 
  XCircle, 
  LayoutDashboard, 
  Table as TableIcon,
  Search,
  RefreshCw,
  ExternalLink,
  Instagram,
  MessageCircle
} from 'lucide-react';

interface RifaNumero {
  id: string;
  numero: number;
  nome: string | null;
  telefone: string | null;
  status: 'livre' | 'reservado' | 'pago' | 'aguardando_verificacao';
  comprovante_url: string | null;
  created_at: string;
}

export default function Admin() {
  const [data, setData] = useState<RifaNumero[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const stats = {
    vendidos: data.filter(d => d.status === 'pago').length,
    reservados: data.filter(d => d.status === 'reservado' || d.status === 'aguardando_verificacao').length,
    livres: 2001 - data.filter(d => d.status !== 'livre').length,
  };

  const fetchData = async () => {
    setLoading(true);
    const { data: rifas, error } = await supabase
      .from('rifa_numeros')
      .select('*')
      .order('numero', { ascending: true });

    if (!error) setData(rifas || []);
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate('/login');
      setSession(session);
    });

    fetchData();

    const subscription = supabase
      .channel('admin_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rifa_numeros' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [navigate]);

  const handleStatusChange = async (id: string, newStatus: string, clearFields = false) => {
    const updateData: any = { status: newStatus };
    if (clearFields) {
      updateData.nome = null;
      updateData.telefone = null;
      updateData.comprovante_url = null;
    }

    const { error } = await supabase
      .from('rifa_numeros')
      .update(updateData)
      .eq('id', id);

    if (error) alert('Erro ao atualizar: ' + error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const exportCSV = () => {
    const headers = ['Número', 'Nome', 'Telefone', 'Status', 'Data'];
    const rows = data.map(d => [
      d.numero,
      d.nome || '-',
      d.telefone || '-',
      d.status,
      new Date(d.created_at).toLocaleString('pt-BR')
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `rifa_vendas_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredData = data.filter(d => 
    d.numero.toString().includes(search) || 
    (d.nome?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (d.telefone || '').includes(search)
  );

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col">
        <div className="p-6 border-b border-gray-200 flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <LayoutDashboard className="text-white" size={20} />
          </div>
          <span className="font-bold text-gray-900 text-lg tracking-tight">Painel Admin</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <div className="bg-blue-50 text-blue-700 p-3 rounded-xl flex items-center gap-3 font-bold">
            <TableIcon size={20} />
            Gerenciar Números
          </div>
        </nav>
        <div className="p-4 border-t border-gray-200">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-3 text-red-600 hover:bg-red-50 rounded-xl transition-all font-bold"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <div className="flex items-center gap-4">
            <button 
              onClick={exportCSV}
              className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-800 transition-all shadow-md active:scale-95"
            >
              <Download size={18} />
              Exportar CSV
            </button>
            <button 
              onClick={fetchData}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-all"
              title="Recarregar"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="px-3 pt-1 pb-0 md:px-8 md:pt-8 grid grid-cols-3 gap-2 md:gap-6">
          <div className="bg-white p-1.5 md:p-6 rounded-lg md:rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-0.5 md:mb-4">
              <span className="text-[9px] md:text-sm font-bold text-gray-400 uppercase tracking-wider">Vendidos</span>
              <div className="bg-green-100 p-1 md:p-2 rounded-lg text-green-600">
                <CheckCircle2 size={16} className="block md:hidden" /><CheckCircle2 size={24} className="hidden md:block" />
              </div>
            </div>
            <p className="text-2xl md:text-4xl font-black text-gray-900">{stats.vendidos}</p>
          </div>
          <div className="bg-white p-1.5 md:p-6 rounded-lg md:rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-0.5 md:mb-4">
              <span className="text-[9px] md:text-sm font-bold text-gray-400 uppercase tracking-wider">Reservados</span>
              <div className="bg-amber-100 p-1 md:p-2 rounded-lg text-amber-600">
                <Loader2 size={16} className="block md:hidden" /><Loader2 size={24} className="hidden md:block" />
              </div>
            </div>
            <p className="text-2xl md:text-4xl font-black text-gray-900">{stats.reservados}</p>
          </div>
          <div className="bg-white p-1.5 md:p-6 rounded-lg md:rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-0.5 md:mb-4">
              <span className="text-[9px] md:text-sm font-bold text-gray-400 uppercase tracking-wider">Livres</span>
              <div className="bg-blue-100 p-1 md:p-2 rounded-lg text-blue-600">
                <TableIcon size={16} className="block md:hidden" /><TableIcon size={24} className="hidden md:block" />
              </div>
            </div>
            <p className="text-2xl md:text-4xl font-black text-gray-900">{stats.livres}</p>
          </div>
        </div>

        {/* Table Section */}
        <div className="px-3 py-1 md:p-8 flex-1 flex flex-col overflow-hidden">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col flex-1">
            <div className="p-2 md:p-4 border-b border-gray-200 bg-gray-50/50 flex items-center gap-4 text-xs md:text-base">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text"
                  placeholder="Buscar por número, nome ou telefone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all text-sm"
                />
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase">Total: {filteredData.length}</span>
            </div>

            <div className="flex-1 overflow-auto">
              {/* MOBILE CARD VIEW */}
              <div className="md:hidden flex flex-col divide-y divide-gray-100">
                {filteredData.map((d) => (
                  <div key={d.id + '_card'} className="p-4 flex flex-col gap-2 bg-white">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-gray-900 text-lg">#{d.numero}</span>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                        d.status === 'pago' ? 'bg-green-100 text-green-700' :
                        d.status === 'aguardando_verificacao' ? 'bg-amber-100 text-amber-700' :
                        d.status === 'reservado' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                      }`}>{d.status.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="text-sm text-gray-700"><span className="font-bold">Nome:</span> {d.nome || '-'}</div>
                    <div className="text-sm text-gray-700"><span className="font-bold">WhatsApp:</span> {d.telefone || '-'}</div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {d.comprovante_url && (
                        <a href={d.comprovante_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 font-bold text-xs bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
                          Ver Comprovante
                        </a>
                      )}
                      {d.status === 'pago' && d.telefone && d.telefone !== 'N/A' && (
                        <a
                          href={`https://web.whatsapp.com/send?phone=55${d.telefone.replace(/\D/g, '')}&text=${encodeURIComponent(`Olá ${d.nome || 'participante'}!\n\nSeu COMPROVANTE DE PAGAMENTO foi CONFIRMADO EM NOSSO SISTEMA 🍀\n\nNúmero reservado: ${d.numero}\n\nBoa sorte no sorteio! 🍀\n\nCompartilhe com seus amigos:\nhttps://rifa-solid-ria-three.vercel.app/`)}&app_absent=1`}
                          target="_self" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 bg-green-600 text-white font-bold text-xs px-3 py-2 rounded-lg"
                        >
                          💬 Enviar WhatsApp
                        </a>
                      )}
                      {d.status !== 'pago' && d.status !== 'livre' && (
                        <button onClick={() => handleStatusChange(d.id, 'pago')} className="inline-flex items-center gap-1 bg-green-50 text-green-700 font-bold text-xs px-3 py-2 rounded-lg border border-green-200">
                          ✅ Aprovar
                        </button>
                      )}
                      {d.status !== 'livre' && (
                        <button onClick={() => handleStatusChange(d.id, 'livre', true)} className="inline-flex items-center gap-1 bg-red-50 text-red-600 font-bold text-xs px-3 py-2 rounded-lg border border-red-200">
                          ❌ Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {filteredData.length === 0 && !loading && (
                  <div className="p-8 text-center text-gray-400">Nenhum registro encontrado.</div>
                )}
              </div>
              <div className="hidden md:block">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Número</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Nome</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Telefone</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Comprovante</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredData.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50/50 transition-all">
                      <td className="px-6 py-4 font-black text-gray-900"># {d.numero}</td>
                      <td className="px-6 py-4 text-gray-600 text-sm font-medium">{d.nome || '-'}</td>
                      <td className="px-6 py-4 text-gray-600 text-sm font-medium">{d.telefone || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                          d.status === 'pago' ? 'bg-green-100 text-green-700' :
                          d.status === 'aguardando_verificacao' ? 'bg-amber-100 text-amber-700' :
                          d.status === 'reservado' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {d.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {d.comprovante_url ? (
                          <a 
                            href={d.comprovante_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold text-xs"
                          >
                            <Eye size={14} />
                            Ver Imagem
                            <ExternalLink size={12} />
                          </a>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {d.status === 'pago' && d.telefone && d.telefone !== 'N/A' && (
                            <a
                              href={`https://web.whatsapp.com/send?phone=55${d.telefone.replace(/\D/g, '')}&text=${encodeURIComponent(`Olá ${d.nome || 'participante'}!\n\nSeu COMPROVANTE DE PAGAMENTO foi CONFIRMADO EM NOSSO SISTEMA 🍀\n\nNúmero reservado: ${d.numero}\n\nBoa sorte no sorteio! 🍀\n\nCompartilhe com seus amigos:\nhttps://rifa-solid-ria-three.vercel.app/`)}&app_absent=1`}
                              target="_self"
                              rel="noopener noreferrer"
                              className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-all"
                              title="Enviar Confirmação WhatsApp"
                            >
                              <MessageCircle size={18} />
                            </a>
                          )}
                          {d.status !== 'pago' && d.status !== 'livre' && (
                            <button 
                              onClick={() => handleStatusChange(d.id, 'pago')}
                              className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-all"
                              title="Confirmar Pagamento"
                            >
                              <CheckCircle2 size={18} />
                            </button>
                          )}
                          {d.status !== 'livre' && (
                            <button 
                              onClick={() => handleStatusChange(d.id, 'livre', true)}
                              className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-all"
                              title="Cancelar Reserva"
                            >
                              <XCircle size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredData.length === 0 && !loading && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                        Nenhum registro encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <footer className="px-8 pb-6 text-center">
          <div className="text-[10px] text-gray-700 uppercase tracking-[0.2em] font-medium flex flex-col items-center gap-1">
            <span>Automation Engine</span>
            <a 
              href="https://instagram.com/shockwave.ia" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-blue-600 transition-colors normal-case"
            >
              <Instagram size={12} />
              Developed by Shockwave (@shockwave.ia)
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
