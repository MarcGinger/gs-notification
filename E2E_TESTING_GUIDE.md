# SecureTest SecretRef End-to-End Testing Guide

## 🎯 **Objective**

Test the complete SecretRef implementation flow: API Controller → Use Case → SecretRef Service → Domain → Database → API Response

## 📋 **Prerequisites Checklist**

### ✅ **1. Doppler Setup (COMPLETED)**

- [x] Doppler CLI installed and authenticated
- [x] Project configured: `gs-scaffold-api`
- [x] Config configured: `dev_main`
- [x] Service Token generated: `dp.st.dev_main.OzSh3E7hM...`
- [x] Service Token stored in `.env.local`

### ✅ **2. Test Secrets in Doppler (COMPLETED)**

- [x] `SIGNING_WEBHOOK_TEST_SECRET`: `test-signing-secret-12345-for-secure-test`
- [x] `AUTH_USERNAME_TEST_USER`: `secure-test-user-2024`
- [x] `AUTH_PASSWORD_TEST_USER`: `super-secure-password-2024-test`
- [x] `WEBHOOK_TEST_SECRET`: `webhook-secret-for-integration-testing-2024`

### ✅ **3. SecretRef Implementation (COMPLETED)**

- [x] SecureTestSecretRefService implemented
- [x] Use Case integration working
- [x] Module registration complete
- [x] DTO assembler securing responses
- [x] TypeScript compilation passing

---

## 🔧 **Required Steps for E2E Testing**

### **✅ Step 1: Store Secrets Using Generated SecretRef Keys (COMPLETED)**

Our SecretRef service generates Doppler-compliant keys like:

- `SIGNING_TEST_SECURE_TEST_001_SECRET`
- `AUTH_USERNAME_TEST_SECURE_TEST_001_USER`
- `AUTH_PASSWORD_TEST_SECURE_TEST_001_PASS`

**✅ Actions Completed:**

```bash
# Secrets stored in Doppler using exact keys our SecretRef system expects
doppler secrets set SIGNING_TEST_SECURE_TEST_001_SECRET="test-signing-secret-12345-for-secure-test"
doppler secrets set AUTH_USERNAME_TEST_SECURE_TEST_001_USER="secure-test-user-2024"
doppler secrets set AUTH_PASSWORD_TEST_SECURE_TEST_001_PASS="super-secure-password-2024-test"
```

**✅ Verification Passed:**

- SecretRef factory generates Doppler-compliant keys
- All test secrets stored and accessible in Doppler
- Keys match exactly between SecretRef system and Doppler storage

### **Step 2: Fix Secret Resolution Infrastructure**

**Current Issue:** Our SecretRef service creates SecretRef objects but we need infrastructure to resolve them.

**Required Components:**

1. **SecretRef Resolution Service** - Connects to Doppler API to fetch actual values
2. **Caching Layer** - Prevents excessive API calls to Doppler
3. **Error Handling** - For missing secrets, network issues, auth failures

**Files to Check/Create:**

- `src/shared/infrastructure/secret-ref/secret-ref.service.ts` - Main resolution service
- `src/shared/infrastructure/secret-ref/cache/` - Caching implementation
- `src/shared/infrastructure/secret-ref/providers/doppler/` - Doppler provider

### **Step 3: Database Migration & Schema**

**Check Required:**

- SecureTest database table has `signing_secret_ref`, `username_ref`, `password_ref` columns
- Migration scripts handle SecretRef data types
- Repository layer can persist SecretRef objects

**Action Required:**

```bash
# Check current database schema
npm run db:schema:check

# Create migration if needed
npm run db:migration:create -- --name="add-secretref-columns-to-secure-test"
```

### **Step 4: Application Startup Configuration**

**Environment Variables Required:**

```bash
# .env.local (DO NOT COMMIT)
DOPPLER_TOKEN=dp.st.dev_main.OzSh3E7hM...
TEST_TENANT=test-tenant
TEST_NAMESPACE=secure-test

# Verify these are loaded
NODE_ENV=development
DATABASE_POSTGRES_URL=postgresql://...
CACHE_REDIS_URL=redis://localhost:6379
```

**Services to Start:**

```bash
# Start required infrastructure
docker-compose up -d postgres redis

# Start the application
npm run start:debug
```

### **Step 5: Authentication Setup**

**JWT Token Required for API Testing:**

**Option A: Generate Test Token**

```bash
# If you have a token generator script
npm run auth:generate-test-token

# Or manually create JWT with required claims:
# - sub: user-id
# - tenant: test-tenant
# - tenant_user_id: tenant-user-123
# - username: test-user
```

**Option B: Disable Auth for Testing**

```typescript
// Temporarily disable auth in controller for testing
@Controller('secure-test')
// @UseGuards(JwtAuthGuard) // Comment out for testing
export class SecureTestController {
```

### **Step 6: API Request Preparation**

**Endpoint:** `POST /webhook-config/secure-test`

**Headers:**

```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <JWT_TOKEN>",
  "X-Correlation-ID": "test-correlation-123"
}
```

**Request Body:**

```json
{
  "id": "test-secure-test-001",
  "name": "E2E SecretRef Test",
  "description": "Testing complete SecretRef flow",
  "type": "webhook",
  "signingSecret": "test-signing-secret-12345-for-secure-test",
  "signatureAlgorithm": "hmac-sha256",
  "username": "secure-test-user-2024",
  "password": "super-secure-password-2024-test"
}
```

**Expected Response:**

```json
{
  "id": "test-secure-test-001",
  "name": "E2E SecretRef Test",
  "description": "Testing complete SecretRef flow",
  "type": "webhook",
  "signingSecret": "[SecretRef Protected]",
  "signatureAlgorithm": "hmac-sha256",
  "username": "[SecretRef Protected]",
  "password": "[SecretRef Protected]",
  "createdAt": "2025-11-06T...",
  "updatedAt": "2025-11-06T...",
  "version": 1
}
```

---

## 🧪 **Testing Commands**

### **1. Unit Test SecretRef Service**

```bash
npm test -- --testPathPattern="secure-test-secretref.service"
```

### **2. Integration Test with Database**

```bash
npm run test:integration -- --testPathPattern="secure-test"
```

### **3. E2E API Test**

```bash
# Using curl
curl -X POST http://localhost:3010/webhook-config/secure-test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "X-Correlation-ID: test-e2e-123" \
  -d @test-secure-test-request.json

# Using Postman/Insomnia
# Import the request JSON and test via GUI
```

### **4. Verify Database Storage**

```sql
-- Check that SecretRef data is stored correctly
SELECT
  id,
  name,
  signing_secret_ref,
  username_ref,
  password_ref,
  created_at
FROM secure_test
WHERE id = 'test-secure-test-001';
```

### **5. Verify Secret Resolution**

```bash
# Test that secrets can be resolved from Doppler
doppler secrets get "signing/test-secure-test-001/signing-secret"
doppler secrets get "auth/username/test-secure-test-001/username"
doppler secrets get "auth/password/test-secure-test-001/password"
```

---

## 🔍 **Validation Checklist**

### **✅ Request Processing**

- [ ] API accepts plaintext secrets in request
- [ ] SecretRef service converts to SecretRef objects
- [ ] Domain factory creates entity with SecretRef fields
- [ ] Repository persists SecretRef metadata (not plaintext)

### **✅ Response Security**

- [ ] API response shows `[SecretRef Protected]` instead of plaintext
- [ ] No actual secret values in logs or responses
- [ ] SecretRef metadata properly structured

### **✅ Secret Storage**

- [ ] Actual secrets stored only in Doppler
- [ ] Database contains only SecretRef pointers
- [ ] SecretRef keys follow hierarchical pattern

### **✅ Error Handling**

- [ ] Missing secrets handled gracefully
- [ ] Doppler connection failures handled
- [ ] Invalid SecretRef keys rejected
- [ ] Proper error responses returned

---

## 🚨 **Potential Issues & Solutions**

### **Issue 1: SecretRef Resolution Not Implemented**

**Symptom:** SecretRef objects created but can't fetch actual values
**Solution:** Implement `src/shared/infrastructure/secret-ref/secret-ref.service.ts`

### **Issue 2: Database Schema Mismatch**

**Symptom:** Repository errors when saving SecretRef fields
**Solution:** Create migration for SecretRef columns

### **Issue 3: Authentication Failures**

**Symptom:** 401/403 errors from API
**Solution:** Generate valid JWT or temporarily disable auth guards

### **Issue 4: Doppler Connection Issues**

**Symptom:** Can't resolve secrets from Doppler
**Solution:** Verify `DOPPLER_TOKEN` and network connectivity

### **Issue 5: Missing Secrets in Doppler**

**Symptom:** Secret resolution fails for specific keys
**Solution:** Ensure secrets stored with exact SecretRef keys

---

## 📝 **Next Actions Priority**

1. **🔥 HIGH:** Store secrets in Doppler using generated SecretRef keys
2. **🔥 HIGH:** Verify/implement secret resolution infrastructure
3. **🔥 HIGH:** Check database schema supports SecretRef fields
4. **🟡 MEDIUM:** Set up authentication for API testing
5. **🟡 MEDIUM:** Create test request JSON files
6. **🟢 LOW:** Create automated E2E test scripts

**Ready to begin Step 1: Storing secrets with the correct keys in Doppler!** 🚀
