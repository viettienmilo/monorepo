/**
 * @copyright 2026 Nguyen Viet Tien
 * @license Apache-2.0
 */

import { useEffect, useState } from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from './assets/vite.svg';
import heroImg from './assets/hero.png';
import honoLogo from './assets/hono.svg';

import './App.css';

// thư viện để truy xuất hono từ frontend
import { hc, type InferResponseType } from 'hono/client';
// kiểu dữ liệu từ backend
import type { AppTypes } from '@repo/api';
// lấy kiểu trả về từ response của backend
type UsersResponse = InferResponseType<typeof client.api.users.$get>;
// khai báo hono RPC
const client = hc<AppTypes>(
  import.meta.env.VITE_API_URL || 'http://localhost:3000',
);
// thư viện better-auth client
import { authClient } from './auth-client.js';

function App() {
  const [logged, setLogged] = useState(false);
  const [message, setMessage] = useState('Loading...');
  const [users, setUsers] = useState<UsersResponse['users']>([]);
  const { data: session, isPending } = authClient.useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const sayWelcome = async () => {
    const res = await client.api.hello.$get();
    const data = await res.json();
    setMessage(data.message);
  };

  const getUsers = async () => {
    const res = await client.api.users.$get();
    const data = await res.json();
    setUsers(data.users);
  };

  const checkUserLoginState = async () => {
    const res = await client.api.test.user.$get();
    const data = await res.json();

    if (!data) {
      setLogged(false);
    }
    if (data.message === 'success') {
      setLogged(true);
    }
  };

  const handleSignUp = async () => {
    await authClient.signUp.email({
      email,
      password,
      name: 'New user',
    });
    alert('Sign up successfully');
  };

  const handleSignIn = async () => {
    await authClient.signIn.email({ email, password });
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    sayWelcome();
    getUsers();

    if (session) {
      setLogged(true);
    }
  }, [session]);

  if (isPending) {
    return <section id='center'>Loading...</section>;
  }

  return (
    <>
      <section id='center'>
        <div className='hero'>
          <img
            src={heroImg}
            className='base'
            alt=''
          />

          <div className='framework-plane'>
            <img
              src={reactLogo}
              className='framework'
              alt='React'
            />
            <img
              src={honoLogo}
              className='hono'
              alt='Hono'
            />
          </div>

          <img
            src={viteLogo}
            className='vite'
            alt='Vite'
          />
        </div>
        <div>
          <h1>{message}</h1>
          <h2 style={{ color: 'yellowgreen' }}>
            {users ? users[0]?.name : ''}
          </h2>
        </div>
        <button
          type='button'
          className='counter'
          onClick={checkUserLoginState}
        >
          Login state check : {logged ? 'Logged' : 'Not logged'}
        </button>

        <div className='ticks'></div>
        <div className='next-steps'>
          {/* Giao diện khi người dùng chưa đăng nhập */}
          {!session && (
            <div style={{ padding: '2rem', maxWidth: '400px' }}>
              <h2>Sign-in / Sign-up</h2>
              <div style={{ padding: '1rem', margin: 4 }}>
                <input
                  placeholder='Email'
                  onChange={(e) => setEmail(e.target.value)}
                />
                <input
                  type='password'
                  placeholder='Password'
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <br />
              <button onClick={handleSignIn}>Sign in</button>
              <button
                onClick={handleSignUp}
                style={{ marginLeft: '10px' }}
              >
                Sign up
              </button>
            </div>
          )}

          {/* Giao diện hiển thị dựa trên phân quyền Role có được từ plugin Admin */}
          {session && (
            <>
              <h2>Welcome back, {session.user.name}!</h2>
              <p>Email: {session.user.email}</p>
              <p>
                Your role:{' '}
                <strong>{session.user.role || 'Not available'}</strong>
              </p>
              {session.user.role === 'admin' && (
                <div
                  style={{
                    background: '#ffebee',
                    padding: '1rem',
                    marginTop: '1rem',
                  }}
                >
                  <h3>Dashboard activated</h3>
                </div>
              )}
              <br />
              <button onClick={() => authClient.signOut()}>Sign out</button>
            </>
          )}
        </div>
        <section id='spacer'></section>
      </section>
    </>
  );
}

export default App;
