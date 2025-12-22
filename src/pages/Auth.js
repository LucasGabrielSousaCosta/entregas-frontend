import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ 
    email: '', 
    password: '', 
    role: 'Cliente',
    nome: '',           
    localizacao: '',    
  });
  
  const navigate = useNavigate();
  axios.defaults.withCredentials = true;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const endpoint = isLogin ? 'login' : 'register';
    
    // Montagem do payload conforme o DTO do C#
    const payload = isLogin 
      ? { email: formData.email, password: formData.password }
      : {
          email: formData.email,
          password: formData.password,
          nome: formData.nome,
          localizacao: " ", // Espaço para evitar erro de validação [Required]
          tipoUsuario: formData.role 
        };

    try {
      const response = await axios.post(`https://entregas-hbqy.onrender.com/api/account/${endpoint}`, payload);
      
      if (isLogin) {
        const userRole = response.data.role; 
        if (userRole === 'Transportadora') navigate('/transportadora');
        else if (userRole === 'Supermercado') navigate('/supermercado');
        else navigate('/mapa');
      } else {
        alert('Cadastro realizado com sucesso! Agora faça o login.');
        setIsLogin(true);
      }
    } catch (error) {
      console.error("Erro detalhado:", error.response);

      // 1. Tenta pegar a mensagem de erro vinda do backend
      const backendMessage = error.response?.data;
      
      let mensagemExibir = "Erro ao processar solicitação.";

      if (typeof backendMessage === 'string') {
        // Caso o backend retorne: return BadRequest("E-mail já cadastrado");
        mensagemExibir = backendMessage;
      } else if (backendMessage?.message) {
        // Caso o backend retorne: return BadRequest(new { message = "..." });
        mensagemExibir = backendMessage.message;
      } else if (backendMessage?.errors) {
        // Caso sejam erros de validação do Model (Identity)
        mensagemExibir = Object.values(backendMessage.errors).flat().join('\n');
      } else if (!isLogin && error.response?.status === 400) {
        // Fallback genérico para registro se não vier mensagem
        mensagemExibir = "Este e-mail já pode estar em uso ou os dados são inválidos.";
      } else if (isLogin) {
        mensagemExibir = "E-mail ou senha inválidos.";
      }

      alert(mensagemExibir);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2>{isLogin ? 'Entrar' : 'Registrar'}</h2>
        <form onSubmit={handleSubmit} style={styles.form}>
          
          {/* Nome só aparece no registro */}
          {!isLogin && (
            <input 
              placeholder="Nome Completo" 
              style={styles.input}
              onChange={e => setFormData({...formData, nome: e.target.value})} 
              required 
            />
          )}

          <input 
            type="email" 
            placeholder="Email" 
            style={styles.input}
            onChange={e => setFormData({...formData, email: e.target.value})} 
            required 
          />
          
          <input 
            type="password" 
            placeholder="Senha" 
            style={styles.input}
            onChange={e => setFormData({...formData, password: e.target.value})} 
            required 
          />

          {/* Seleção de Role só aparece no registro */}
          {!isLogin && (
            <select 
              style={styles.input} 
              onChange={e => setFormData({...formData, role: e.target.value})}
              value={formData.role}
            >
              <option value="Cliente">Cliente</option>
              <option value="Supermercado">Supermercado</option>
              <option value="Transportadora">Transportadora</option>
            </select>
          )}

          <button type="submit" style={styles.button}>
            {isLogin ? 'Entrar' : 'Cadastrar'}
          </button>
        </form>

        <button onClick={() => setIsLogin(!isLogin)} style={styles.linkButton}>
          {isLogin ? 'Criar conta' : 'Já tenho conta'}
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f0f2f5' },
  card: { padding: '40px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px', textAlign: 'center' },
  form: { display: 'flex', flexDirection: 'column', gap: '15px' },
  input: { padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '16px' },
  button: { padding: '12px', borderRadius: '4px', border: 'none', backgroundColor: '#007bff', color: 'white', fontSize: '16px', cursor: 'pointer', fontWeight: 'bold' },
  linkButton: { background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', textDecoration: 'underline', marginTop: '20px' }
};

export default Auth;