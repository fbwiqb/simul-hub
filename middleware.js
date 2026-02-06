const PASSWORD = 'cnsa2026';

export default function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path !== '/' && path !== '/index.html') {
    return;
  }

  const cookie = request.headers.get('cookie') || '';
  if (cookie.includes('hub_auth=1')) {
    return;
  }

  if (request.method === 'POST') {
    return handleLogin(request);
  }

  return new Response(loginPage(), {
    status: 401,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

async function handleLogin(request) {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const pw = params.get('pw');

  if (pw === PASSWORD) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/',
        'Set-Cookie': 'hub_auth=1; Path=/; Max-Age=86400; SameSite=Lax',
      },
    });
  }

  return new Response(loginPage('비밀번호가 틀렸습니다.'), {
    status: 401,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function loginPage(error = '') {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CNSA 시뮬레이션</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Noto Sans KR',sans-serif; min-height:100vh; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg,#1a1a2e,#16213e,#0f3460); }
  .box { background:rgba(255,255,255,0.08); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:2.5rem; width:340px; text-align:center; }
  h1 { color:#fff; font-size:1.5rem; margin-bottom:1.5rem; }
  input { width:100%; padding:12px; border:1px solid rgba(255,255,255,0.2); border-radius:8px; background:rgba(255,255,255,0.1); color:#fff; font-size:1rem; margin-bottom:1rem; outline:none; }
  input::placeholder { color:rgba(255,255,255,0.4); }
  button { width:100%; padding:12px; border:none; border-radius:8px; background:linear-gradient(90deg,#00d2ff,#3a7bd5); color:#fff; font-size:1rem; font-weight:600; cursor:pointer; }
  .err { color:#ff6b6b; font-size:0.85rem; margin-bottom:1rem; }
</style>
</head>
<body>
<div class="box">
  <h1>CNSA 시뮬레이션</h1>
  ${error ? `<p class="err">${error}</p>` : ''}
  <form method="POST">
    <input type="password" name="pw" placeholder="비밀번호" autofocus>
    <button type="submit">입장</button>
  </form>
</div>
</body>
</html>`;
}

export const config = {
  matcher: ['/', '/index.html'],
};
