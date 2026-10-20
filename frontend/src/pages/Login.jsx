function Login() {
  return (
    <>
      <div>
        <label>Username: </label>
        <input
          name='username'
          id='username'
          type='text'
          placeholder='Username'
        />

        <label>Email: </label>
        <input name='email' id='email' type='text' placeholder='Email' />

        <label>Password: </label>
        <input
          name='password'
          id='password'
          type='text'
          placeholder='Password'
        />
      </div>
    </>
  );
}

export default Login;
