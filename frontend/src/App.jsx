import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState } from 'react';

import AppNavbar from './components/AppNavbar';
import Home from './pages/Home';
import Placeholder from './pages/Placeholder';
import AccountCreation from './pages/AccountCreation';
import Lobby from './pages/Lobby';
import Friends from './pages/Friends';
import Contact from './pages/Contact';
import Profile, { EditProfile } from './pages/Profile';
import PokerTable from './pages/PokerTable';

import './App.css';

function App() {
  const [tableSearch, setTableSearch] = useState('');

  return (
    <BrowserRouter>
      <AppNavbar tableSearch={tableSearch} setTableSearch={setTableSearch} />

      <Routes>
        <Route path='/' element={<Home />} />

        <Route path='/account' element={<AccountCreation />} />

        <Route path='/lobby' element={<Lobby tableSearch={tableSearch} />} />

        <Route path='/table/:tableId' element={<PokerTable />} />

        <Route path='/profile' element={<Profile />} />

        <Route path='/profile/edit' element={<EditProfile />} />

        <Route path='/friends' element={<Friends />} />

        <Route path='/tutorial' element={<Placeholder title='How to Play' />} />

        <Route
          path='/about'
          element={<Placeholder title='About Poker Face' />}
        />

        <Route path='/contact' element={<Contact />} />

        <Route path='*' element={<Placeholder title='Page Not Found' />} />

        <Route
          path='/messages'
          element={<Placeholder title='Messages Coming Soon' />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
