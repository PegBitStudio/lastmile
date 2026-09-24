/**
 * Did this request come from our own pages?
 *
 * /api/token and /api/review spend AssemblyAI credit, and neither has a login.
 * Without this check any other website could fetch a voice token from the
 * visitor's browser, and any script could mint them in a loop, once the
 * repository and the live URL are public.
 *
 * What this stops: other websites, and casual scripts. What it does not stop: a
 * determined script that forges the headers. For that the defence is the
 * 5-minute session cap in /api/token and a low-balance alert on the AssemblyAI
 * account. Real tenancy — a login per carrier — is the fix, and out of scope for
 * a demo.
 *
 * Three signals, any one of which is enough, because browsers disagree on which
 * they send:
 *
 * - `Sec-Fetch-Site: same-origin`, sent by every current browser on fetch().
 *   If it is present and says anything else, that is the answer.
 * - `Origin`, sent on cross-origin requests and on same-origin POSTs.
 * - `Referer`, which older Safari sends where it sends neither of the above.
 *   Same-origin fetches carry the full page URL by default.
 */

type HeaderSource = { get(name: string): string | null };

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

/** The hosts this deployment answers to, as the request itself reports them. */
function ownHosts(headers: HeaderSource, requestUrl: string): Set<string> {
  const hosts = new Set<string>();
  const fromUrl = hostOf(requestUrl);
  if (fromUrl) hosts.add(fromUrl);
  for (const name of ["x-forwarded-host", "host"]) {
    const value = headers.get(name);
    // x-forwarded-host can be a list when there is more than one proxy.
    for (const h of value?.split(",") ?? []) if (h.trim()) hosts.add(h.trim().toLowerCase());
  }
  return hosts;
}

export function fromOwnSite(headers: HeaderSource, requestUrl: string): boolean {
  const site = headers.get("sec-fetch-site");
  if (site) return site === "same-origin";

  const hosts = ownHosts(headers, requestUrl);
  const origin = hostOf(headers.get("origin"));
  if (origin) return hosts.has(origin);

  const referer = hostOf(headers.get("referer"));
  if (referer) return hosts.has(referer);

  // No browser signal at all: curl, a script, a server. Not our page.
  return false;
}
