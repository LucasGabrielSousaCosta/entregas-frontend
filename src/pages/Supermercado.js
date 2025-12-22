import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap, Popup } from 'react-leaflet';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// --- CONFIGURAÇÃO DE ÍCONES (IGUAL AO CLIENTE) ---
const supermercadoIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/608/608828.png',
    iconSize: [40, 40], iconAnchor: [20, 40], popupAnchor: [0, -40]
});

// --- COMPONENTES AUXILIARES ---
function MapPicker({ isActive, onPick }) {
    useMapEvents({
        click(e) {
            if (isActive) onPick(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

function RecenterMap({ position }) {
    const map = useMap();
    useEffect(() => {
        if (position) map.setView(position, 15);
    }, [position, map]);
    return null;
}

const Supermercado = () => {
    // Estados de Dados
    const [estoque, setEstoque] = useState([]);
    const [todosProdutos, setTodosProdutos] = useState([]);
    const [pedidosPendentes, setPedidosPendentes] = useState([]);
    const [minhaPosicao, setMinhaPosicao] = useState(null);

    // Estados de UI
    const [abaAtiva, setAbaAtiva] = useState('estoque'); 
    const [exibirForm, setExibirForm] = useState(false);
    const [modoMapa, setModoMapa] = useState(false);
    const [filtroNome, setFiltroNome] = useState('');
    const [sugestoes, setSugestoes] = useState([]);
    const [editandoId, setEditandoId] = useState(null);

    // Estados do Formulário
    const [produtoSelecionado, setProdutoSelecionado] = useState(null);
    const [preco, setPreco] = useState('');
    const [quantidade, setQuantidade] = useState(1);

    const apiBase = 'https://entregas-hbqy.onrender.com/api';

    // --- CARREGAMENTO DE DADOS ---
    const carregarDados = useCallback(() => {
        carregarEstoque();
        carregarProdutosGlobais();
        carregarPerfil();
        carregarPedidos();
    }, []);

    useEffect(() => {
        carregarDados();
        const interval = setInterval(carregarPedidos, 10000);
        return () => clearInterval(interval);
    }, [carregarDados]);

    const carregarProdutosGlobais = async () => {
        try {
            const res = await axios.get(`${apiBase}/produto`, { withCredentials: true });
            setTodosProdutos(res.data);
        } catch (err) { console.error(err); }
    };

    const carregarEstoque = async () => {
        try {
            const res = await axios.get(`${apiBase}/supermercadoproduto/meu-estoque`, { withCredentials: true });
            setEstoque(res.data);
        } catch (err) { console.error(err); }
    };

    const carregarPedidos = async () => {
        try {
            const res = await axios.get(`${apiBase}/Pedido/pendentes`, { withCredentials: true });
            setPedidosPendentes(res.data);
        } catch (err) { console.error(err); }
    };

    const carregarPerfil = async () => {
        try {
            const res = await axios.get(`${apiBase}/supermercado/dados-loja`, { withCredentials: true });
            if (res.data.localizacao) {
                const [lng, lat] = res.data.localizacao.split(',').map(Number);
                if (!isNaN(lat)) setMinhaPosicao([lat, lng]);
            }
        } catch (err) { console.error(err); }
    };

    const prepararEdicao = (item) => {
        setExibirForm(true);
        setEditandoId(item.produtoId);
        setProdutoSelecionado({ id: item.produtoId, nome: item.nomeProduto });
        setFiltroNome(item.nomeProduto);
        setPreco(item.precoVenda);
        setQuantidade(item.quantEstoque);
    };

    // --- AÇÕES ---
    const handleAprovarPedido = async (id) => {
        try {
            await axios.post(`${apiBase}/Supermercado/aprovar/${id}`, {}, { withCredentials: true });
            alert(`Pedido #${id} autorizado!`);
            carregarPedidos();
        } catch (err) { alert("Erro ao autorizar."); }
    };

    const handleSalvarVinculo = async () => {
        if (!produtoSelecionado) return alert("Selecione um produto!");
        
        const payload = {
            produtoId: parseInt(produtoSelecionado.id),
            quantEstoque: parseInt(quantidade),
            precoVenda: parseFloat(preco)
        };

        try {
            if (editandoId) {
                // Se tem um ID em edição, faz PUT
                await axios.put(`${apiBase}/supermercadoproduto/${editandoId}`, payload, { withCredentials: true });
            } else {
                // Caso contrário, faz POST (Novo)
                await axios.post(`${apiBase}/supermercadoproduto`, payload, { withCredentials: true });
            }
            
            alert(editandoId ? "Estoque atualizado!" : "Produto adicionado!");
            resetarForm();
            setEditandoId(null);
            carregarEstoque();
        } catch (err) {
            alert(err.response?.data || "Erro ao salvar.");
        }
    };

    const handleUpdateLocalizacao = async (lat, lng) => {
        try {
            await axios.patch(`${apiBase}/account/update-location`, JSON.stringify(`${lng}, ${lat}`), {
                headers: { 'Content-Type': 'application/json' }, withCredentials: true
            });
            setMinhaPosicao([lat, lng]);
            setModoMapa(false);
            alert("Localização da loja atualizada!");
        } catch (err) { alert("Erro ao salvar."); }
    };

    const handleRemoverProduto = async (produtoId) => {
        if (!window.confirm("Deseja remover este produto do seu estoque?")) return;
        try {
            await axios.delete(`${apiBase}/supermercadoproduto/${produtoId}`, { withCredentials: true });
            alert("Produto removido!");
            carregarEstoque();
        } catch (err) {
            alert(err.response?.data || "Erro ao remover.");
        }
    };

    const resetarForm = () => {
        setExibirForm(false);
        setFiltroNome('');
        setSugestoes([]);
        setProdutoSelecionado(null);
        setPreco('');
        setQuantidade(1);
    };

    return (
        <div style={styles.pageContainer}>
            {/* MENU SUPERIOR (PADRÃO APP) */}
            <div style={styles.topNav}>
                <button onClick={() => setAbaAtiva('estoque')} style={abaAtiva === 'estoque' ? styles.navBtnActive : styles.navBtn}>📦 Estoque</button>
                <button onClick={() => setAbaAtiva('pedidos')} style={abaAtiva === 'pedidos' ? styles.navBtnActive : styles.navBtn}>🔔 Pedidos ({pedidosPendentes.length})</button>
                <button onClick={() => setAbaAtiva('mapa')} style={abaAtiva === 'mapa' ? styles.navBtnActive : styles.navBtn}>📍 Minha Loja</button>
            </div>

            <div style={styles.contentWrapper}>
                {abaAtiva === 'mapa' ? (
                    <div style={{height: '100%', position: 'relative'}}>
                        <MapContainer center={minhaPosicao || [-16.68, -49.25]} zoom={15} style={{ height: '100%', width: '100%' }}>
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            <RecenterMap position={minhaPosicao} />
                            <MapPicker isActive={modoMapa} onPick={handleUpdateLocalizacao} />
                            {minhaPosicao && <Marker position={minhaPosicao} icon={supermercadoIcon}><Popup>Minha Loja</Popup></Marker>}
                        </MapContainer>
                        
                        <div style={styles.mapFloatingOverlay}>
                            <button 
                                onClick={() => setModoMapa(!modoMapa)} 
                                style={{...styles.mainBtn, backgroundColor: modoMapa ? '#ff4d4d' : '#000'}}
                            >
                                {modoMapa ? "Clique no mapa para salvar" : "Alterar Localização da Loja"}
                            </button>
                        </div>
                    </div>
                ) : abaAtiva === 'estoque' ? (
                    <div style={styles.scrollList}>
                        <div style={styles.headerWithAction}>
                            <h2>Meu Inventário</h2>
                            <button onClick={() => setExibirForm(!exibirForm)} style={styles.addBtnLarge}>{exibirForm ? '✕' : '+ Novo Produto'}</button>
                        </div>

                        {exibirForm && (
                            <div style={styles.modernForm}>
                                <h3>{editandoId ? 'Editar Produto' : 'Vincular Novo Produto'}</h3>
                                
                                {/* Container relativo para o autocomplete */}
                                <div style={{ position: 'relative', marginBottom: '10px' }}>
                                    <input 
                                        placeholder="Pesquisar no catálogo global..." 
                                        style={{...styles.modernInput, backgroundColor: editandoId ? '#f0f0f0' : '#fff'}} 
                                        value={filtroNome}
                                        disabled={!!editandoId} 
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            setFiltroNome(v);
                                            if (v.trim() !== '' && !editandoId) {
                                                const filtrados = todosProdutos.filter(p => 
                                                    p.nome.toLowerCase().includes(v.toLowerCase())
                                                );
                                                setSugestoes(filtrados);
                                            } else {
                                                setSugestoes([]);
                                            }
                                        }}
                                    />

                                    {/* LISTA DE SUGESTÕES (O que estava faltando) */}
                                    {sugestoes.length > 0 && !editandoId && (
                                        <div style={styles.suggestionBox}>
                                            {sugestoes.slice(0, 5).map(p => (
                                                <div 
                                                    key={p.id} 
                                                    style={styles.suggestionItem} 
                                                    onClick={() => { 
                                                        setProdutoSelecionado(p); 
                                                        setFiltroNome(p.nome); 
                                                        setSugestoes([]); 
                                                    }}
                                                >
                                                    {p.nome}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Inputs de Preço e Quantidade */}
                                <div style={{ display: 'flex', gap: '10px', marginTop: '10px', marginBottom: '15px' }}>
                                    <div style={{flex: 1}}>
                                        <label style={{fontSize: '12px', color: '#666'}}>Quantidade</label>
                                        <input 
                                            type="number" 
                                            style={styles.modernInput} 
                                            value={quantidade} 
                                            onChange={e => setQuantidade(e.target.value)} 
                                        />
                                    </div>
                                    <div style={{flex: 1}}>
                                        <label style={{fontSize: '12px', color: '#666'}}>Preço (R$)</label>
                                        <input 
                                            type="number" 
                                            style={styles.modernInput} 
                                            value={preco} 
                                            onChange={e => setPreco(e.target.value)} 
                                        />
                                    </div>
                                </div>

                                {/* Botões de Ação */}
                                <div style={{display:'flex', gap: '10px'}}>
                                    <button style={styles.finishBtn} onClick={handleSalvarVinculo}>
                                        {editandoId ? 'Salvar Alterações' : 'Vincular ao Estoque'}
                                    </button>
                                    {editandoId && (
                                        <button 
                                            style={{...styles.finishBtn, backgroundColor: '#888'}} 
                                            onClick={() => { resetarForm(); setEditandoId(null); }}
                                        >
                                            Cancelar
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        <div style={styles.grid}>
                            {estoque.map(item => (
                                <div key={item.produtoId} style={styles.modernCard}>
                                    <div style={styles.cardInfo}>
                                        <span style={styles.productName}>{item.nomeProduto}</span>
                                        <span style={styles.productStock}>Qtd: {item.quantEstoque} | R$ {item.precoVenda?.toFixed(2)}</span>
                                    </div>
                                    <div style={{display: 'flex', gap: '8px'}}>
                                        <button 
                                            onClick={() => prepararEdicao(item)}
                                            style={styles.editBtnSmall}
                                        >
                                            ✏️
                                        </button>
                                        <button 
                                            onClick={() => handleRemoverProduto(item.produtoId)}
                                            style={styles.deleteBtnSmall}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div style={styles.scrollList}>
                        <h2>Pedidos Pendentes</h2>
                        {pedidosPendentes.length === 0 ? <p style={{color: '#999'}}>Tudo em dia por aqui!</p> : pedidosPendentes.map(p => (
                            <div key={p.id} style={styles.pedidoCard}>
                                <div style={styles.pedidoHeader}>
                                    <strong>Pedido #{p.id}</strong>
                                    <span style={styles.statusBadge}>Aguardando Autorização</span>
                                </div>
                                <div style={styles.pedidoBody}>
                                    {p.itens.map((it, idx) => (
                                        <div key={idx} style={styles.itemLinha}>{it.quant}x {it.nome}</div>
                                    ))}
                                </div>
                                <button style={styles.approveBtn} onClick={() => handleAprovarPedido(p.id)}>Autorizar e Preparar</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const styles = {
    pageContainer: { display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', fontFamily: 'sans-serif', backgroundColor: '#f5f5f5' },
    topNav: { display: 'flex', backgroundColor: '#fff', padding: '5px 10px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', zIndex: 1100 },
    navBtn: { flex: 1, padding: '15px', background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: '14px' },
    navBtnActive: { flex: 1, padding: '15px', background: 'none', borderBottom: '3px solid #000', fontWeight: 'bold', cursor: 'pointer', color: '#000' },
    contentWrapper: { flex: 1, position: 'relative', overflow: 'hidden' },
    scrollList: { padding: '20px', height: '100%', overflowY: 'auto', boxSizing: 'border-box' },
    headerWithAction: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
    
    // Cards Modernos (Estilo Uber)
    modernCard: { backgroundColor: '#fff', padding: '15px', borderRadius: '12px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #eee' },
    cardInfo: { display: 'flex', flexDirection: 'column' },
    productName: { fontWeight: 'bold', fontSize: '16px', color: '#333' },
    productStock: { fontSize: '12px', color: '#888', marginTop: '4px' },
    priceTag: { backgroundColor: '#f0f0f0', padding: '8px 12px', borderRadius: '8px', fontWeight: 'bold', color: '#2ecc71' },

    // Pedidos
    pedidoCard: { backgroundColor: '#fff', padding: '20px', borderRadius: '15px', marginBottom: '15px', border: '1px solid #eee' },
    pedidoHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '15px' },
    statusBadge: { backgroundColor: '#f39c12', color: '#fff', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold' },
    pedidoBody: { borderTop: '1px solid #f9f9f9', padding: '10px 0', marginBottom: '15px' },
    itemLinha: { fontSize: '14px', padding: '4px 0', color: '#555' },
    approveBtn: { width: '100%', padding: '12px', backgroundColor: '#000', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' },

    // Formulário e inputs
    modernForm: { backgroundColor: '#fff', padding: '20px', borderRadius: '15px', marginBottom: '25px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' },
    modernInput: { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', boxSizing: 'border-box', fontSize: '14px' },
    addBtnLarge: { backgroundColor: '#000', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' },
    finishBtn: { width: '100%', padding: '15px', backgroundColor: '#2ecc71', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', marginTop: '15px', cursor: 'pointer' },
    
    suggestionBox: { position: 'absolute', width: '100%', backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '8px', zIndex: 10, boxShadow: '0 4px 10px rgba(0,0,0,0.1)' },
    suggestionItem: { padding: '12px', cursor: 'pointer', borderBottom: '1px solid #f9f9f9' },

    // Mapa
    mapFloatingOverlay: { position: 'absolute', bottom: '20px', width: '100%', display: 'flex', justifyContent: 'center', zIndex: 1000 },
    mainBtn: { padding: '15px 30px', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' },

    editBtnSmall: { 
    background: '#f0f0f0', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' 
    },
    deleteBtnSmall: { 
        background: '#fff0f0', border: '1px solid #ffcccc', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' 
    }
};

export default Supermercado;