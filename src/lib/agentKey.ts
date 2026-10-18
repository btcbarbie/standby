import { generateKeyPairSync } from "crypto";
import { generateNonce, sign } from "web-bot-auth";
import { signerFromJWK, verifierFromJWK } from "web-bot-auth/crypto";
import { prisma } from "./prisma";

// Web Bot Auth (an IETF draft from Cloudflare): every agent visit is signed with Standby's private key,
// and Standby publishes the matching public key, so a store can check the visit really came from Standby
// and that the declaration it carries wasn't altered on the way.

const KEY_ID = "standby-agent";

async function privateJwk(): Promise<JsonWebKey> {
  const row = await prisma.agentKey.findUnique({ where: { id: KEY_ID } });
  if (row) return JSON.parse(row.jwk);
  const { privateKey } = generateKeyPairSync("ed25519");
  const jwk = privateKey.export({ format: "jwk" }) as JsonWebKey;
  try {
    await prisma.agentKey.create({ data: { id: KEY_ID, jwk: JSON.stringify(jwk) } });
    return jwk;
  } catch {
    // Another part of the app made it first; use theirs.
    const again = await prisma.agentKey.findUniqueOrThrow({ where: { id: KEY_ID } });
    return JSON.parse(again.jwk);
  }
}

export async function publicJwk() {
  const { kty, crv, x } = await privateJwk();
  const pub: JsonWebKey = { kty, crv, x };
  // The key id is the key's own fingerprint (RFC 7638), the same way stores will compute it.
  const kid = (await verifierFromJWK(pub)).keyid;
  return { ...pub, kid, alg: "EdDSA", use: "sig" };
}

// Where Standby's public keys live. Stores fetch this to check signatures.
export function directoryOrigin() {
  return (process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? 3300}`).replace(/\/$/, "");
}

export async function signedHeaders(url: string, headers: Record<string, string>): Promise<Record<string, string>> {
  const signer = await signerFromJWK(await privateJwk());
  const all = { ...headers, "Signature-Agent": `sig1="${directoryOrigin()}";type=directory` };
  const request = new Request(url, { headers: all });
  const now = new Date();
  const fields = await sign(request, {
    signer,
    created: now,
    expires: new Date(now.getTime() + 60_000),
    nonce: generateNonce(),
    // The declaration is signed too, so nobody can change what the agent says it's allowed to do.
    additionalComponents: headers["Standby-Mandate"] ? ["standby-mandate"] : [],
  });
  return { ...all, Signature: fields.signature, "Signature-Input": fields.signatureInput };
}
