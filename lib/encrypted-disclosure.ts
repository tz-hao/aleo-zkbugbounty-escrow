export const DISCLOSURE_PACKAGE_VERSION = "zkbb-disclosure-package-v1" as const;
export const DISCLOSURE_KEY_VERSION = "zkbb-disclosure-key-v1" as const;
export const DISCLOSURE_CIPHER = "ECDH-P256+HKDF-SHA256+A256GCM" as const;

type DisclosurePublicJwk = {
  kty: "EC";
  crv: "P-256";
  x: string;
  y: string;
  ext: true;
  key_ops: [];
};

type DisclosureSecretJwk = Omit<DisclosurePublicJwk, "key_ops"> & {
  d: string;
  key_ops: ["deriveBits"];
};

export type DisclosureRecipientPublicKey = {
  version: typeof DISCLOSURE_KEY_VERSION;
  algorithm: "ECDH-P256";
  keyId: string;
  publicKey: DisclosurePublicJwk;
};

export type DisclosureRecipientKeyBundle = DisclosureRecipientPublicKey & {
  decryptionKey: DisclosureSecretJwk;
};

export type EncryptedDisclosurePackage = {
  version: typeof DISCLOSURE_PACKAGE_VERSION;
  cipher: typeof DISCLOSURE_CIPHER;
  claimId: string;
  /**
   * Optional Aleo field used by Protocol V3 to bind this off-chain ciphertext
   * to the public report or dispute commitment. Legacy demo packages omit it.
   */
  protocolCommitment?: string;
  recipientKeyId: string;
  senderEphemeralPublicKey: DisclosurePublicJwk;
  iv: string;
  ciphertext: string;
  createdAt: string;
  packageHash: string;
};

type DisclosureCryptoOptions = {
  subtle?: SubtleCrypto;
  randomValues?: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>;
  now?: () => string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid disclosure package encoding");
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function normalizePublicJwk(value: JsonWebKey): DisclosurePublicJwk {
  if (
    value.kty !== "EC" ||
    value.crv !== "P-256" ||
    typeof value.x !== "string" ||
    typeof value.y !== "string"
  ) {
    throw new Error("Disclosure recipient key must be an ECDH P-256 public key");
  }
  return { kty: "EC", crv: "P-256", x: value.x, y: value.y, ext: true, key_ops: [] };
}

function normalizeSecretJwk(value: JsonWebKey): DisclosureSecretJwk {
  const publicKey = normalizePublicJwk(value);
  if (typeof value.d !== "string") throw new Error("Disclosure decryption key is invalid");
  return { ...publicKey, d: value.d, key_ops: ["deriveBits"] };
}

function canonicalPublicKey(value: DisclosurePublicJwk) {
  return JSON.stringify({
    kty: value.kty,
    crv: value.crv,
    x: value.x,
    y: value.y,
    ext: true,
    key_ops: [],
  });
}

function canonicalPackage(value: Omit<EncryptedDisclosurePackage, "packageHash">) {
  return JSON.stringify({
    version: value.version,
    cipher: value.cipher,
    claimId: value.claimId,
    ...(value.protocolCommitment ? { protocolCommitment: value.protocolCommitment } : {}),
    recipientKeyId: value.recipientKeyId,
    senderEphemeralPublicKey: JSON.parse(canonicalPublicKey(value.senderEphemeralPublicKey)),
    iv: value.iv,
    ciphertext: value.ciphertext,
    createdAt: value.createdAt,
  });
}

function canonicalAad(
  value: Pick<
    EncryptedDisclosurePackage,
    "version" | "cipher" | "claimId" | "recipientKeyId" | "senderEphemeralPublicKey" | "createdAt"
  >,
) {
  return JSON.stringify({
    version: value.version,
    cipher: value.cipher,
    claimId: value.claimId,
    ...("protocolCommitment" in value && value.protocolCommitment
      ? { protocolCommitment: value.protocolCommitment }
      : {}),
    recipientKeyId: value.recipientKeyId,
    senderEphemeralPublicKey: JSON.parse(canonicalPublicKey(value.senderEphemeralPublicKey)),
    createdAt: value.createdAt,
  });
}

async function sha256Hex(value: string, subtle: SubtleCrypto) {
  const digest = new Uint8Array(await subtle.digest("SHA-256", encoder.encode(value)));
  return `0x${Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Derives the public Aleo field stored in `BountyV3Config` from the canonical
 * ECDH public key. The first 31 SHA-256 bytes are always below the Aleo field
 * modulus; adding one excludes the forbidden `0field` sentinel. This is a
 * domain-separated identifier, not a private-key derivation.
 */
export async function deriveDisclosureKeyCommitment(
  value: DisclosureRecipientPublicKey | DisclosureRecipientKeyBundle | string,
  options?: Pick<DisclosureCryptoOptions, "subtle">,
) {
  const subtle = getSubtle(options);
  const recipient = parseDisclosurePublicKey(value);
  const expectedKeyId = await sha256Hex(canonicalPublicKey(recipient.publicKey), subtle);
  if (recipient.keyId !== expectedKeyId) throw new Error("Disclosure recipient key ID mismatch");
  const digest = new Uint8Array(await subtle.digest(
    "SHA-256",
    encoder.encode(`zkBugBounty:ProtocolV3:disclosure-key-commitment:v1:${canonicalPublicKey(recipient.publicKey)}`),
  ));
  let commitment = 0n;
  for (const byte of digest.slice(0, 31)) commitment = (commitment << 8n) + BigInt(byte);
  return `${commitment + 1n}field`;
}

async function deriveDisclosureKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
  claimId: string,
  recipientKeyId: string,
  usage: "encrypt" | "decrypt",
  subtle: SubtleCrypto,
) {
  const sharedSecret = await subtle.deriveBits({ name: "ECDH", public: publicKey }, privateKey, 256);
  const hkdfKey = await subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveKey"]);
  const salt = await subtle.digest(
    "SHA-256",
    encoder.encode(`${DISCLOSURE_PACKAGE_VERSION}:${claimId}:${recipientKeyId}`),
  );
  return subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt,
      info: encoder.encode("zkBugBounty responsible disclosure"),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}

function getSubtle(options?: DisclosureCryptoOptions) {
  return options?.subtle ?? globalThis.crypto.subtle;
}

export async function generateDisclosureRecipientKeys(
  options?: Pick<DisclosureCryptoOptions, "subtle">,
): Promise<DisclosureRecipientKeyBundle> {
  const subtle = getSubtle(options);
  const keyPair = (await subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;
  const publicKey = normalizePublicJwk(await subtle.exportKey("jwk", keyPair.publicKey));
  const decryptionKey = normalizeSecretJwk(await subtle.exportKey("jwk", keyPair.privateKey));
  const keyId = await sha256Hex(canonicalPublicKey(publicKey), subtle);
  return {
    version: DISCLOSURE_KEY_VERSION,
    algorithm: "ECDH-P256",
    keyId,
    publicKey,
    decryptionKey,
  };
}

export function exportDisclosurePublicKey(bundle: DisclosureRecipientKeyBundle) {
  const publicKey: DisclosureRecipientPublicKey = {
    version: bundle.version,
    algorithm: bundle.algorithm,
    keyId: bundle.keyId,
    publicKey: bundle.publicKey,
  };
  return JSON.stringify(publicKey, null, 2);
}

export function exportDisclosureKeyBundle(bundle: DisclosureRecipientKeyBundle) {
  return JSON.stringify(bundle, null, 2);
}

export function parseDisclosurePublicKey(value: string | unknown): DisclosureRecipientPublicKey {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object") throw new Error("Disclosure public key is invalid");
  const record = parsed as Record<string, unknown>;
  if (
    record.version !== DISCLOSURE_KEY_VERSION ||
    record.algorithm !== "ECDH-P256" ||
    typeof record.keyId !== "string"
  ) {
    throw new Error("Disclosure public key metadata is invalid");
  }
  return {
    version: DISCLOSURE_KEY_VERSION,
    algorithm: "ECDH-P256",
    keyId: record.keyId,
    publicKey: normalizePublicJwk(record.publicKey as JsonWebKey),
  };
}

export function parseDisclosureKeyBundle(value: string | unknown): DisclosureRecipientKeyBundle {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  const publicBundle = parseDisclosurePublicKey(parsed);
  const record = parsed as Record<string, unknown>;
  return {
    ...publicBundle,
    decryptionKey: normalizeSecretJwk(record.decryptionKey as JsonWebKey),
  };
}

export async function encryptDisclosureReport(
  input: {
    claimId: string;
    plaintext: string;
    recipient: DisclosureRecipientPublicKey | string;
    protocolCommitment?: string;
  },
  options?: DisclosureCryptoOptions,
): Promise<EncryptedDisclosurePackage> {
  if (!input.claimId.trim()) throw new Error("Claim ID is required");
  if (!input.plaintext.trim()) throw new Error("Disclosure report is required");
  if (input.protocolCommitment && !/^[1-9][0-9]*field$/.test(input.protocolCommitment)) {
    throw new Error("Protocol disclosure commitment must be a non-zero Aleo field literal");
  }
  const subtle = getSubtle(options);
  const recipient = parseDisclosurePublicKey(input.recipient);
  const expectedKeyId = await sha256Hex(canonicalPublicKey(recipient.publicKey), subtle);
  if (recipient.keyId !== expectedKeyId) throw new Error("Disclosure recipient key ID mismatch");
  const recipientCryptoKey = await subtle.importKey(
    "jwk",
    recipient.publicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const ephemeral = (await subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;
  const senderEphemeralPublicKey = normalizePublicJwk(
    await subtle.exportKey("jwk", ephemeral.publicKey),
  );
  const iv = (options?.randomValues ?? ((bytes) => globalThis.crypto.getRandomValues(bytes)))(
    new Uint8Array(new ArrayBuffer(12)),
  );
  const createdAt = (options?.now ?? (() => new Date().toISOString()))();
  const aadFields = {
    version: DISCLOSURE_PACKAGE_VERSION,
    cipher: DISCLOSURE_CIPHER,
    claimId: input.claimId,
    ...(input.protocolCommitment ? { protocolCommitment: input.protocolCommitment } : {}),
    recipientKeyId: recipient.keyId,
    senderEphemeralPublicKey,
    createdAt,
  } as const;
  const key = await deriveDisclosureKey(
    ephemeral.privateKey,
    recipientCryptoKey,
    input.claimId,
    recipient.keyId,
    "encrypt",
    subtle,
  );
  const ciphertext = new Uint8Array(
    await subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: encoder.encode(canonicalAad(aadFields)) },
      key,
      encoder.encode(input.plaintext),
    ),
  );
  const unsignedPackage = {
    ...aadFields,
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(ciphertext),
  };
  return {
    ...unsignedPackage,
    packageHash: await sha256Hex(canonicalPackage(unsignedPackage), subtle),
  };
}

export function parseEncryptedDisclosurePackage(
  value: string | unknown,
): EncryptedDisclosurePackage {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object") throw new Error("Encrypted disclosure package is invalid");
  const record = parsed as Record<string, unknown>;
  if (
    record.version !== DISCLOSURE_PACKAGE_VERSION ||
    record.cipher !== DISCLOSURE_CIPHER ||
    typeof record.claimId !== "string" ||
    typeof record.recipientKeyId !== "string" ||
    typeof record.iv !== "string" ||
    typeof record.ciphertext !== "string" ||
    typeof record.createdAt !== "string" ||
    typeof record.packageHash !== "string"
  ) {
    throw new Error("Encrypted disclosure package metadata is invalid");
  }
  base64UrlToBytes(record.iv);
  base64UrlToBytes(record.ciphertext);
  return {
    version: DISCLOSURE_PACKAGE_VERSION,
    cipher: DISCLOSURE_CIPHER,
    claimId: record.claimId,
    protocolCommitment: record.protocolCommitment === undefined
      ? undefined
      : typeof record.protocolCommitment === "string" && /^[1-9][0-9]*field$/.test(record.protocolCommitment)
        ? record.protocolCommitment
        : (() => { throw new Error("Encrypted disclosure package protocol commitment is invalid"); })(),
    recipientKeyId: record.recipientKeyId,
    senderEphemeralPublicKey: normalizePublicJwk(record.senderEphemeralPublicKey as JsonWebKey),
    iv: record.iv,
    ciphertext: record.ciphertext,
    createdAt: record.createdAt,
    packageHash: record.packageHash,
  };
}

/**
 * Validates the public binding before a recipient decrypts or records delivery.
 * It deliberately checks only public metadata and never accepts report plaintext.
 */
export async function verifyProtocolDisclosureBinding(
  value: EncryptedDisclosurePackage | string,
  expected: { claimId: string; protocolCommitment: string },
  options?: Pick<DisclosureCryptoOptions, "subtle">,
) {
  const packageValue = parseEncryptedDisclosurePackage(value);
  return packageValue.claimId === expected.claimId &&
    packageValue.protocolCommitment === expected.protocolCommitment &&
    await verifyDisclosurePackageHash(packageValue, options);
}

export async function verifyDisclosurePackageHash(
  value: EncryptedDisclosurePackage | string,
  options?: Pick<DisclosureCryptoOptions, "subtle">,
) {
  const packageValue = parseEncryptedDisclosurePackage(value);
  const { packageHash, ...unsignedPackage } = packageValue;
  const computed = await sha256Hex(canonicalPackage(unsignedPackage), getSubtle(options));
  return computed === packageHash;
}

export async function decryptDisclosureReport(
  input: {
    package: EncryptedDisclosurePackage | string;
    recipientKeys: DisclosureRecipientKeyBundle | string;
  },
  options?: Pick<DisclosureCryptoOptions, "subtle">,
) {
  const subtle = getSubtle(options);
  const packageValue = parseEncryptedDisclosurePackage(input.package);
  const recipientKeys = parseDisclosureKeyBundle(input.recipientKeys);
  if (!(await verifyDisclosurePackageHash(packageValue, { subtle }))) {
    throw new Error("Encrypted disclosure package integrity check failed");
  }
  if (recipientKeys.keyId !== packageValue.recipientKeyId) {
    throw new Error("Encrypted disclosure package recipient mismatch");
  }
  const expectedKeyId = await sha256Hex(canonicalPublicKey(recipientKeys.publicKey), subtle);
  if (expectedKeyId !== recipientKeys.keyId) throw new Error("Disclosure key bundle integrity check failed");
  const privateKey = await subtle.importKey(
    "jwk",
    recipientKeys.decryptionKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );
  const senderPublicKey = await subtle.importKey(
    "jwk",
    packageValue.senderEphemeralPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const key = await deriveDisclosureKey(
    privateKey,
    senderPublicKey,
    packageValue.claimId,
    packageValue.recipientKeyId,
    "decrypt",
    subtle,
  );
  const { iv, ciphertext, ...aadFieldsWithHash } = packageValue;
  const { packageHash: _packageHash, ...aadFields } = aadFieldsWithHash;
  void _packageHash;
  try {
    const plaintext = await subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64UrlToBytes(iv),
        additionalData: encoder.encode(canonicalAad(aadFields)),
      },
      key,
      base64UrlToBytes(ciphertext),
    );
    return decoder.decode(plaintext);
  } catch {
    throw new Error("Encrypted disclosure package cannot be decrypted with this recipient key");
  }
}
