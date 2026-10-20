import { useEffect, useState } from 'react';

function App() {
  const [message, setMessage] = useState('Connecting to backend...');

  useEffect(() => {
    fetch(`http://localhost:3000/`)
      .then((response) => response.json())
      .then((data) => setMessage(data.message))
      .catch(() => setMessage('Could not connect to backend'));
  }, []);

  return (
    <>
      <div>
        <h1>Poker Face</h1>
        <p>{message}</p>
      </div>
      <button>Login/Sign Up</button>
    </>
  );
}

export default App;
