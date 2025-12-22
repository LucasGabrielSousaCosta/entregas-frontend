
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Mapa from './pages/Mapa';
import Auth from './pages/Auth';
import Transportadora from './pages/Transportadora';
import Supermercado from './pages/Supermercado';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/mapa" element={<Mapa />} />
        <Route path="/transportadora" element={<Transportadora />} />
        <Route path="/supermercado" element={<Supermercado />} />
        <Route path="/" element={<Navigate to="/auth" />} />
      </Routes>
    </Router>
  );
}

export default App;