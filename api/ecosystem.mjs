import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const readActions = new Set(['state', 'teacher_demo', 'teacher_record', 'teacher_export']);
const writeActions = new Set(['start', 'reroll', 'chain', 'answer', 'draft', 'submit',
  'teacher_approve', 'teacher_window', 'teacher_close', 'teacher_extend']);
const basePath = '/ecosystem-equilibrium/';

function plainError(status, message, headers) {
  return Response.json({ error: message }, { status, headers });
}

export function createHandler(dependencies = {}) {
  return async function handle(request) {
    const headers = new Headers({
      'Cache-Control': 'private, no-store, max-age=0',
      'Pragma': 'no-cache',
      'Vary': 'Cookie',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    });
    try {
      const url = new URL(request.url);
      const origin = dependencies.origin || process.env.ECO_PUBLIC_ORIGIN;
      if (!origin || new URL(origin).origin !== origin) return plainError(503, '연결을 준비하고 있습니다.', headers);
      const action = url.searchParams.get('op') || 'state';
      if (!['GET', 'POST'].includes(request.method)) return plainError(405, '허용되지 않은 요청입니다.', headers);
      if (request.method === 'POST' && request.headers.get('origin') !== origin) {
        return plainError(403, '페이지에서 다시 요청해 주세요.', headers);
      }
      if (readActions.has(action) && request.method !== 'GET') return plainError(405, '요청 방식을 확인해 주세요.', headers);
      if (writeActions.has(action) && request.method !== 'POST') return plainError(405, '요청 방식을 확인해 주세요.', headers);
      const server = dependencies.auth || createServerClient(
        process.env.ECO_SUPABASE_URL, process.env.ECO_SUPABASE_PUBLISHABLE_KEY, {
          cookieOptions: { name: 'eco2026-auth', path: '/api/ecosystem', httpOnly: true,
            secure: origin.startsWith('https:'), sameSite: 'lax' },
          cookies: {
            getAll: () => parseCookieHeader(request.headers.get('cookie') || ''),
            setAll(cookies, cacheHeaders) {
              for (const { name, value, options } of cookies) {
                headers.append('Set-Cookie', serializeCookieHeader(name, value, {
                  ...options, path: '/api/ecosystem', httpOnly: true,
                  secure: origin.startsWith('https:'), sameSite: 'lax',
                }));
              }
              for (const [name, value] of Object.entries(cacheHeaders || {})) headers.set(name, value);
            },
          },
        }).auth;

      if (action === 'login') {
        const { data, error } = await server.signInWithOAuth({ provider: 'google', options: {
          redirectTo: origin + '/api/ecosystem?op=callback',
          queryParams: { prompt: 'select_account' },
        } });
        if (error || !data?.url) return plainError(503, '구글 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.', headers);
        headers.set('Location', data.url);
        return new Response(null, { status: 303, headers });
      }
      if (action === 'callback') {
        const code = url.searchParams.get('code');
        const result = code ? await server.exchangeCodeForSession(code) : { error: true };
        headers.set('Location', origin + basePath + (result.error ? '?login=failed' : ''));
        return new Response(null, { status: 303, headers });
      }
      if (action === 'logout') {
        if (request.method !== 'POST') return plainError(405, '요청 방식을 확인해 주세요.', headers);
        await server.signOut({ scope: 'local' });
        return Response.json({ signed_out: true }, { headers });
      }
      if (!readActions.has(action) && !writeActions.has(action)) return plainError(400, '지원하지 않는 요청입니다.', headers);
      const { data, error: userError } = await server.getUser();
      const user = data?.user;
      if (userError || !user || !user.email ||
          !user.identities?.some(identity => identity.provider === 'google') || !user.email_confirmed_at) {
        return plainError(401, '학교 구글 계정으로 로그인해 주세요.', headers);
      }
      let payload = {};
      if (request.method === 'POST') {
        const raw = await request.text();
        if (Buffer.byteLength(raw) > 131072) return plainError(413, '입력한 내용이 너무 깁니다.', headers);
        try { payload = JSON.parse(raw); } catch { return plainError(400, '저장할 내용을 확인해 주세요.', headers); }
        if (!payload || Array.isArray(payload) || typeof payload !== 'object') return plainError(400, '요청 내용을 확인해 주세요.', headers);
      } else {
        if (url.searchParams.has('case_id')) payload.case_id = url.searchParams.get('case_id');
        if (url.searchParams.has('student_id')) payload.student_id = url.searchParams.get('student_id');
      }
      const invoke = dependencies.gateway || (async args => {
        const client = createClient(process.env.ECO_SUPABASE_URL, process.env.ECO_SUPABASE_SECRET_KEY,
          { auth: { persistSession: false, autoRefreshToken: false } });
        return client.rpc('eco_gateway', args);
      });
      const result = await invoke({ p_user_id: user.id, p_email: user.email.trim().toLowerCase(),
        p_action: action, p_payload: payload });
      if (result.error) {
        const code = result.error.code || '';
        if (/^PT[45]\d\d$/.test(code)) return plainError(Number(code.slice(2)), result.error.message, headers);
        if (['22P02', '22023', '23514', '23503', '23502'].includes(code)) return plainError(400, '입력 내용을 확인해 주세요.', headers);
        if (code === '23505') return plainError(409, '이미 저장된 내용이 있습니다. 최신 상태를 불러와 주세요.', headers);
        return plainError(503, '저장을 완료하지 못했습니다. 내용은 확정되지 않았습니다. 다시 시도해 주세요.', headers);
      }
      if (action === 'teacher_export') {
        headers.set('Content-Type', 'application/json; charset=utf-8');
        headers.set('Content-Disposition', "attachment; filename*=UTF-8''" + encodeURIComponent('통합과학2_생태계_수행평가_원본.json'));
        return new Response(JSON.stringify(result.data, null, 2), { headers });
      }
      return Response.json(result.data, { headers });
    } catch {
      return plainError(503, '연결을 확인하고 다시 시도해 주세요. 저장 완료 표시 전에는 답안이 확정되지 않습니다.', headers);
    }
  };
}

export default { fetch: createHandler() };
