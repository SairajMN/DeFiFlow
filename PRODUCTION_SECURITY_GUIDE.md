# 🔒 Production Security Guide for LRCN DeFi dApp

## Enterprise-Grade Security Implementation

This guide outlines production-ready security measures for deploying the LRCN DeFi dApp with delegated signing.

---

## 1. 🔑 Key Management Solutions

### Multiple Enterprise Key Management Options

#### **Option A: AWS KMS**

**1. Create KMS Key**
```bash
aws kms create-key \
  --description "LRCN Relayer Private Key" \
  --key-usage SIGN_VERIFY \
  --key-spec ECC_NIST_P256
```

**2. Configure IAM Policy**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "kms:Sign",
        "kms:GetPublicKey",
        "kms:DescribeKey"
      ],
      "Resource": "arn:aws:kms:region:account:key/key-id"
    }
  ]
}
```

#### **Option B: Azure Key Vault**

**1. Create Key Vault**
```bash
az keyvault create \
  --name lrcn-relayer-kv \
  --resource-group your-resource-group \
  --location eastus
```

**2. Create ECDSA Key**
```bash
az keyvault key create \
  --vault-name lrcn-relayer-kv \
  --name relayer-key \
  --kty EC-HSM \
  --curve P-256 \
  --ops sign verify
```

**3. Azure Integration Code**
```javascript
const { DefaultAzureCredential } = require('@azure/identity');
const { CryptographyClient } = require('@azure/keyvault-keys');

class AzureRelayerSigner {
  constructor(keyVaultUrl, keyName) {
    const credential = new DefaultAzureCredential();
    this.client = new CryptographyClient(keyVaultUrl + '/keys/' + keyName, credential);
  }

  async signTransaction(tx) {
    const message = ethers.getBytes(tx.unsignedSerialized);

    const signResult = await this.client.sign('ES256', message);
    return ethers.hexlify(signResult.result);
  }
}
```

#### **Option C: Google Cloud KMS**

**1. Create Key Ring and Key**
```bash
# Create key ring
gcloud kms keyrings create lrcn-relayer \
  --location global \
  --project your-project-id

# Create asymmetric signing key
gcloud kms keys create relayer-key \
  --location global \
  --keyring lrcn-relayer \
  --purpose asymmetric-signing \
  --algorithm ec-sign-p256-sha256 \
  --protection-level hsm
```

**2. Google Cloud Integration**
```javascript
const { KeyManagementServiceClient } = require('@google-cloud/kms');

class GCPRelayerSigner {
  constructor(projectId, locationId, keyRingId, keyId, versionId) {
    this.client = new KeyManagementServiceClient();
    this.keyVersionName = this.client.cryptoKeyVersionPath(
      projectId, locationId, keyRingId, keyId, versionId
    );
  }

  async signTransaction(tx) {
    const message = ethers.getBytes(tx.unsignedSerialized);

    const [signResponse] = await this.client.asymmetricSign({
      name: this.keyVersionName,
      digest: {
        sha256: crypto.createHash('sha256').update(message).digest()
      }
    });

    return ethers.hexlify(signResponse.signature);
  }
}
```

#### **Option D: HashiCorp Vault**

**1. Setup Vault with Transit Engine**
```bash
# Enable transit engine
vault secrets enable transit

# Create ECDSA key
vault write transit/keys/relayer-key type=ecdsa-p256
```

**2. HashiCorp Vault Integration**
```javascript
const vault = require('node-vault')();

class VaultRelayerSigner {
  constructor() {
    this.vault = vault;
  }

  async signTransaction(tx) {
    const message = ethers.getBytes(tx.unsignedSerialized);
    const digest = crypto.createHash('sha256').update(message).digest('base64');

    const result = await this.vault.write('transit/sign/relayer-key/sha2-256', {
      input: digest
    });

    return result.data.signature;
  }
}
```

#### **Option E: Local HSM (Hardware Security Module)**

**1. Setup with SoftHSM**
```bash
# Install SoftHSM
sudo apt-get install softhsm2

# Initialize token
softhsm2-util --init-token --slot 0 --label lrcn-relayer --pin 1234 --so-pin 1234

# Generate ECDSA key
pkcs11-tool --module /usr/lib/softhsm/libsofthsm2.so \
  --keypairgen --key-type EC:prime256v1 \
  --login --pin 1234 \
  --id 01 \
  --label relayer-key
```

**2. HSM Integration Code**
```javascript
const { HsmSigner } = require('ethers-hsm');

class HSMSigner {
  constructor(hsmConfig) {
    this.signer = new HsmSigner(hsmConfig);
  }

  async signTransaction(tx) {
    return await this.signer.signTransaction(tx);
  }
}
```

#### **Option F: Fireblocks (Institutional Grade)**

**1. Fireblocks Setup**
```javascript
// Fireblocks provides enterprise-grade custody
const { FireblocksSDK } = require('fireblocks-sdk');

class FireblocksRelayerSigner {
  constructor(apiKey, secretKey) {
    this.fireblocks = new FireblocksSDK(apiKey, secretKey);
  }

  async signTransaction(tx) {
    const transaction = await this.fireblocks.createTransaction({
      operation: 'RAW',
      assetId: 'ETH',
      source: {
        type: 'VAULT_ACCOUNT',
        id: 'your-vault-account-id'
      },
      note: 'LRCN Relayer Transaction',
      extraParameters: {
        rawMessageData: {
          messages: [{
            content: tx.unsignedSerialized
          }]
        }
      }
    });

    return transaction.signedMessages[0].signature;
  }
}
```

### Environment Configuration for All Options

**1. AWS KMS**
```bash
NODE_ENV=production
KMS_PROVIDER=aws
AWS_REGION=us-east-1
KMS_KEY_ID=arn:aws:kms:region:account:key/key-id
```

**2. Azure Key Vault**
```bash
NODE_ENV=production
KMS_PROVIDER=azure
AZURE_CLIENT_ID=your-client-id
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_SECRET=your-client-secret
KEY_VAULT_URL=https://lrcn-relayer-kv.vault.azure.net/
KEY_NAME=relayer-key
```

**3. Google Cloud KMS**
```bash
NODE_ENV=production
KMS_PROVIDER=gcp
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=global
GCP_KEY_RING=lrcn-relayer
GCP_KEY_NAME=relayer-key
```

**4. HashiCorp Vault**
```bash
NODE_ENV=production
KMS_PROVIDER=vault
VAULT_ADDR=https://your-vault-server.com
VAULT_TOKEN=your-vault-token
VAULT_KEY_PATH=transit/keys/relayer-key
```

### Unified Key Management Interface

```javascript
class EnterpriseKeyManager {
  constructor(config) {
    this.provider = config.KMS_PROVIDER;
    this.signers = {
      aws: new AWSRelayerSigner(config),
      azure: new AzureRelayerSigner(config),
      gcp: new GCPRelayerSigner(config),
      vault: new VaultRelayerSigner(config),
      hsm: new HSMSigner(config),
      fireblocks: new FireblocksRelayerSigner(config)
    };
  }

  async signTransaction(tx) {
    const signer = this.signers[this.provider];
    if (!signer) {
      throw new Error(`Unsupported KMS provider: ${this.provider}`);
    }
    return await signer.signTransaction(tx);
  }

  async getPublicKey() {
    const signer = this.signers[this.provider];
    return await signer.getPublicKey();
  }

  async rotateKeys() {
    // Provider-specific key rotation logic
    const signer = this.signers[this.provider];
    return await signer.rotateKeys();
  }
}
```

---

## 2. 🔄 Key Rotation System

### Automated Key Rotation

**1. Rotation Schedule**
```javascript
const KEY_ROTATION_INTERVAL = 30 * 24 * 60 * 60 * 1000; // 30 days
const GRACE_PERIOD = 7 * 24 * 60 * 60 * 1000; // 7 days

class KeyRotationManager {
  constructor() {
    this.activeKeys = new Map();
    this.keyHistory = [];
  }

  async rotateKeys() {
    console.log('[KEY_ROTATION] Starting key rotation process');

    // Generate new key pair
    const newKeyPair = await this.generateNewKeyPair();

    // Add to active keys with grace period
    this.activeKeys.set(newKeyPair.publicKey, {
      privateKey: newKeyPair.privateKey,
      created: Date.now(),
      expires: Date.now() + KEY_ROTATION_INTERVAL + GRACE_PERIOD
    });

    // Update relayer configuration
    await this.updateRelayerConfig(newKeyPair);

    // Log rotation event
    this.logKeyRotation(newKeyPair.publicKey);

    return newKeyPair;
  }

  async generateNewKeyPair() {
    // Use AWS KMS or Azure Key Vault
    const wallet = ethers.Wallet.createRandom();
    return {
      publicKey: wallet.address,
      privateKey: wallet.privateKey
    };
  }
}
```

**2. Graceful Key Transition**
```javascript
// Support old signatures during transition
async verifySignature(message, signature, publicKey) {
  // Check active keys
  for (const [key, metadata] of this.activeKeys) {
    if (metadata.expires > Date.now()) {
      try {
        const recovered = ethers.verifyMessage(message, signature);
        if (recovered === key) return true;
      } catch (e) {
        continue;
      }
    }
  }
  return false;
}
```

---

## 3. 📊 Transaction Monitoring & Alerting

### Real-Time Monitoring Dashboard

**1. Security Event Types**
```javascript
const SECURITY_EVENTS = {
  LARGE_TRANSACTION: 'large_transaction',
  UNUSUAL_ACTIVITY: 'unusual_activity',
  FAILED_SIGNATURE: 'failed_signature',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  KEY_ROTATION_NEEDED: 'key_rotation_needed',
  BALANCE_LOW: 'balance_low'
};
```

**2. Alert Configuration**
```javascript
const ALERT_THRESHOLDS = {
  maxTransactionAmount: ethers.parseEther('1000'), // $1000 worth
  maxTransactionsPerHour: 100,
  minRelayerBalance: ethers.parseEther('1'), // 1 ETH
  suspiciousActivityThreshold: 5 // 5 failed attempts
};
```

**3. Monitoring Dashboard**
```javascript
app.get('/api/monitoring/dashboard', async (req, res) => {
  const dashboard = {
    relayer: {
      balance: await getRelayerBalance(),
      address: relayerAddress,
      lastTransaction: await getLastTransactionTime()
    },
    security: {
      activeAlerts: await getActiveAlerts(),
      recentEvents: await getRecentSecurityEvents(),
      keyRotationStatus: checkKeyRotationStatus()
    },
    transactions: {
      last24h: await getTransactionCount24h(),
      failedCount: await getFailedTransactionCount(),
      largeTransactions: await getLargeTransactions()
    }
  };

  res.json(dashboard);
});
```

### Alert System Integration

**1. Email Alerts**
```javascript
const nodemailer = require('nodemailer');

async function sendSecurityAlert(event) {
  const transporter = nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.ALERT_EMAIL,
      pass: process.env.ALERT_EMAIL_PASSWORD
    }
  });

  await transporter.sendMail({
    from: process.env.ALERT_EMAIL,
    to: process.env.SECURITY_TEAM_EMAIL,
    subject: `🚨 LRCN Security Alert: ${event.type}`,
    html: generateAlertTemplate(event)
  });
}
```

**2. Slack Integration**
```javascript
const { WebClient } = require('@slack/web-api');

const slack = new WebClient(process.env.SLACK_TOKEN);

async function sendSlackAlert(event) {
  await slack.chat.postMessage({
    channel: '#security-alerts',
    text: `🚨 *Security Alert*: ${event.type}`,
    attachments: [{
      color: 'danger',
      fields: [
        { title: 'Event Type', value: event.type },
        { title: 'Severity', value: event.severity },
        { title: 'Timestamp', value: event.timestamp }
      ]
    }]
  });
}
```

---

## 4. 💰 Relayer Funding Strategy

### Minimal Funding Requirements

**1. Gas Cost Calculation**
```javascript
class GasCostCalculator {
  async calculateTransactionCost(txType) {
    const gasEstimates = {
      deposit: 150000,
      withdraw: 120000,
      transfer: 65000,
      mint: 200000
    };

    const gasPrice = await provider.getGasPrice();
    const estimatedGas = gasEstimates[txType];

    return gasPrice * BigInt(estimatedGas);
  }

  async estimateMonthlyCost() {
    const dailyTransactions = 100;
    const avgGasPerTx = 100000;
    const gasPrice = await provider.getGasPrice();

    const dailyCost = gasPrice * BigInt(avgGasPerTx) * BigInt(dailyTransactions);
    const monthlyCost = dailyCost * 30n;

    return ethers.formatEther(monthlyCost);
  }
}
```

**2. Automated Funding Alerts**
```javascript
async function checkRelayerBalance() {
  const balance = await provider.getBalance(relayerAddress);
  const minBalance = ethers.parseEther('0.5'); // 0.5 ETH minimum

  if (balance < minBalance) {
    await sendFundingAlert({
      currentBalance: ethers.formatEther(balance),
      requiredBalance: ethers.formatEther(minBalance),
      address: relayerAddress
    });
  }
}
```

**3. Multi-Sig Wallet for Relayer**
```javascript
// Deploy a Gnosis Safe for relayer funding
async function setupRelayerMultiSig() {
  const safeFactory = new ethers.Contract(
    GNOSIS_SAFE_FACTORY_ADDRESS,
    GNOSIS_SAFE_FACTORY_ABI,
    signer
  );

  const safeAddress = await safeFactory.createSafe(
    owners, // Array of owner addresses
    threshold, // Required confirmations
    fallbackHandler
  );

  return safeAddress;
}
```

---

## 5. 🔐 Multi-Signature Implementation

### Large Transaction Multi-Sig

**1. Multi-Sig Threshold Configuration**
```javascript
const MULTI_SIG_THRESHOLDS = {
  small: ethers.parseEther('10'),    // 1 signature required
  medium: ethers.parseEther('100'),  // 2 signatures required
  large: ethers.parseEther('1000'),  // 3 signatures required
  critical: ethers.parseEther('10000') // 5 signatures required
};
```

**2. Multi-Sig Transaction Flow**
```javascript
async function processLargeTransaction(txData) {
  const amount = txData.amount;
  const requiredSignatures = getRequiredSignatures(amount);

  if (requiredSignatures === 1) {
    return await executeTransaction(txData);
  }

  // Create multi-sig request
  const requestId = await createMultiSigRequest(txData);

  // Notify approvers
  await notifyApprovers(requestId, requiredSignatures);

  // Wait for approvals
  const approvals = await waitForApprovals(requestId, requiredSignatures);

  if (approvals.length >= requiredSignatures) {
    return await executeMultiSigTransaction(txData, approvals);
  }

  throw new Error('Insufficient approvals for large transaction');
}

function getRequiredSignatures(amount) {
  if (amount >= MULTI_SIG_THRESHOLDS.critical) return 5;
  if (amount >= MULTI_SIG_THRESHOLDS.large) return 3;
  if (amount >= MULTI_SIG_THRESHOLDS.medium) return 2;
  return 1;
}
```

**3. Approver Management**
```javascript
class ApproverManager {
  constructor() {
    this.approvers = new Map();
    this.approvalRequests = new Map();
  }

  async addApprover(address, role) {
    this.approvers.set(address, {
      role: role,
      added: Date.now(),
      active: true
    });
  }

  async requestApproval(requestId, requester, amount) {
    const approvers = this.getEligibleApprovers(amount);

    for (const approver of approvers) {
      await sendApprovalRequest(approver, requestId, {
        requester,
        amount: ethers.formatEther(amount),
        type: 'large_transaction'
      });
    }
  }
}
```

---

## 6. 🚀 Production Deployment Checklist

### Pre-Deployment
- [ ] AWS KMS key created and configured
- [ ] Azure Key Vault setup (alternative)
- [ ] Multi-sig wallet deployed
- [ ] Alert system configured (email/Slack)
- [ ] Monitoring dashboard set up
- [ ] Load balancer configured
- [ ] SSL certificates installed

### Security Configuration
- [ ] Environment variables secured
- [ ] Database encryption enabled
- [ ] API rate limiting configured
- [ ] CORS properly configured
- [ ] Security headers enabled
- [ ] Audit logging enabled

### Monitoring & Alerting
- [ ] Transaction monitoring active
- [ ] Balance monitoring configured
- [ ] Failed transaction alerts
- [ ] Key rotation alerts
- [ ] Security event logging

### Backup & Recovery
- [ ] Database backups scheduled
- [ ] Key backup procedures documented
- [ ] Disaster recovery plan tested
- [ ] Incident response procedures ready

---

## 7. 📈 Performance & Scaling

### Database Optimization
```javascript
// Use connection pooling for database
const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: 'lrcn_security'
});
```

### Caching Strategy
```javascript
const redis = require('redis');
const client = redis.createClient();

// Cache security events for 1 hour
await client.setex('security_events', 3600, JSON.stringify(events));

// Cache user nonces
await client.setex(`user_nonce_${userAddress}`, 300, nonce);
```

### Load Balancing
```nginx
upstream relayer_backend {
    server relayer1.example.com;
    server relayer2.example.com;
    server relayer3.example.com;
}

server {
    listen 80;
    server_name api.lrcn.com;

    location / {
        proxy_pass http://relayer_backend;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

---

## 8. 🔍 Security Audit & Compliance

### Regular Security Audits
```javascript
// Automated security scanning
const securityScanner = {
  async runSecurityAudit() {
    const results = {
      keyRotation: await auditKeyRotation(),
      transactionPatterns: await auditTransactionPatterns(),
      accessLogs: await auditAccessLogs(),
      configuration: await auditConfiguration()
    };

    await generateAuditReport(results);
    await sendAuditNotifications(results);
  }
};
```

### Compliance Monitoring
```javascript
// GDPR compliance for user data
class GDPRCompliance {
  async handleDataDeletion(userAddress) {
    // Remove user data from database
    await deleteUserData(userAddress);

    // Remove from transaction logs
    await anonymizeTransactionLogs(userAddress);

    // Log deletion event
    await logDataDeletion(userAddress);
  }

  async handleDataExport(userAddress) {
    const userData = await collectUserData(userAddress);
    return generateDataExport(userData);
  }
}
```

---

## 9. 🚨 Incident Response

### Security Incident Response Plan
```javascript
class IncidentResponse {
  async handleSecurityIncident(incident) {
    // 1. Isolate affected systems
    await isolateAffectedSystems(incident);

    // 2. Assess damage
    const assessment = await assessIncidentImpact(incident);

    // 3. Notify stakeholders
    await notifyStakeholders(incident, assessment);

    // 4. Implement fixes
    await implementSecurityFixes(incident);

    // 5. Document and learn
    await documentIncident(incident);
  }
}
```

---

## 10. 📚 Additional Security Resources

### Recommended Tools
- **AWS KMS/Azure Key Vault** - Key management
- **HashiCorp Vault** - Secret management
- **Prometheus/Grafana** - Monitoring
- **ELK Stack** - Log analysis
- **Fail2Ban** - Brute force protection

### Security Standards
- **OWASP Top 10** - Web application security
- **NIST Cybersecurity Framework** - Security guidelines
- **ISO 27001** - Information security management
- **SOC 2** - Trust services criteria

### Regular Maintenance
- **Weekly** - Security log review
- **Monthly** - Key rotation check
- **Quarterly** - Full security audit
- **Annually** - Penetration testing

---

## 📞 Support & Emergency Contacts

**Security Team**: security@lrcn.com
**Emergency Hotline**: +1-800-SECURE
**AWS Support**: aws-support@lrcn.com
**Legal/Compliance**: legal@lrcn.com

---

*This production security guide ensures enterprise-grade security for your LRCN DeFi dApp. Regular updates and audits are essential for maintaining security standards.*
