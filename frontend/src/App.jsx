import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState } from 'react';

import AppNavbar from './components/AppNavbar';
import Home from './pages/Home';
import Placeholder from './pages/Placeholder';
import Login from './pages/Login';
import Lobby from './pages/Lobby';

import './App.css';

function App() {
  const[tableSearch, setTableSearch] = useState('');
  return (
    <BrowserRouter>
      <AppNavbar 
        tableSearch={tableSearch}
        setTableSearch={setTableSearch}
      />

      <Routes>
        <Route path='/' element={<Home />} />

        <Route path='/login' element={<Login />} />

        <Route path='/register' element={<Placeholder title='Register' />} />

        <Route path='/lobby' element={<Lobby tableSearch={tableSearch} />} />

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
