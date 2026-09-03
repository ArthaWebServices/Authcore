# JWT Signing Key Rotation Drill (TASK-069)

**Frequency:** Quarterly (and on suspected compromise)
**Type:** Planned, no-downtime rotation via key overlap

## Goal

Replace the active `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` pair without invalidating valid access tokens, requiring users to re-authenticate, or causing service downtime.

## Strategy: Key Set with `kid`

AuthCore JWKS exposes all **public** keys, each tagged with a `kid`. JWTs minted with key A are verifiable as long as key A's public key remains in the JWKS.

## Pre-conditions

- Current key pair `key-A` is active
- All pods running
- `kid` algorithm in use (e.g., `authcore-{sha256-prefix}`)

## Step 1: Generate New Key Pair

```bash
# Generate new 2048-bit RSA key
openssl genrsa -out /tmp/jwt-new-private.pem 2048
openssl rsa -in /tmp/jwt-new-private.pem -pubout -out /tmp/jwt-new-public.pem
```

Compute the new `kid`:
```bash
openssl rsa -in /tmp/jwt-new-public.pem -pubin -outform DER 2>/dev/null | \
  openssl dgst -sha256 -hex | awk '{print "authcore-" substr($2, 1, 16)}'
# Output: authcore-7b9c2d8e4f1a6b3c
```

## Step 2: Add New Key to JWKS

Update config to include **both** old (`key-A`) and new (`key-B`) public keys in JWKS response:

```typescript
// src/modules/oidc/oidc.routes.ts
const keys = [buildJwk(keyA, 'authcore-aaa111'), buildJwk(keyB, 'authcore-bbb222')];
return { keys };
```

## Step 3: Switch Signing to New Key

Deploy change to use `key-B` as the signing key for **new** JWTs. Old tokens still verify against `key-A`.

```typescript
// auth.service.ts — generateAccessToken
const currentKid = 'authcore-bbb222';
const currentPrivateKey = config.JWT_PRIVATE_KEY_NEW; // injected via secret manager
```

## Step 4: Wait for Old Tokens to Expire

Access token TTL = 15 min. After deployment, wait **20 min** for all in-flight tokens to refresh and reissue with new key.

## Step 5: Remove Old Key from JWKS

After 20 min, deploy again to remove `key-A` public key from JWKS. Tokens signed with `key-A` are now un-verifiable (and have all expired anyway).

## Step 6: Rotate Private Key in Secret Store

Move `key-B` to be the "current" key in Vault / AWS Secrets Manager. Delete the old `key-A` private key from any backups.

## Step 7: Verify

- [ ] New logins receive JWTs with `kid: authcore-bbb222`
- [ ] JWKS endpoint returns only `key-B`
- [ ] All existing sessions still work
- [ ] No error spike in Sentry during rotation window
- [ ] Audit log entry: `eventType: admin.key.rotated`

## Emergency Rotation (Suspected Compromise)

If the private key is compromised:

1. **Immediately** deploy JWKS without the compromised key
2. **Forcibly** revoke all sessions (use `sessionRepo.revokeAllForUser` in batch)
3. **Require** all users to re-authenticate
4. **Audit** access logs for suspicious use of the compromised key
5. **Notify** affected users via email

## Schedule

| Quarter | Action | Owner |
|---------|--------|-------|
| Q1 | Planned rotation | Platform |
| Q2 | Planned rotation | Platform |
| Q3 | Planned rotation | Platform |
| Q4 | Planned rotation + drill | Platform + Security |

## Audit

Every rotation creates an `audit_log` entry with:
- `eventType: 'security.key.rotated'`
- `metadata: { oldKid, newKid, reason, performedBy }`
- `riskScore: 90`
