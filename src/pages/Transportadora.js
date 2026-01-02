import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, Popup, Polyline } from 'react-leaflet';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as signalR from "@microsoft/signalr";

// --- ÍCONE PERSONALIZADO ---
const veiculoIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/1048/1048314.png',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
});

function MapPicker({ isActive, onPick }) {
    useMapEvents({
        click(e) {
            if (isActive) onPick(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

const Transportadora = () => {
    const apiBase = 'https://entregas-hbqy.onrender.com/api';
    axios.defaults.withCredentials = true;

    const [pedidosDisponiveis, setPedidosDisponiveis] = useState([]);
    const [veiculos, setVeiculos] = useState([]);
    const [produtosGlobais, setProdutosGlobais] = useState([]);
    const [rotaAtiva, setRotaAtiva] = useState([]); // Estado para o motorista ver a rota

    const [abaAtiva, setAbaAtiva] = useState('fretes');
    const [modoFrota, setModoFrota] = useState('visualizacao');
    const [veiculoSelecionado, setVeiculoSelecionado] = useState(null);
    const [veiculoParaFrete, setVeiculoParaFrete] = useState('');

    const [formNome, setFormNome] = useState('');
    const [formLocal, setFormLocal] = useState('');

    const carregarDados = useCallback(async () => {
        try {
            const [resPedidos, resVeiculos, resProds] = await Promise.all([
                axios.get(`${apiBase}/Pedido/disponiveis`),
                axios.get(`${apiBase}/veiculo/meus-veiculos`),
                axios.get(`${apiBase}/produto`)
            ]);
            setPedidosDisponiveis(resPedidos.data);
            setVeiculos(resVeiculos.data);
            setProdutosGlobais(resProds.data);
        } catch (err) {
            console.error("Erro ao sincronizar dados", err);
        }
    }, [apiBase]);

    useEffect(() => {
        carregarDados();
        const interval = setInterval(() => {
            if (abaAtiva === 'fretes') carregarDados();
        }, 15000);
        return () => clearInterval(interval);
    }, [carregarDados, abaAtiva]);

    // --- LOGICA DE ACEITE DE FRETE AJUSTADA ---
    const handleAceitarFrete = async (pedidoId) => {
        if (!veiculoParaFrete) return alert("Selecione um veículo para realizar a entrega!");
        
        try {
            // 1. Notifica o backend sobre o aceite
            const url = `${apiBase}/Entrega/${pedidoId}/aceitar-frete?veiculoId=${veiculoParaFrete}`;
            const response = await axios.patch(url, {}, { withCredentials: true });
            
            alert("🚚 Frete Aceito! Rota gerada para o cliente.");

            // 2. Opcional: Buscar a rota para mostrar ao motorista imediatamente
            const resRota = await axios.get(`${apiBase}/Entrega/${pedidoId}/rota`);
            setRotaAtiva(resRota.data);
            
            // 3. Muda para o mapa para o motorista iniciar a viagem
            setAbaAtiva('mapa');
            carregarDados();
        } catch (err) {
            alert(err.response?.data || "Erro ao processar o frete.");
        }
    };

    // --- CONFIGURAÇÃO DO SIGNALR E PERSISTÊNCIA ---
    useEffect(() => {
        const hubUrl = 'https://entregas-hbqy.onrender.com/deliveryHub';
        const connection = new signalR.HubConnectionBuilder()
            .withUrl(hubUrl)
            .withAutomaticReconnect()
            .build();

        let isMounted = true;

        // Escuta atualizações de posição de qualquer veículo
        connection.on("UpdatePosition", (dados) => {
            if (isMounted) {
                // Atualiza apenas se o veículo já estiver na lista (garante que é da transportadora)
                setVeiculos(prev => prev.map(v => 
                    v.id === dados.veiculoId ? { ...v, localizacao: `${dados.lng}, ${dados.lat}` } : v
                ));
            }
        });

        // Escuta quando uma nova rota é gerada
        connection.on("ReceberRota", (veiculoId, pontos) => {
            if (isMounted) setRotaAtiva(pontos);
        });

        connection.start().catch(err => console.error("Erro SignalR Transportadora:", err));

        // Lógica de Persistência (F5): Tenta recuperar rota de qualquer veículo em entrega
        const recuperarRotaAtiva = async () => {
            try {
                // Busca pedidos que estão com a transportadora e em status "Em Rota" (4)
                const res = await axios.get(`${apiBase}/Pedido/pedidos-em-entrega`);
                const emEntrega = res.data.find(p => p.statusEntrega === 4);
                if (emEntrega) {
                    const resRota = await axios.get(`${apiBase}/Entrega/${emEntrega.id}/rota`);
                    if (resRota.data) setRotaAtiva(resRota.data);
                }
            } catch (err) { console.log("Nenhuma rota ativa para persistir."); }
        };

        recuperarRotaAtiva();

        return () => {
            isMounted = false;
            connection.stop();
        };
    }, [apiBase]);

    const handleSalvarNovoVeiculo = async () => {
        if (!formNome || !formLocal) return alert("Preencha o nome e selecione o local no mapa!");
        try {
            await axios.post(`${apiBase}/veiculo`, { nome: formNome, localizacao: formLocal });
            alert("Veículo cadastrado!");
            resetarFrota();
            carregarDados();
        } catch (err) { alert("Erro ao criar veículo"); }
    };

    const handleAtualizarPosicaoVeiculo = async (lat, lng) => {
        const novaLocal = `${lng}, ${lat}`;
        try {
            await axios.put(`${apiBase}/veiculo/${veiculoSelecionado.id}`, {
                id: veiculoSelecionado.id,
                nome: veiculoSelecionado.nome,
                localizacao: novaLocal
            });
            alert("Posição do veículo atualizada!");
            resetarFrota();
            await carregarDados();
        } catch (err) { alert("Erro ao atualizar posição."); }
    };

    const resetarFrota = () => {
        setModoFrota('visualizacao');
        setFormNome('');
        setFormLocal('');
        setVeiculoSelecionado(null);
    };

    const getNomeProduto = (id) => produtosGlobais.find(p => p.id === id)?.nome || `Produto #${id}`;

    return (
        <div style={styles.pageContainer}>
            <div style={styles.topNav}>
                <button onClick={() => setAbaAtiva('fretes')} style={abaAtiva === 'fretes' ? styles.navBtnActive : styles.navBtn}>📦 Fretes</button>
                <button onClick={() => setAbaAtiva('frota')} style={abaAtiva === 'frota' ? styles.navBtnActive : styles.navBtn}>🚚 Frota</button>
                <button onClick={() => setAbaAtiva('mapa')} style={abaAtiva === 'mapa' ? styles.navBtnActive : styles.navBtn}>📍 Mapa</button>
            </div>

            <div style={styles.contentWrapper}>
                {abaAtiva === 'mapa' ? (
                    <div style={{ height: '100%', position: 'relative' }}>
                        <MapContainer center={[-16.68, -49.25]} zoom={12} style={{ height: '100%', width: '100%' }}>
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            
                            {/* ROTA ATIVA PARA O MOTORISTA */}
                            {rotaAtiva && rotaAtiva.length > 0 && (
                                <Polyline 
                                    positions={rotaAtiva} 
                                    pathOptions={{ color: '#2ecc71', weight: 6, opacity: 0.8 }} 
                                />
                            )}
                            {veiculos.map(v => {
                                const parts = v.localizacao.split(',');
                                const coords = [parseFloat(parts[1]), parseFloat(parts[0])]; // Inversão correta para o Leaflet
                                return (
                                    <Marker key={v.id} position={coords} icon={veiculoIcon}>
                                        <Popup><strong>{v.nome}</strong></Popup>
                                    </Marker>
                                );
                            })}
                        </MapContainer>
                    </div>
                ) : abaAtiva === 'fretes' ? (
                    <div style={styles.scrollList}>
                        <div style={styles.seletorFrotaCard}>
                            <h3>Veículo em Operação</h3>
                            <select 
                                style={styles.modernSelect} 
                                value={veiculoParaFrete} 
                                onChange={e => setVeiculoParaFrete(e.target.value)}
                            >
                                <option value="">-- Selecione o veículo --</option>
                                {veiculos.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
                            </select>
                        </div>

                        <h2>Disponíveis</h2>
                        <div style={styles.grid}>
                            {pedidosDisponiveis.map(p => (
                                <div key={p.id} style={styles.modernCard}>
                                    <div style={styles.cardInfo}>
                                        <div style={styles.rowBetween}>
                                            <span style={styles.orderId}>Pedido #{p.id}</span>
                                            <span style={styles.badgeStore}>{p.supermercadoNome}</span>
                                        </div>
                                        <p>📍 Destino: <strong>{p.clienteNome}</strong></p>
                                        <div style={styles.itensResumo}>
                                            {p.itens.map((it, idx) => (
                                                <span key={idx} style={styles.itemTag}>{it.quant}x {getNomeProduto(it.produtoId)}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <button style={styles.acceptBtn} onClick={() => handleAceitarFrete(p.id)}>Aceitar e Iniciar</button>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    /* FROTA */
                    <div style={styles.scrollList}>
                        <div style={styles.headerWithAction}>
                            <h2>Gerenciar Veículos</h2>
                            <button onClick={() => setModoFrota('criando')} style={styles.addBtn}>+ Novo</button>
                        </div>
                        <div style={styles.flexLayout}>
                            <div style={styles.sideList}>
                                {veiculos.map(v => (
                                    <div key={v.id} style={{...styles.miniCard, borderLeft: veiculoSelecionado?.id === v.id ? '5px solid #000' : '1px solid #eee'}}>
                                        <div>
                                            <strong>{v.nome}</strong>
                                            <small style={{display:'block', color:'#999'}}>{v.localizacao}</small>
                                        </div>
                                        <button onClick={() => { setVeiculoSelecionado(v); setModoFrota('editando'); }} style={styles.editBtn}>Mover</button>
                                    </div>
                                ))}
                            </div>
                            <div style={styles.mapArea}>
                                <MapContainer center={[-16.68, -49.25]} zoom={13} style={{ height: '100%', borderRadius: '15px' }}>
                                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                    <MapPicker 
                                        isActive={modoFrota !== 'visualizacao'} 
                                        onPick={(lat, lng) => {
                                            if (modoFrota === 'criando') setFormLocal(`${lng}, ${lat}`);
                                            if (modoFrota === 'editando') handleAtualizarPosicaoVeiculo(lat, lng);
                                        }} 
                                    />
                                    {veiculos.map(v => {
                                        const parts = v.localizacao.split(',');
                                        return <Marker key={v.id} position={[parseFloat(parts[1]), parseFloat(parts[0])]} icon={veiculoIcon} />;
                                    })}
                                </MapContainer>
                                {modoFrota === 'criando' && (
                                    <div style={styles.floatingForm}>
                                        <input placeholder="Nome ou Placa" style={styles.modernInput} value={formNome} onChange={e => setFormNome(e.target.value)} />
                                        <button onClick={handleSalvarNovoVeiculo} style={styles.finishBtn}>Confirmar Cadastro</button>
                                        <button onClick={resetarFrota} style={styles.cancelBtn}>Cancelar</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- ESTILOS ---
const styles = {
    pageContainer: { display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', fontFamily: 'sans-serif', backgroundColor: '#f5f5f5' },
    topNav: { display: 'flex', backgroundColor: '#fff', padding: '5px 10px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', zIndex: 1100 },
    navBtn: { flex: 1, padding: '15px', background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: '14px' },
    navBtnActive: { flex: 1, padding: '15px', background: 'none', borderBottom: '3px solid #000', fontWeight: 'bold', color: '#000' },
    contentWrapper: { flex: 1, position: 'relative', overflow: 'hidden' },
    scrollList: { padding: '20px', height: '100%', overflowY: 'auto', boxSizing: 'border-box' },
    seletorFrotaCard: { backgroundColor: '#000', color: '#fff', padding: '20px', borderRadius: '15px', marginBottom: '25px' },
    modernSelect: { width: '100%', padding: '12px', borderRadius: '10px', marginTop: '10px', border: 'none', fontSize: '14px' },
    modernCard: { backgroundColor: '#fff', padding: '20px', borderRadius: '15px', marginBottom: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '15px' },
    rowBetween: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    orderId: { fontWeight: 'bold', fontSize: '18px' },
    badgeStore: { backgroundColor: '#eef6ff', color: '#007bff', padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' },
    itensResumo: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
    itemTag: { backgroundColor: '#f5f5f5', padding: '5px 10px', borderRadius: '6px', fontSize: '12px', color: '#333' },
    acceptBtn: { width: '100%', padding: '15px', backgroundColor: '#2ecc71', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' },
    flexLayout: { display: 'flex', gap: '20px', height: 'calc(100% - 60px)' },
    sideList: { width: '300px', overflowY: 'auto' },
    miniCard: { backgroundColor: '#fff', padding: '15px', borderRadius: '12px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #eee' },
    editBtn: { background: '#f0f0f0', border: 'none', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' },
    mapArea: { flex: 1, position: 'relative' },
    headerWithAction: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' },
    addBtn: { backgroundColor: '#000', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' },
    floatingForm: { position: 'absolute', bottom: '20px', left: '20px', right: '20px', backgroundColor: '#fff', padding: '20px', borderRadius: '15px', zIndex: 1000, boxShadow: '0 10px 25px rgba(0,0,0,0.2)' },
    modernInput: { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', marginBottom: '10px' },
    finishBtn: { width: '100%', padding: '12px', backgroundColor: '#000', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' },
    cancelBtn: { width: '100%', marginTop: '5px', padding: '8px', background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer', fontSize: '13px' }
};

export default Transportadora;