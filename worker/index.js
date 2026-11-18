/**
 * Cloudflare Worker for meet.io
 * Securely proxies Cloudflare Calls API and handles room presence
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check & config
    if (url.pathname === '/' || url.pathname === '/api/calls/config') {
      const configured = !!(env.CLOUDFLARE_APP_ID && env.CLOUDFLARE_APP_SECRET);
      return new Response(JSON.stringify({
        sfuEnabled: configured,
        mode: configured ? 'sfu' : 'p2p',
        appId: env.CLOUDFLARE_APP_ID || null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate new room code: xxx-yyyy-zzz
    if (url.pathname === '/api/new-room') {
      const chars = 'abcdefghijklmnopqrstuvwxyz';
      const segment = (len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      const roomId = `${segment(3)}-${segment(4)}-${segment(3)}`;
      return new Response(JSON.stringify({ roomId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Cloudflare Calls API Proxy
    if (url.pathname.startsWith('/api/calls/')) {
      const appId = env.CLOUDFLARE_APP_ID;
      const appSecret = env.CLOUDFLARE_APP_SECRET;

      if (!appId || !appSecret) {
        return new Response(JSON.stringify({
          error: 'Cloudflare Calls credentials (CLOUDFLARE_APP_ID / CLOUDFLARE_APP_SECRET) not set in Worker environment variables.'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Extract target sub-path
      // e.g. /api/calls/sessions/new -> /sessions/new
      const callsSubpath = url.pathname.replace('/api/calls', '');
      const cfUrl = `https://rtc.live.cloudflare.com/v1/apps/${appId}${callsSubpath}`;

      const cfRequestInit = {
        method: request.method,
        headers: {
          'Authorization': `Bearer ${appSecret}`,
          'Content-Type': 'application/json'
        }
      };

      if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
        try {
          const body = await request.text();
          if (body) cfRequestInit.body = body;
        } catch (e) {}
      }

      try {
        const cfResponse = await fetch(cfUrl, cfRequestInit);
        const cfData = await cfResponse.text();

        return new Response(cfData, {
          status: cfResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
};
