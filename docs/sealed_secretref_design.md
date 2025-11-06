# 🔐 Sealed SecretRef Design Document

## Purpose
This document outlines a secure and scalable approach to managing secrets within multi-tenant applications using a **single Doppler key per tenant**. The approach avoids creating per-field Doppler secrets while maintaining confidentiality, integrity, and crypto-erasure capabilities.

---

## 1. Design Overview
Instead of creating one Doppler key for every secret field (e.g., `NOTIFICATION_SLACK_SIGNING_SECRET_CORE`), we define a **Sealed SecretRef** structure that stores **encrypted data directly in the application’s state**.

A single **tenant-level KEK (Key Encryption Key)** is stored in Doppler, and all field-level values are encrypted using this KEK. Each secret field contains a self-contained encrypted payload.

---

## 2. Architecture

### 🔑 Key Hierarchy
| Level | Name | Purpose | Storage |
|-------|------|----------|----------|
| 1 | KEK | Tenant-scoped master key | Doppler (or KMS) |
| 2 | DEK | Per-field random key | Encrypted and embedded in SecretRef |
| 3 | Plaintext | Sensitive value | Never stored directly |

Each **DEK** encrypts one field value (e.g., Slack token). The DEK is then wrapped (encrypted) using the tenant’s KEK.

### 🧩 SecretRef Structure
Example stored in Redis, Postgres, or EventStoreDB:

```json
{
  "scheme": "secret",
  "provider": "sealed",
  "tenant": "core",
  "kekKid": "TENANT_KEK_CORE_V2",
  "alg": "XCHACHA20-POLY1305",
  "aad": "notification.slack.signingSecret",
  "blob": "<base64url>",
  "v": 2
}
```

- **`scheme`**: Identifies that this is a sealed secret reference.
- **`provider`**: Specifies the decryption source (e.g., `sealed`, `kms`, or `doppler`).
- **`tenant`**: Tenant or organization identifier.
- **`kekKid`**: The key ID or Doppler variable name holding the KEK.
- **`alg`**: Algorithm used for encryption (e.g., `AES-256-GCM`, `XChaCha20-Poly1305`).
- **`aad`**: Optional associated data (for integrity binding to a context).
- **`blob`**: Encrypted data payload containing nonce, wrapped DEK, ciphertext, and tag.
- **`v`**: Envelope version.

---

## 3. Encryption Workflow

### 🏗️ Encryption (Sealing)
1. Generate a random **DEK** (Data Encryption Key).
2. Encrypt plaintext value using DEK and the chosen AEAD algorithm.
3. Wrap (encrypt) DEK using the **tenant’s KEK** from Doppler.
4. Concatenate or JSON-encode the result as a single **sealed blob**.
5. Store this as the `blob` inside the `SecretRef`.

### 🔓 Decryption (Unsealing)
1. Retrieve the **KEK** from Doppler using `kekKid`.
2. Unwrap DEK using the KEK.
3. Decrypt ciphertext using DEK and verify tag integrity.
4. Return plaintext for in-memory use only.

---

## 4. Implementation (TypeScript Example)

```ts
type SealedRef = {
  scheme: 'secret';
  provider: 'sealed';
  tenant: string;
  kekKid: string;
  alg: 'XCHACHA20-POLY1305' | 'AES-256-GCM';
  aad?: string;
  blob: string;
  v: number;
};

export class SecretRefResolver {
  constructor(private readonly env = process.env) {}

  private decode(s: string): Buffer {
    const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
    return Buffer.from((s + pad).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  }

  get(ref: SealedRef): string {
    const kek = this.env[ref.kekKid];
    if (!kek) throw new Error(`Missing KEK env: ${ref.kekKid}`);

    const blob = this.decode(ref.blob);
    // Example layout: [nonce(24) | wrappedDEK(48) | ciphertext(...) | tag(16)]
    const nonce = blob.subarray(0, 24);
    const wrappedDEK = blob.subarray(24, 24 + 48);
    const ciphertextTag = blob.subarray(24 + 48);

    const dek = unwrapDEK(wrappedDEK, Buffer.from(kek, 'base64'));
    const plaintext = aeadDecrypt(ref.alg, dek, nonce, ciphertextTag, ref.aad);

    return plaintext.toString('utf8');
  }
}
```

---

## 5. Rotation Strategy
1. **Rotate KEK** in Doppler: create a new `TENANT_KEK_CORE_V3`.
2. Update new secrets to use `kekKid: TENANT_KEK_CORE_V3`.
3. Gradually re-seal existing blobs during access or background migration.
4. Once all are rotated, remove the old KEK → instant crypto-erasure.

---

## 6. Advantages
✅ **One Doppler key per tenant** → massive scalability.
✅ **Per-field secrecy** → individual fields encrypted independently.
✅ **Crypto-erasure** → deleting/rotating KEK makes data unrecoverable.
✅ **No schema changes** → SecretRef fits neatly in existing JSON columns.
✅ **Auditable and deterministic** → each sealed secret references its key lineage via `kekKid`.

---

## 7. Operational Runbook
| Task | Steps |
|------|-------|
| **Add new tenant** | Generate new KEK → store in Doppler as `TENANT_KEK_<TENANT>_V1` |
| **Seal secret** | Encrypt field value with DEK → wrap with KEK → store `SecretRef` blob |
| **Rotate key** | Add `TENANT_KEK_<TENANT>_V2` → re-seal gradually → remove old KEK |
| **Erasure** | Delete KEK from Doppler → all blobs unrecoverable |

---

## 8. Security Considerations
- **KEK storage:** Must reside only in Doppler/KMS, never persisted elsewhere.
- **Rotation:** Enforce periodic KEK rotation (e.g., every 90 days).
- **Access control:** Restrict Doppler read permissions to trusted services.
- **Logging:** Never log decrypted values or KEK/DEK materials.
- **Integrity:** AEAD (GCM or Poly1305) ensures tamper detection.

---

## 9. Summary
This **Sealed SecretRef** model provides a scalable and secure alternative to per-field Doppler secrets. It leverages **envelope encryption** with tenant-scoped KEKs, enabling per-field confidentiality, auditable rotation, and crypto-erasure—all while simplifying operational overhead and maintaining Doppler as a single trusted key store per tenant.

