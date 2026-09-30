import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import worker, { BYPASS_COOKIE, BYPASS_PATH } from "../src/worker.js";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

const origine = (reponse) => {
  globalThis.fetch = async () => (reponse instanceof Error ? Promise.reject(reponse) : reponse);
};
const appel = (url, env = {}, headers = {}) => worker.fetch(new Request(url, { headers }), env);

describe("Origine en panne", () => {
  it("une 530 (tunnel coupé) devient la page de panne, en 503 avec Retry-After", async () => {
    origine(new Response("<html>1033</html>", { status: 530, headers: { "Content-Type": "text/html" } }));
    const reponse = await appel("https://premadelab.eu/players/x");
    assert.equal(reponse.status, 503);
    assert.equal(reponse.headers.get("Retry-After"), "60");
    const html = await reponse.text();
    assert.match(html, /PremadeLab ne répond pas/);
    assert.doesNotMatch(html, /Schub/);
  });

  it("une origine injoignable donne la même page, en anglais sous /en", async () => {
    origine(new Error("connexion refusée"));
    const html = await (await appel("https://schultz-thomas.fr/en/servers")).text();
    assert.match(html, /<html lang="en">/);
    assert.match(html, /Schub is not responding/);
  });

  it("sous /api, la panne répond en JSON", async () => {
    origine(new Response("Bad gateway", { status: 502 }));
    const reponse = await appel("https://premadelab.eu/api/players/x");
    assert.equal(reponse.status, 503);
    assert.deepEqual(await reponse.json(), { error: "unavailable", reason: "outage" });
  });

  it("une erreur JSON du BFF passe telle quelle : le front sait la lire", async () => {
    origine(new Response('{"message":"connecteur muet"}', { status: 503, headers: { "Content-Type": "application/json" } }));
    const reponse = await appel("https://premadelab.eu/api/players/x");
    assert.deepEqual(await reponse.json(), { message: "connecteur muet" });
  });

  it("une 500 ou une 404 de l'application passe telle quelle", async () => {
    for (const status of [500, 404]) {
      origine(new Response("app", { status }));
      assert.equal((await appel("https://premadelab.eu/x")).status, status);
    }
  });
});

describe("Mode maintenance", () => {
  const env = { MAINTENANCE: "on", BYPASS_TOKEN: "jeton-secret" };

  it("sert la page de MEP sans appeler l'origine", async () => {
    let appele = false;
    globalThis.fetch = async () => {
      appele = true;
      return new Response("ok");
    };
    const reponse = await appel("https://premadelab.eu/", env);
    assert.equal(reponse.status, 503);
    const html = await reponse.text();
    assert.match(html, /http-equiv="refresh" content="60"/);
    assert.match(html, /PremadeLab est en cours de mise à jour/);
    assert.equal(appele, false);
  });

  it("le cookie de contournement laisse passer vers l'origine", async () => {
    origine(new Response("vrai site"));
    const reponse = await appel("https://premadelab.eu/", env, { Cookie: `a=1; ${BYPASS_COOKIE}=jeton-secret` });
    assert.equal(await reponse.text(), "vrai site");
  });

  it("un mauvais cookie ne passe pas", async () => {
    origine(new Response("vrai site"));
    const reponse = await appel("https://premadelab.eu/", env, { Cookie: `${BYPASS_COOKIE}=jeton-secreT` });
    assert.equal(reponse.status, 503);
  });

  it("le lien de contournement pose le cookie, et répond 404 sans le bon jeton", async () => {
    const bon = await appel(`https://premadelab.eu${BYPASS_PATH}?token=jeton-secret`, env);
    assert.equal(bon.status, 303);
    assert.match(bon.headers.get("Set-Cookie"), /schub_bypass=jeton-secret; Path=\/; Secure; HttpOnly/);
    assert.equal((await appel(`https://premadelab.eu${BYPASS_PATH}?token=faux`, env)).status, 404);
    assert.equal((await appel(`https://premadelab.eu${BYPASS_PATH}?token=x`, { MAINTENANCE: "on" })).status, 404);
  });

  it("maintenance coupée : le trafic passe sans rien changer", async () => {
    origine(new Response("vrai site", { status: 200 }));
    assert.equal(await (await appel("https://premadelab.eu/", { MAINTENANCE: "off" })).text(), "vrai site");
  });
});
