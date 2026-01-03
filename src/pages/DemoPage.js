import React, { useState } from 'react';
import axios from 'axios';
import Mapa from './Mapa'; 
import Supermercado from './Supermercado';
import Transportadora from './Transportadora';

const DemoPage = () => {
    const [viewAtiva, setViewAtiva] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showGuia, setShowGuia] = useState(false); // Estado para o modal de explicação

    const apiBase = 'https://entregas-hbqy.onrender.com/api/account';
    axios.defaults.withCredentials = true;

    const contasDemo = {
        Cliente: { email: 'cliente@teste.com', password: '1234' },
        Supermercado: { email: 'mercado@teste.com', password: '1234' },
        Transportadora: { email: 'transp@teste.com', password: '1234' }
    };

    const handleTrocarPerfil = async (perfil) => {
        setLoading(true);
        try {
            await axios.post(`${apiBase}/login`, contasDemo[perfil]);
            setViewAtiva(perfil);
        } catch (err) {
            alert("Erro ao autenticar perfil de teste.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
            
            {/* MODAL DE EXPLICAÇÃO DO FLUXO */}
            {showGuia && (
                <div style={styles.modalOverlay} onClick={() => setShowGuia(false)}>
                    <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <h3 style={{ borderBottom: '2px solid #ff9800', paddingBottom: '10px' }}>Como testar o sistema?</h3>
                        <ol style={styles.listaGuia}>
                            <li><strong>Modo Supermercado:</strong> Primeiro, adicione produtos ao estoque para que fiquem disponíveis.</li>
                            <li><strong>Modo Cliente:</strong> Defina sua localização no mapa e realize um pedido escolhendo o <u>mercado@teste.com</u>.</li>
                            <li><strong>Modo Supermercado:</strong> Retorne aqui para aprovar o pedido realizado.</li>
                            <li><strong>Modo Transportadora:</strong> Escolha (ou crie) um veículo e aceite o frete para iniciar a entrega em tempo real.</li>
                        </ol>
                        <button onClick={() => setShowGuia(false)} style={styles.closeModalBtn}>Entendi!</button>
                    </div>
                </div>
            )}

            {/* BARRA DE SELEÇÃO */}
            <div style={{...styles.demoBar, height: '60px'}}>
                <div style={styles.info}>
                    <strong style={{color: '#ff9800'}}>✨ MODO DEMONSTRAÇÃO</strong>
                    <button onClick={() => setShowGuia(true)} style={styles.fluxoBtn}>📖 Ver Fluxo do Sistema</button>
                </div>
                <div style={styles.btnGroup}>
                    <button onClick={() => handleTrocarPerfil('Cliente')} style={{...styles.btn, backgroundColor: '#007bff'}}>🛒 Cliente</button>
                    <button onClick={() => handleTrocarPerfil('Supermercado')} style={{...styles.btn, backgroundColor: '#000'}}>🏬 Supermercado</button>
                    <button onClick={() => handleTrocarPerfil('Transportadora')} style={{...styles.btn, backgroundColor: '#2ecc71'}}>🚚 Transportadora</button>
                </div>
            </div>

            {/* ÁREA DO CONTEÚDO */}
            <div style={{ height: 'calc(100vh - 60px)', width: '100%', overflow: 'hidden', position: 'relative' }}>
                {loading && <div style={styles.loader}>Autenticando perfil...</div>}
                
                {!viewAtiva && !loading && (
                    <div style={styles.welcome}>
                        <h2>Bem-vindo ao Sandbox</h2>
                        <p>Use o botão <strong>"Ver Fluxo"</strong> acima para entender como testar a jornada completa.</p>
                    </div>
                )}

                {viewAtiva === 'Cliente' && <Mapa key="demo-cliente" />}
                {viewAtiva === 'Supermercado' && <Supermercado key="demo-mercado" />}
                {viewAtiva === 'Transportadora' && <Transportadora key="demo-transp" />}
            </div>
        </div>
    );
};

const styles = {
    demoBar: { 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 20px', backgroundColor: '#222', color: '#fff', zIndez: 10000
    },
    info: { display: 'flex', alignItems: 'center', gap: '15px' },
    fluxoBtn: { 
        backgroundColor: 'transparent', color: '#ff9800', border: '1px solid #ff9800', 
        borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold'
    },
    btnGroup: { display: 'flex', gap: '8px' },
    btn: { padding: '6px 12px', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' },
    
    // ESTILOS DO MODAL
    modalOverlay: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 20000
    },
    modalContent: {
        backgroundColor: '#fff', padding: '30px', borderRadius: '15px', maxWidth: '500px', width: '90%', color: '#333'
    },
    listaGuia: { paddingLeft: '20px', lineHeight: '1.8', margin: '20px 0' },
    closeModalBtn: { 
        width: '100%', padding: '12px', backgroundColor: '#ff9800', color: '#fff', 
        border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' 
    },
    
    loader: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.9)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
    welcome: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', textAlign: 'center', color: '#888' }
};

export default DemoPage;