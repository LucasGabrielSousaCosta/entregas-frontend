import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap, Popup, Polyline } from 'react-leaflet';
import * as signalR from "@microsoft/signalr";
import L from 'leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';

// --- CONFIGURAÇÃO DE ÍCONES ---
const clienteIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/1239/1239525.png',
    iconSize: [35, 35], iconAnchor: [17, 35], popupAnchor: [0, -35]
});
const supermercadoIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/608/608828.png',
    iconSize: [40, 40], iconAnchor: [20, 40], popupAnchor: [0, -40]
});
const carroIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/1048/1048314.png',
    iconSize: [35, 35], iconAnchor: [17, 17], popupAnchor: [0, -17]
});
// ÍCONE ESPECIAL PARA O MERCADO DE TESTE (Ex: Uma estrela dourada)
const supermercadoTesteIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/1828/1828884.png', 
    iconSize: [45, 45], 
    iconAnchor: [22, 45], 
    popupAnchor: [0, -45]
});

// --- COMPONENTES AUXILIARES ---
function ClickHandler({ isActive, onLocationSelected }) {
    useMapEvents({
        click(e) { if (isActive) onLocationSelected(e.latlng.lat, e.latlng.lng); },
    });
    return null;
}

function RecenterMap({ position }) {
    const map = useMap();
    useEffect(() => {
        if (position && Array.isArray(position) && !isNaN(position[0])) {
            // O 15 é o nível de zoom. flyTo cria uma animação suave até o ícone
            map.flyTo(position, 15, { animate: true });
        }
    }, [position, map]);
    return null;
}

const Mapa = () => {
    const [minhaPosicao, setMinhaPosicao] = useState(null);
    const [supermercados, setSupermercados] = useState([]);
    const [veiculos, setVeiculos] = useState([]);
    const [catalogo, setCatalogo] = useState([]);
    const [carrinho, setCarrinho] = useState([]);
    const [rotaAtiva, setRotaAtiva] = useState([]);
    const [abaAtiva, setAbaAtiva] = useState('mapa');
    const [pedidosAtivos, setPedidosAtivos] = useState([]);
    const [historicoPedidos, setHistoricoPedidos] = useState([]);
    const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
    const [editandoLocalizacao, setEditandoLocalizacao] = useState(false);
    const [lojaAberta, setLojaAberta] = useState(null);
    const [enviandoPedido, setEnviandoPedido] = useState(false);

    const apiBase = 'https://entregas-hbqy.onrender.com/api';
    const hubUrl = 'https://entregas-hbqy.onrender.com/deliveryHub';

    // --- LÓGICA DO CARRINHO ---
    const adicionarAoCarrinho = (produto) => {
        setCarrinho(prev => {
            const itemExistente = prev.find(i => i.produtoId === produto.produtoId);
            if (itemExistente) {
                return prev.map(i => i.produtoId === produto.produtoId ? { ...i, quant: i.quant + 1 } : i);
            }
            return [...prev, { ...produto, quant: 1 }];
        });
    };

    const removerDoCarrinho = (produtoId) => {
        setCarrinho(prev => {
            const itemExistente = prev.find(i => i.produtoId === produtoId);
            if (itemExistente && itemExistente.quant > 1) {
                return prev.map(i => i.produtoId === produtoId ? { ...i, quant: i.quant - 1 } : i);
            }
            return prev.filter(i => i.produtoId !== produtoId);
        });
    };

    const valorFinalCarrinho = carrinho.reduce((acc, item) => acc + (item.precoVenda * item.quant), 0);

    // --- SIGNALR ---
    useEffect(() => {
        const connection = new signalR.HubConnectionBuilder().withUrl(hubUrl).withAutomaticReconnect().build();
        let isMounted = true;
        connection.on("UpdatePosition", (dados) => {
            if (isMounted) { 
                setVeiculos(prev => prev.map(v => v.id === dados.veiculoId ? { ...v, localizacao: `${dados.lng}, ${dados.lat}` } : v)); 
            }
        });
        connection.on("ReceberRota", (veiculoId, pontos) => { 
            if (isMounted) setRotaAtiva(pontos); 
        });
        connection.on("EntregaConcluida", (veiculoId) => {
            if (isMounted) { alert("Entrega concluída!"); setRotaAtiva([]); carregarPedidosAtivos(); }
        });
        const start = async () => { try { await connection.start(); } catch (err) { console.error(err); } };
        start();
        return () => { isMounted = false; connection.stop(); };
    }, []);

    // --- CARREGAMENTO INICIAL ---
    useEffect(() => {
        carregarMinhaLocalizacao();
        carregarSupermercados();
        carregarVeiculos();
        carregarPedidosAtivos();
    }, []);

    useEffect(() => {
        if (abaAtiva === 'historico') carregarHistorico();
        if (abaAtiva === 'ativos') carregarPedidosAtivos();
    }, [abaAtiva]);

    // --- FUNÇÕES DE API ---

    const carregarMinhaLocalizacao = async () => {
        try {
            const res = await axios.get(`${apiBase}/account/me`, { withCredentials: true });
            console.log("Dados do usuário:", res.data); // Verifique se a localização vem aqui

            if (res.data && res.data.localizacao) {
                // Supondo que o banco retorna "lng, lat"
                const partes = res.data.localizacao.split(',');
                const lng = parseFloat(partes[0].trim());
                const lat = parseFloat(partes[1].trim());

                if (!isNaN(lat) && !isNaN(lng)) {
                    console.log("Posição definida para o ícone:", [lat, lng]);
                    setMinhaPosicao([lat, lng]);
                }
            }
        } catch (err) { 
            console.error("Erro ao carregar localização inicial:", err); 
        }
    };

    // Busca a rota persistida (Crucial para o F5)
    const carregarRotaSalva = async (idPedido) => {
        try {
            const res = await axios.get(`${apiBase}/Entrega/${idPedido}/rota`, { withCredentials: true });
            if (res.data && Array.isArray(res.data)) {
                setRotaAtiva(res.data);
            }
        } catch (err) {
            console.log("Rota não disponível ou erro.");
        }
    };

    const carregarPedidosAtivos = async () => {
        try {
            const res = await axios.get(`${apiBase}/Pedido/pedidos-em-entrega`, { withCredentials: true });
            const pedidos = res.data || [];
            setPedidosAtivos(pedidos);

            // Status 4 é "Em Entrega" no seu sistema
            const pedidoEmRota = pedidos.find(p => p.statusEntrega === 4);
            if (pedidoEmRota) {
                await carregarRotaSalva(pedidoEmRota.id);
            }
        } catch (err) { console.error(err); }
    };

    const carregarSupermercados = async () => {
        try {
            const res = await axios.get(`${apiBase}/supermercado`, { withCredentials: true });
            setSupermercados(res.data);
        } catch (err) { console.error(err); }
    };

    const carregarVeiculos = async () => {
        try {
            const res = await axios.get(`${apiBase}/veiculo`, { withCredentials: true });
            setVeiculos(res.data);
        } catch (err) { console.error(err); }
    };

    const carregarHistorico = async () => {
        try {
            const res = await axios.get(`${apiBase}/Pedido/meus-pedidos`, { withCredentials: true });
            setHistoricoPedidos(res.data || []);
        } catch (err) { console.error(err); }
    };

    const carregarCatalogo = async (id, nome) => {
        try {
            const res = await axios.get(`${apiBase}/supermercadoproduto/catalogo/${id}`, { withCredentials: true });
            setCatalogo(res.data);
            setLojaAberta({ id, nome });
            setCarrinho([]); 
        } catch (err) { alert("Loja sem produtos."); }
    };

    const cancelarPedido = async (id) => {
        if (!window.confirm("Tem certeza que deseja cancelar este pedido?")) return;
        try {
            await axios.delete(`${apiBase}/Pedido/${id}`, { withCredentials: true });
            alert("Pedido cancelado com sucesso!");
            carregarPedidosAtivos();
            if (abaAtiva === 'historico') carregarHistorico();
            setPedidoSelecionado(null);
        } catch (err) {
            // Pega a mensagem do back ou usa a padrão
            const msg = typeof err.response?.data === 'string' 
                        ? err.response.data 
                        : "Erro ao cancelar pedido.";
            alert(msg);
        }
    };

    const finalizarPedido = async () => {
        if (carrinho.length === 0) return;
        setEnviandoPedido(true);
        try {
            await axios.post(`${apiBase}/Pedido/45`, {
                supermercadoId: lojaAberta.id,
                itens: carrinho.map(i => ({ quant: i.quant, produtoId: i.produtoId }))
            }, { withCredentials: true });

            alert("Pedido enviado com sucesso!");
            setCarrinho([]);
            setLojaAberta(null);
            carregarPedidosAtivos();
        } catch (err) {
            console.error("Erro ao enviar pedido:", err.response);

            // 1. Tenta extrair a mensagem do backend
            const backendError = err.response?.data;
            let mensagemExibir = "Erro ao enviar pedido.";

            if (typeof backendError === 'string') {
                // Se o back retornar: return BadRequest("Estoque insuficiente");
                mensagemExibir = backendError;
            } else if (backendError?.errors) {
                // Se for erro de validação do ModelState (o seu if (!ModelState.IsValid))
                mensagemExibir = Object.values(backendError.errors).flat().join('\n');
            } else if (backendError?.message) {
                // Caso o erro venha num objeto json { message: "..." }
                mensagemExibir = backendError.message;
            }

            alert(mensagemExibir);
        } finally {
            setEnviandoPedido(false);
        }
    };

    const salvarLocalizacao = async (lat, lng) => {
        try {
            await axios.patch(`${apiBase}/account/update-location`, JSON.stringify(`${lng}, ${lat}`), {
                headers: { 'Content-Type': 'application/json' }, withCredentials: true
            });
            setMinhaPosicao([lat, lng]);
            setEditandoLocalizacao(false);
        } catch (err) { alert("Erro ao salvar localização."); }
    };

    const renderStatus = (status) => {
        // Mapeamento baseado nos seus dados
        const statusMap = { 
            0: { texto: 'Aguardando Coleta', cor: '#f39c12' }, 
            1: { texto: 'Pendente', cor: '#3498db' }, 
            4: { texto: 'Em Rota', cor: '#2ecc71' }, 
            3: { texto: 'Entregue', cor: '#95a5a6' } 
        };
        const s = statusMap[status] || { texto: 'Processando', cor: '#000' };
        return <span style={{ ...styles.badge, backgroundColor: s.cor }}>{s.texto}</span>;
    };

    const ListaPedidos = ({ pedidos, titulo, isHistorico }) => (
        <div style={styles.pedidosListContainer}>
            <h3 style={{marginBottom: '20px'}}>{titulo}</h3>
            {pedidos.length === 0 ? <p>Nenhum pedido encontrado.</p> : pedidos.map(p => (
                <div key={p.id} style={styles.pedidoCard}>
                    <div onClick={() => !isHistorico && setPedidoSelecionado(p)}>
                        <div style={styles.pedidoCardHeader}>
                            <strong>Pedido #{p.id}</strong>
                            {renderStatus(p.statusEntrega)}
                        </div>
                        <p style={{fontSize: '14px', color: '#666', margin: '5px 0'}}>📍 {p.supermercadoNome}</p>
                    </div>
                    {!isHistorico && p.statusEntrega === 1 && (
                        <button onClick={(e) => { e.stopPropagation(); cancelarPedido(p.id); }} style={styles.cancelarBtnSmall}>Cancelar</button>
                    )}
                </div>
            ))}
        </div>
    );

    return (
        <div style={styles.pageContainer}>
            <div style={styles.topNav}>
                <button onClick={() => setAbaAtiva('mapa')} style={abaAtiva === 'mapa' ? styles.navBtnActive : styles.navBtn}>📍 Mapa</button>
                <button onClick={() => setAbaAtiva('ativos')} style={abaAtiva === 'ativos' ? styles.navBtnActive : styles.navBtn}>📦 Ativos ({pedidosAtivos.length})</button>
                <button onClick={() => setAbaAtiva('historico')} style={abaAtiva === 'historico' ? styles.navBtnActive : styles.navBtn}>📜 Histórico</button>
            </div>

            <div style={styles.contentWrapper}>
                {abaAtiva === 'mapa' ? (
                    <div style={styles.mapContainerCustom}>
                        <MapContainer center={[-16.683, -49.255]} zoom={13} style={{ height: '100%', width: '100%' }}>
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            <RecenterMap position={minhaPosicao} />
                            <ClickHandler isActive={editandoLocalizacao} onLocationSelected={salvarLocalizacao} />
                            
                            {/* CLIENTE: Aparece se houver posição no estado (carregada do banco no useEffect inicial) */}
                            {minhaPosicao && (
                                <Marker position={minhaPosicao} icon={clienteIcon}>
                                    <Popup>Minha Casa</Popup>
                                </Marker>
                            )}
                            
                            {/* SUPERMERCADOS: Diferenciando o de Teste */}
                            {supermercados.filter(s => s.localizacao).map(s => {
                                const parts = s.localizacao.split(',');
                                const coords = [parseFloat(parts[1]), parseFloat(parts[0])];
                                
                                // Verifica se é o mercado de teste pelo e-mail
                                const isTeste = s.email === 'mercado@teste.com';
                                
                                return (
                                    <Marker 
                                        key={`s-${s.id}`} 
                                        position={coords} 
                                        icon={isTeste ? supermercadoTesteIcon : supermercadoIcon} 
                                        eventHandlers={{ click: () => carregarCatalogo(s.id, s.nome) }}
                                    >
                                        <Popup>{isTeste ? `⭐ ${s.nome} (Demonstração)` : s.nome}</Popup>
                                    </Marker>
                                );
                            })}

                            {/* ROTA ATIVA (SIGNALR OU PERSISTIDA) */}
                            {rotaAtiva && Array.isArray(rotaAtiva) && rotaAtiva.length > 1 && (
                                <Polyline positions={rotaAtiva.filter(p => p && !isNaN(p[0]))} pathOptions={{ color: 'blue', weight: 5, opacity: 0.7 }} />
                            )}

                            {veiculos.filter(v => v.localizacao).map(v => {
                                const parts = v.localizacao.split(',');
                                const coords = [parseFloat(parts[1]), parseFloat(parts[0])];
                                return <Marker key={`v-${v.id}`} position={coords} icon={carroIcon}><Popup>{v.nome}</Popup></Marker>
                            })}
                        </MapContainer>
                        
                        {lojaAberta && (
                            <div style={styles.drawer}>
                                <div style={styles.drawerHeader}>
                                    <h3>{lojaAberta.nome}</h3>
                                    <button onClick={() => setLojaAberta(null)} style={styles.closeBtn}>✕</button>
                                </div>
                                <div style={styles.drawerContent}>
                                    {catalogo.map(p => {
                                        const itemNoCarrinho = carrinho.find(c => c.produtoId === p.produtoId);
                                        const estoqueDisponivel = p.quantEstoque; // Pegando do seu DTO

                                        return (
                                            <div key={p.produtoId} style={styles.itemCard}>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontWeight: '500' }}>{p.nomeProduto}</span>
                                                    <strong>R$ {p.precoVenda.toFixed(2)}</strong>
                                                    
                                                    {/* Exibição do Estoque */}
                                                    <span style={{ 
                                                        fontSize: '12px', 
                                                        color: estoqueDisponivel <= 5 ? '#e67e22' : '#27ae60',
                                                        fontWeight: 'bold' 
                                                    }}>
                                                        {estoqueDisponivel > 0 
                                                            ? `Estoque: ${estoqueDisponivel} un.` 
                                                            : "Esgotado"}
                                                    </span>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    {itemNoCarrinho && (
                                                        <>
                                                            <button style={styles.removeBtn} onClick={() => removerDoCarrinho(p.produtoId)}>−</button>
                                                            <span style={{ fontWeight: 'bold' }}>{itemNoCarrinho.quant}</span>
                                                        </>
                                                    )}
                                                    
                                                    {/* O botão de + deve ser desativado se atingir o limite do estoque */}
                                                    <button 
                                                        style={{
                                                            ...styles.addBtn,
                                                            backgroundColor: (itemNoCarrinho?.quant >= estoqueDisponivel || estoqueDisponivel === 0) ? '#ccc' : '#000',
                                                            cursor: (itemNoCarrinho?.quant >= estoqueDisponivel || estoqueDisponivel === 0) ? 'not-allowed' : 'pointer'
                                                        }} 
                                                        onClick={() => {
                                                            if (!itemNoCarrinho || itemNoCarrinho.quant < estoqueDisponivel) {
                                                                adicionarAoCarrinho(p);
                                                            } else {
                                                                alert("Quantidade máxima em estoque atingida!");
                                                            }
                                                        }}
                                                        disabled={itemNoCarrinho?.quant >= estoqueDisponivel || estoqueDisponivel === 0}
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {carrinho.length > 0 && (
                                        <div style={styles.resumoCarrinho}>
                                            <h4 style={{borderBottom: '1px solid #eee', paddingBottom: '10px', marginTop: '10px'}}>Resumo do Pedido</h4>
                                            {carrinho.map(item => (
                                                <div key={item.produtoId} style={styles.carrinhoLinha}>
                                                    <span>{item.quant}x {item.nomeProduto}</span>
                                                    <span>R$ {(item.precoVenda * item.quant).toFixed(2)}</span>
                                                </div>
                                            ))}
                                            <div style={styles.totalCarrinhoLinha}>
                                                <strong>Total</strong>
                                                <strong>R$ {valorFinalCarrinho.toFixed(2)}</strong>
                                            </div>
                                            <button style={styles.finishBtn} onClick={finalizarPedido} disabled={enviandoPedido}>
                                                {enviandoPedido ? "Processando..." : `Finalizar Pedido`}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ) : abaAtiva === 'ativos' ? (
                    <ListaPedidos pedidos={pedidosAtivos} titulo="Em Entrega" isHistorico={false} />
                ) : (
                    <ListaPedidos pedidos={historicoPedidos} titulo="Meu Histórico" isHistorico={true} />
                )}

                {pedidoSelecionado && (
                    <div style={styles.detalhePedidoModal}>
                        <div style={styles.modalHandle}></div>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <h4>{pedidoSelecionado.supermercadoNome}</h4>
                            {renderStatus(pedidoSelecionado.statusEntrega)}
                        </div>
                        <button style={styles.verNoMapaBtn} onClick={() => {setAbaAtiva('mapa'); setPedidoSelecionado(null)}}>Acompanhar no Mapa</button>
                        <button style={styles.cancelarBtn} onClick={() => cancelarPedido(pedidoSelecionado.id)}>Cancelar Pedido</button>
                        <button style={styles.fecharModalBtn} onClick={() => setPedidoSelecionado(null)}>Voltar</button>
                    </div>
                )}
            </div>

            {abaAtiva === 'mapa' && (
                <div style={styles.controls}>
                    <button onClick={() => setEditandoLocalizacao(!editandoLocalizacao)} style={{...styles.mainBtn, backgroundColor: editandoLocalizacao ? '#ff4d4d' : '#000'}}>
                        {editandoLocalizacao ? "Clique no mapa para salvar" : "Alterar Meu Endereço"}
                    </button>
                </div>
            )}
        </div>
    );
};

// --- ESTILOS MANTIDOS FIELMENTE ---
const styles = {
    pageContainer: { display: 'flex', flexDirection: 'column', height: '100vh', maxHeight: '100%', width: '100vw',overflow: 'hidden', fontFamily: 'sans-serif', backgroundColor: '#f5f5f5', minHeight: '0'},
    topNav: { display: 'flex', backgroundColor: '#fff', padding: '5px 10px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', zIndex: 1100, flexShrink: 0 },
    navBtn: { flex: 1, padding: '15px', background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: '14px' },
    navBtnActive: { flex: 1, padding: '15px', background: 'none', borderBottom: '3px solid #000', fontWeight: 'bold', cursor: 'pointer', color: '#000' },
    contentWrapper: { flex: 1, position: 'relative', minHeight: 0, height: 'auto', overflow: 'hidden' },
    controls: { padding: '20px', backgroundColor: '#fff', display: 'flex', justifyContent: 'center', borderTop: '1px solid #eee', flexShrink: 0 },
    mainBtn: { padding: '15px', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', width: '90%', fontSize: '16px' },
    pedidosListContainer: { padding: '20px', height: '100%', overflowY: 'auto', boxSizing: 'border-box' },
    pedidoCard: { backgroundColor: '#fff', borderRadius: '12px', padding: '15px', marginBottom: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #eee' },
    pedidoCardHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' },
    badge: { color: '#fff', padding: '5px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' },
    detalhePedidoModal: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#fff', zIndex: 2000, borderTopLeftRadius: '25px', borderTopRightRadius: '25px', padding: '25px', boxShadow: '0 -5px 25px rgba(0,0,0,0.15)', boxSizing: 'border-box' },
    modalHandle: { width: '40px', height: '5px', backgroundColor: '#e0e0e0', borderRadius: '10px', margin: '0 auto 20px' },
    verNoMapaBtn: { width: '100%', padding: '16px', backgroundColor: '#000', color: '#fff', borderRadius: '15px', border: 'none', fontWeight: 'bold', marginTop: '15px', fontSize: '16px' },
    fecharModalBtn: { width: '100%', padding: '12px', background: 'none', color: '#aaa', border: 'none', marginTop: '5px', cursor: 'pointer' },
    drawer: { position: 'absolute', top: 0, right: 0, width: '100%', height: '100%', backgroundColor: 'white', zIndex: 1000, display: 'flex', flexDirection: 'column' },
    drawerHeader: { padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    drawerContent: { padding: '20px', overflowY: 'auto', flex: 1 },
    itemCard: { display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px' },
    addBtn: { backgroundColor: '#000', color: '#fff', border: 'none', width: '35px', height: '35px', borderRadius: '8px', fontSize: '20px', cursor: 'pointer' },
    removeBtn: { backgroundColor: '#f5f5f5', color: '#000', border: '1px solid #ddd', width: '35px', height: '35px', borderRadius: '8px', fontSize: '20px', cursor: 'pointer' },
    finishBtn: { width: '100%', padding: '18px', backgroundColor: '#2ecc71', color: '#fff', border: 'none', borderRadius: '15px', fontWeight: 'bold', fontSize: '16px', marginTop: '20px' },
    closeBtn: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' },
    resumoCarrinho: { marginTop: '20px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '12px' },
    carrinhoLinha: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee', fontSize: '14px' },
    totalCarrinhoLinha: { display: 'flex', justifyContent: 'space-between', marginTop: '15px', fontSize: '16px', color: '#2ecc71' },
    cancelarBtn: { width: '100%', padding: '16px', backgroundColor: '#fff', color: '#ff4d4d', borderRadius: '15px', border: '1px solid #ff4d4d', fontWeight: 'bold', marginTop: '10px', fontSize: '16px', cursor: 'pointer' },
    cancelarBtnSmall: { marginTop: '10px', padding: '8px 15px', backgroundColor: 'transparent', color: '#ff4d4d', border: '1px solid #ff4d4d', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' },
    mapContainerCustom: {
        flex: 1,
        width: '100%',
        height: '100%'
    }
};

export default Mapa;