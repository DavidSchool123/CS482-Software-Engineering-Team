import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Navbar from './components/Navbar';
import Home from './pages/Home';
import Placeholder from './pages/Placeholder';
import Login from './pages/Login';

import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Navbar />

      <Routes>
        <Route path='/' element={<Home />} />

        <Route path='/login' element={<Login />} />

        <Route path='/register' element={<Placeholder title='Register' />} />

        <Route path='/lobby' element={<Placeholder title='Game Lobby' />} />

        <Route path='/tutorial' element={<Placeholder title='How to Play' />} />

        <Route
          path='/about'
          element={<Placeholder title='About Poker Face' />}
        />

        <Route path='/contact' element={<Placeholder title='Contact Us' />} />

        <Route path='*' element={<Placeholder title='Page Not Found' />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
