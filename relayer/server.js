require('dotenv').config();
const express = require('express');
const { ethers } = require('ethers');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting - Production ready
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 900 // 15 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Transaction monitoring
const transactionLog = [];
const MAX_LOG_ENTRIES = 1000;

// Security event logging
function logSecurityEvent(event) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event: event,
    ip: event.ip || 'unknown',
    userAgent: event.userAgent || 'unknown'
  };

  transactionLog.push(logEntry);
  if (transactionLog.length > MAX_LOG_ENTRIES) {
    transactionLog.shift(); // Remove oldest entries
  }

  console.log(`[SECURITY] ${JSON.stringify(logEntry)}`);
}

// Key rotation mechanism
let currentRelayerKey = null;
let keyRotationTimestamp = Date.now();
const KEY_ROTATION_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

function shouldRotateKey() {
  return Date.now() - keyRotationTimestamp > KEY_ROTATION_INTERVAL;
}

function rotateRelayerKey() {
  if (shouldRotateKey()) {
    console.log('[SECURITY] Key rotation triggered - implement manual key rotation');
    logSecurityEvent({
      type: 'KEY_ROTATION_TRIGGERED',
      message: 'Key rotation interval reached'
    });
    // In production, this would trigger automated key rotation
    // For now, we log the event for manual intervention
  }
}

// Load environment variables
const RPC_URL = process.env.RPC_URL;
const CHAIN_ID = parseInt(process.env.CHAIN_ID);
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const LENDING_POOL_ADDRESS = process.env.LENDING_POOL_ADDRESS;
const DUSD_ADDRESS = process.env.DUSD_ADDRESS;

// Validate critical environment variables
if (!RPC_URL || !LENDING_POOL_ADDRESS || !DUSD_ADDRESS) {
  console.error('❌ Missing required environment variables');
  console.error('Required: RPC_URL, LENDING_POOL_ADDRESS, DUSD_ADDRESS');
  process.exit(1);
}

// Setup provider and signer with security checks
const provider = new ethers.JsonRpcProvider(RPC_URL);
let signer = null;

if (RELAYER_PRIVATE_KEY && RELAYER_PRIVATE_KEY !== '0xYOUR_RELAYER_PRIVATE_KEY_HERE') {
  try {
    signer = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
    currentRelayerKey = RELAYER_PRIVATE_KEY;
    console.log('✅ Relayer wallet initialized');
    console.log(`📍 Relayer address: ${signer.address}`);

    // Check relayer balance
    provider.getBalance(signer.address).then(balance => {
      const balanceEth = ethers.formatEther(balance);
      console.log(`💰 Relayer balance: ${balanceEth} ETH`);

      if (parseFloat(balanceEth) < 0.01) {
        console.warn('⚠️  WARNING: Relayer balance is low (< 0.01 ETH)');
        console.warn('Fund the relayer address with sufficient ETH for gas fees');
        logSecurityEvent({
          type: 'LOW_BALANCE_WARNING',
          balance: balanceEth,
          address: signer.address
        });
      }
    });

  } catch (error) {
    console.error('❌ Invalid relayer private key:', error.message);
    process.exit(1);
  }
} else {
  console.log('⚠️  Relayer private key not configured - some features will be disabled');
  console.log('To enable relayer functionality:');
  console.log('1. Set RELAYER_PRIVATE_KEY in relayer/.env');
  console.log('2. Or use AWS KMS/Azure Key Vault for production');
}

// Production security: Multi-signature check (placeholder)
function checkMultiSigRequirement(amount) {
  const threshold = ethers.parseEther('100'); // Example: Require multi-sig for large amounts
  return amount >= threshold;
}

// Load contract ABIs
const lendingPoolAbi = [
  // executeDeposit
  {
    "inputs": [
      {
        "components": [
          {"internalType": "uint256", "name": "amount", "type": "uint256"},
          {"internalType": "uint256", "name": "nonce", "type": "uint256"},
          {"internalType": "uint256", "name": "deadline", "type": "uint256"}
        ],
        "internalType": "struct LendingPool.DepositAction",
        "name": "action",
        "type": "tuple"
      },
      {"internalType": "bytes", "name": "signature", "type": "bytes"}
    ],
    "name": "executeDeposit",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // executeWithdraw
  {
    "inputs": [
      {
        "components": [
          {"internalType": "uint256", "name": "amount", "type": "uint256"},
          {"internalType": "uint256", "name": "nonce", "type": "uint256"},
          {"internalType": "uint256", "name": "deadline", "type": "uint256"}
        ],
        "internalType": "struct LendingPool.WithdrawAction",
        "name": "action",
        "type": "tuple"
      },
      {"internalType": "bytes", "name": "signature", "type": "bytes"}
    ],
    "name": "executeWithdraw",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // executeMintRWA
  {
    "inputs": [
      {
        "components": [
          {"internalType": "address", "name": "to", "type": "address"},
          {"internalType": "uint256", "name": "amount", "type": "uint256"},
          {"internalType": "string", "name": "ipfsCid", "type": "string"},
          {"internalType": "string", "name": "name", "type": "string"},
          {"internalType": "string", "name": "description", "type": "string"},
          {"internalType": "uint256", "name": "valuation", "type": "uint256"},
          {"internalType": "bytes32", "name": "merkleRoot", "type": "bytes32"},
          {"internalType": "uint256", "name": "nonce", "type": "uint256"},
          {"internalType": "uint256", "name": "deadline", "type": "uint256"}
        ],
        "internalType": "struct LendingPool.MintRWAAction",
        "name": "action",
        "type": "tuple"
      },
      {"internalType": "bytes", "name": "signature", "type": "bytes"},
      {"internalType": "address", "name": "rwaToken", "type": "address"}
    ],
    "name": "executeMintRWA",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // executeTransferRWA
  {
    "inputs": [
      {
        "components": [
          {"internalType": "address", "name": "to", "type": "address"},
          {"internalType": "uint256", "name": "amount", "type": "uint256"},
          {"internalType": "uint256", "name": "nonce", "type": "uint256"},
          {"internalType": "uint256", "name": "deadline", "type": "uint256"}
        ],
        "internalType": "struct LendingPool.TransferRWAAction",
        "name": "action",
        "type": "tuple"
      },
      {"internalType": "bytes", "name": "signature", "type": "bytes"},
      {"internalType": "address", "name": "rwaToken", "type": "address"}
    ],
    "name": "executeTransferRWA",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // executeBurnRWA
  {
    "inputs": [
      {
        "components": [
          {"internalType": "address", "name": "from", "type": "address"},
          {"internalType": "uint256", "name": "amount", "type": "uint256"},
          {"internalType": "uint256", "name": "nonce", "type": "uint256"},
          {"internalType": "uint256", "name": "deadline", "type": "uint256"}
        ],
        "internalType": "struct LendingPool.BurnRWAAction",
        "name": "action",
        "type": "tuple"
      },
      {"internalType": "bytes", "name": "signature", "type": "bytes"},
      {"internalType": "address", "name": "rwaToken", "type": "address"}
    ],
    "name": "executeBurnRWA",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // nonces
  {
    "inputs": [{"internalType": "address", "name": "", "type": "address"}],
    "name": "nonces",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

const lendingPool = new ethers.Contract(LENDING_POOL_ADDRESS, lendingPoolAbi, signer || provider);

// Transaction monitoring middleware
app.use('/api/*', (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';

  // Log API access
  logSecurityEvent({
    type: 'API_ACCESS',
    method: req.method,
    path: req.path,
    ip: clientIP,
    userAgent: userAgent
  });

  next();
});

// API Routes with enhanced security
app.post('/api/deposit', async (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

  try {
    const { amount, nonce, deadline, signature } = req.body;

    // Input validation
    if (!amount || !nonce || !deadline || !signature) {
      logSecurityEvent({
        type: 'VALIDATION_ERROR',
        error: 'Missing required fields',
        ip: clientIP
      });
      return res.status(400).json({
        error: 'Missing required fields',
        code: 'MISSING_FIELDS'
      });
    }

    // Validate input types
    if (typeof amount !== 'string' || typeof nonce !== 'string' || typeof deadline !== 'string' || typeof signature !== 'string') {
      logSecurityEvent({
        type: 'VALIDATION_ERROR',
        error: 'Invalid input types',
        ip: clientIP
      });
      return res.status(400).json({
        error: 'Invalid input types',
        code: 'INVALID_TYPES'
      });
    }

    // Validate amount
    const parsedAmount = ethers.parseEther(amount);
    if (parsedAmount <= 0n) {
      logSecurityEvent({
        type: 'VALIDATION_ERROR',
        error: 'Invalid amount',
        amount: amount,
        ip: clientIP
      });
      return res.status(400).json({
        error: 'Amount must be greater than 0',
        code: 'INVALID_AMOUNT'
      });
    }

    // Check for multi-signature requirement
    if (checkMultiSigRequirement(parsedAmount)) {
      logSecurityEvent({
        type: 'MULTI_SIG_REQUIRED',
        amount: amount,
        ip: clientIP
      });
      return res.status(400).json({
        error: 'Large transaction requires multi-signature approval',
        code: 'MULTI_SIG_REQUIRED'
      });
    }

    // Validate deadline (must be in future)
    const currentTime = Math.floor(Date.now() / 1000);
    const deadlineNum = parseInt(deadline);
    if (deadlineNum <= currentTime) {
      logSecurityEvent({
        type: 'VALIDATION_ERROR',
        error: 'Signature expired',
        deadline: deadlineNum,
        currentTime: currentTime,
        ip: clientIP
      });
      return res.status(400).json({
        error: 'Signature has expired',
        code: 'SIGNATURE_EXPIRED'
      });
    }

    // Validate deadline is not too far in future (max 1 hour)
    if (deadlineNum > currentTime + 3600) {
      logSecurityEvent({
        type: 'VALIDATION_ERROR',
        error: 'Deadline too far in future',
        ip: clientIP
      });
      return res.status(400).json({
        error: 'Deadline too far in future',
        code: 'DEADLINE_TOO_FAR'
      });
    }

    // Check key rotation
    rotateRelayerKey();

    // Convert to proper types
    const action = {
      amount: parsedAmount,
      nonce: BigInt(nonce),
      deadline: BigInt(deadline)
    };

    console.log(`[TRANSACTION] Executing deposit: ${amount} tokens`);
    logSecurityEvent({
      type: 'TRANSACTION_START',
      action: 'deposit',
      amount: amount,
      nonce: nonce,
      ip: clientIP
    });

    // Execute the transaction
    const tx = await lendingPool.executeDeposit(action, signature);
    const receipt = await tx.wait();

    // Log successful transaction
    logSecurityEvent({
      type: 'TRANSACTION_SUCCESS',
      action: 'deposit',
      txHash: tx.hash,
      amount: amount,
      ip: clientIP
    });

    res.json({
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      message: 'Deposit executed successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ERROR] Deposit failed:', error);

    logSecurityEvent({
      type: 'TRANSACTION_FAILED',
      action: 'deposit',
      error: error.message,
      ip: clientIP
    });

    // Handle specific error types
    if (error.message.includes('Invalid nonce')) {
      return res.status(400).json({
        error: 'Invalid nonce - possible replay attack',
        code: 'INVALID_NONCE'
      });
    }
    if (error.message.includes('Invalid signature')) {
      return res.status(400).json({
        error: 'Invalid signature',
        code: 'INVALID_SIGNATURE'
      });
    }
    if (error.message.includes('Signature expired')) {
      return res.status(400).json({
        error: 'Signature has expired',
        code: 'SIGNATURE_EXPIRED'
      });
    }

    res.status(500).json({
      error: 'Transaction failed',
      details: error.message,
      code: 'TRANSACTION_FAILED'
    });
  }
});

// Security monitoring endpoint
app.get('/api/security/status', (req, res) => {
  const status = {
    relayerAddress: signer?.address || null,
    keyRotationStatus: shouldRotateKey() ? 'ROTATION_NEEDED' : 'OK',
    lastRotation: new Date(keyRotationTimestamp).toISOString(),
    transactionCount: transactionLog.length,
    recentSecurityEvents: transactionLog.slice(-10), // Last 10 events
    timestamp: new Date().toISOString()
  };

  res.json(status);
});

// Key rotation endpoint (admin only)
app.post('/api/admin/rotate-key', (req, res) => {
  // In production, this would require authentication
  const { newPrivateKey } = req.body;

  if (!newPrivateKey) {
    return res.status(400).json({
      error: 'New private key required',
      code: 'MISSING_KEY'
    });
  }

  try {
    // Validate new key
    const newWallet = new ethers.Wallet(newPrivateKey);

    // Update signer
    signer = new ethers.Wallet(newPrivateKey, provider);
    currentRelayerKey = newPrivateKey;
    keyRotationTimestamp = Date.now();

    logSecurityEvent({
      type: 'KEY_ROTATED',
      newAddress: newWallet.address,
      ip: req.ip
    });

    res.json({
      success: true,
      newAddress: newWallet.address,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logSecurityEvent({
      type: 'KEY_ROTATION_FAILED',
      error: error.message,
      ip: req.ip
    });

    res.status(400).json({
      error: 'Invalid private key',
      code: 'INVALID_KEY'
    });
  }
});

// Health check with security status
app.get('/health', (req, res) => {
  const healthStatus = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    relayer: {
      configured: !!signer,
      address: signer?.address || null,
      balance: signer ? 'Check logs for balance' : null
    },
    security: {
      keyRotationNeeded: shouldRotateKey(),
      transactionLogSize: transactionLog.length,
      rateLimitStatus: 'Active'
    }
  };

  res.json(healthStatus);
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('[ERROR] Unhandled error:', error);

  logSecurityEvent({
    type: 'UNHANDLED_ERROR',
    error: error.message,
    ip: req.ip
  });

  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SHUTDOWN] Received SIGTERM, shutting down gracefully');
  logSecurityEvent({
    type: 'SHUTDOWN',
    reason: 'SIGTERM'
  });
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[SHUTDOWN] Received SIGINT, shutting down gracefully');
  logSecurityEvent({
    type: 'SHUTDOWN',
    reason: 'SIGINT'
  });
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`🔒 Secure Relayer server running on port ${PORT}`);
  console.log(`🌐 Connected to network: ${CHAIN_ID}`);
  console.log(`📋 LendingPool contract: ${LENDING_POOL_ADDRESS}`);
  console.log(`🛡️  Security features: ACTIVE`);
  console.log(`📊 Monitoring: ENABLED`);
  console.log(`🔄 Key rotation: ${KEY_ROTATION_INTERVAL / (24 * 60 * 60 * 1000)} days`);
});

// Periodic security checks
setInterval(() => {
  rotateRelayerKey();
}, 60 * 60 * 1000); // Check every hour
