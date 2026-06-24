// Server-side route — runs on Vercel/Netlify infrastructure, not the browser.
// Yahoo Finance has no CORS restrictions on server-to-server requests.

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const codesParam = searchParams.get("codes");

  if (!codesParam) {
    return Response.json({ error: "Missing 'codes' query parameter" }, { status: 400 });
  }

  const codes = codesParam
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);

  if (codes.length === 0) {
    return Response.json({ error: "No valid codes provided" }, { status: 400 });
  }

  const results = {};
  const errors = {};

  await Promise.all(
    codes.map(async (code) => {
      const ticker = `${code}.AX`;
      const urls = [
        `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
        `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
      ];

      const headers = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "application/json",
      };

      let lastErr = null;

      for (const url of urls) {
        try {
          const res = await fetch(url, { headers, cache: "no-store" });

          if (!res.ok) {
            lastErr = `HTTP ${res.status}`;
            continue;
          }

          const data = await res.json();
          const meta = data?.chart?.result?.[0]?.meta;

          if (!meta) {
            lastErr = "No data returned";
            continue;
          }

          results[code] = {
            price: meta.regularMarketPrice ?? null,
            prev: meta.previousClose ?? meta.chartPreviousClose ?? null,
            currency: meta.currency ?? "AUD",
            name: meta.shortName ?? meta.longName ?? code,
            marketState: meta.marketState ?? null,
            updated: new Date().toISOString(),
          };
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err?.message ?? "Fetch failed";
        }
      }

      if (lastErr) errors[code] = lastErr;
    })
  );

  return Response.json({ prices: results, errors });
}
