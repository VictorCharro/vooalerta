import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NAO_DISPONIVEL = 'não temos essa rota disponível';

async function fetchBuser(url: string): Promise<string | null> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
  });
  if (!res.ok) return null;
  return res.text();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { origem_slug, destino_slug, data_ida, data_volta, action } = body;

    // ── Modo validação de cidade ──────────────────────────────
    if (action === 'validate_city') {
      const slug = body.slug as string;
      if (!slug) {
        return new Response(JSON.stringify({ error: 'slug é obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const html = await fetchBuser(`https://www.buser.com.br/onibus/${slug}`);
      const valido = html !== null && !html.toLowerCase().includes(NAO_DISPONIVEL);
      return new Response(JSON.stringify({ valido }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!origem_slug || !destino_slug || !data_ida) {
      return new Response(
        JSON.stringify({ error: 'origem_slug, destino_slug e data_ida são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Scraping do Buser
    let url = `https://www.buser.com.br/onibus/${origem_slug}/${destino_slug}?ida=${data_ida}`;
    if (data_volta) url += `&volta=${data_volta}`;

    const html = await fetchBuser(url);

    if (html === null) {
      return new Response(
        JSON.stringify({ error: 'Falha ao acessar o Buser' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const match = html.match(/<meta[^>]+property="product:price:amount"[^>]+content="([\d.]+)"/);

    if (!match) {
      return new Response(
        JSON.stringify({ preco: null, message: 'Rota não encontrada ou sem passagens disponíveis' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const preco = parseFloat(match[1]);

    // Salva no cache do Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const dataVoltaFilter = data_volta ? { data_volta } : {};

    await supabase
      .from('bus_price_cache')
      .delete()
      .eq('origem_slug', origem_slug)
      .eq('destino_slug', destino_slug)
      .eq('data_ida', data_ida)
      .is('data_volta', data_volta ?? null);

    await supabase.from('bus_price_cache').insert({
      origem_slug,
      destino_slug,
      data_ida,
      data_volta: data_volta ?? null,
      preco,
      atualizado_em: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ preco }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
