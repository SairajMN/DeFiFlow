require('dotenv').config();
const express = require('express');
const { ethers } = require('ethers');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Load environment variables
const RPC_URL = process.env.RPC_URL;
const CHAIN_ID = parseInt(process.env.CHAIN_ID);
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const LENDING_POOL_ADDRESS = process.env.LENDING_POOL_ADDRESS;
const DUSD_ADDRESS = process.env.DUSD_ADDRESS;

// Validate environment variables
if (!RPC_URL || !LENDING_POOL_ADDRESS || !DUSD_ADDRESS) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// Setup provider and signer
const provider = new ethers.JsonRpcProvider(RPC_URL);
let signer = null;

if (RELAYER_PRIVATE_KEY && RELAYER_PRIVATE_KEY !== '0xYOUR_RELAYER_PRIVATE_KEY_HERE') {
  signer = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
  console.log('Relayer wallet initialized');
} else {
  console.log('⚠️  Relayer private key not configured - some features will be disabled');
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

// API Routes
app.post('/api/deposit', async (req, res) => {
  try {
    const { amount, nonce, deadline, signature } = req.body;

    // Input validation
    if (!amount || !nonce || !deadline || !signature) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate input types
    if (typeof amount !== 'string' || typeof nonce !== 'string' || typeof deadline !== 'string' || typeof signature !== 'string') {
      return res.status(400).json({ error: 'Invalid input types' });
    }

    // Validate amount
    const parsedAmount = ethers.parseEther(amount);
    if (parsedAmount <= 0n) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    // Validate deadline (must be in future)
    const currentTime = Math.floor(Date.now() / 1000);
    const deadlineNum = parseInt(deadline);
    if (deadlineNum <= currentTime) {
      return res.status(400).json({ error: 'Signature has expired' });
    }

    // Validate deadline is not too far in future (max 1 hour)
    if (deadlineNum > currentTime + 3600) {
      return res.status(400).json({ error: 'Deadline too far in future' });
    }

    // Convert to proper types
    const action = {
      amount: parsedAmount,
      nonce: BigInt(nonce),
      deadline: BigInt(deadline)
    };

    console.log('Executing deposit:', {
      amount: amount,
      nonce: nonce,
      deadline: new Date(deadlineNum * 1000).toISOString()
    });

    // Execute the transaction
    const tx = await lendingPool.executeDeposit(action, signature);
    const receipt = await tx.wait();

    res.json({
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      message: 'Deposit executed successfully'
    });

  } catch (error) {
    console.error('Deposit error:', error);

    // Handle specific error types
    if (error.message.includes('Invalid nonce')) {
      return res.status(400).json({ error: 'Invalid nonce - possible replay attack' });
    }
    if (error.message.includes('Invalid signature')) {
      return res.status(400).json({ error: 'Invalid signature' });
    }
    if (error.message.includes('Signature expired')) {
      return res.status(400).json({ error: 'Signature has expired' });
    }

    res.status(500).json({
      error: 'Transaction failed',
      details: error.message
    });
  }
});

app.post('/api/withdraw', async (req, res) => {
  try {
    const { amount, nonce, deadline, signature } = req.body;

    // Input validation
    if (!amount || !nonce || !deadline || !signature) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate input types
    if (typeof amount !== 'string' || typeof nonce !== 'string' || typeof deadline !== 'string' || typeof signature !== 'string') {
      return res.status(400).json({ error: 'Invalid input types' });
    }

    // Validate amount
    const parsedAmount = ethers.parseEther(amount);
    if (parsedAmount <= 0n) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    // Validate deadline (must be in future)
    const currentTime = Math.floor(Date.now() / 1000);
    const deadlineNum = parseInt(deadline);
    if (deadlineNum <= currentTime) {
      return res.status(400).json({ error: 'Signature has expired' });
    }

    // Validate deadline is not too far in future (max 1 hour)
    if (deadlineNum > currentTime + 3600) {
      return res.status(400).json({ error: 'Deadline too far in future' });
    }

    // Convert to proper types
    const action = {
      amount: parsedAmount,
      nonce: BigInt(nonce),
      deadline: BigInt(deadline)
    };

    console.log('Executing withdraw:', {
      amount: amount,
      nonce: nonce,
      deadline: new Date(deadlineNum * 1000).toISOString()
    });

    // Execute the transaction
    const tx = await lendingPool.executeWithdraw(action, signature);
    const receipt = await tx.wait();

    res.json({
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      message: 'Withdraw executed successfully'
    });

  } catch (error) {
    console.error('Withdraw error:', error);

    // Handle specific error types
    if (error.message.includes('Invalid nonce')) {
      return res.status(400).json({ error: 'Invalid nonce - possible replay attack' });
    }
    if (error.message.includes('Invalid signature')) {
      return res.status(400).json({ error: 'Invalid signature' });
    }
    if (error.message.includes('Signature expired')) {
      return res.status(400).json({ error: 'Signature has expired' });
    }

    res.status(500).json({
      error: 'Transaction failed',
      details: error.message
    });
  }
});

app.get('/api/nonce/:address', async (req, res) => {
  try {
    const address = req.params.address;
    if (!ethers.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const nonce = await lendingPool.nonces(address);
    res.json({ nonce: nonce.toString() });

  } catch (error) {
    console.error('Nonce fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch nonce' });
  }
});

// RWA API Endpoints
app.post('/api/rwa/mint', async (req, res) => {
  try {
    const { to, amount, ipfsCid, name, description, valuation, merkleRoot, nonce, deadline, signature, rwaToken } = req.body;

    // Input validation
    if (!to || !amount || !ipfsCid || !name || !description || !valuation || !merkleRoot || !nonce || !deadline || !signature || !rwaToken) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate addresses
    if (!ethers.isAddress(to) || !ethers.isAddress(rwaToken)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    // Validate amount
    const parsedAmount = ethers.parseEther(amount);
    if (parsedAmount <= 0n) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    // Validate valuation
    const parsedValuation = BigInt(valuation);
    if (parsedValuation <= 0n) {
      return res.status(400).json({ error: 'Invalid valuation' });
    }

    // Validate deadline
    const currentTime = Math.floor(Date.now() / 1000);
    const deadlineNum = parseInt(deadline);
    if (deadlineNum <= currentTime) {
      return res.status(400).json({ error: 'Signature has expired' });
    }
    if (deadlineNum > currentTime + 3600) {
      return res.status(400).json({ error: 'Deadline too far in future' });
    }

    const action = {
      to: to,
      amount: parsedAmount,
      ipfsCid: ipfsCid,
      name: name,
      description: description,
      valuation: parsedValuation,
      merkleRoot: merkleRoot,
      nonce: BigInt(nonce),
      deadline: BigInt(deadline)
    };

    console.log('Executing RWA mint:', {
      to: to,
      amount: amount,
      ipfsCid: ipfsCid,
      nonce: nonce
    });

    const tx = await lendingPool.executeMintRWA(action, signature, rwaToken);
    const receipt = await tx.wait();

    res.json({
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      message: 'RWA mint executed successfully'
    });

  } catch (error) {
    console.error('RWA mint error:', error);
    res.status(500).json({
      error: 'RWA mint failed',
      details: error.message
    });
  }
});

app.post('/api/rwa/transfer', async (req, res) => {
  try {
    const { to, amount, nonce, deadline, signature, rwaToken } = req.body;

    // Input validation
    if (!to || !amount || !nonce || !deadline || !signature || !rwaToken) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate addresses
    if (!ethers.isAddress(to) || !ethers.isAddress(rwaToken)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    // Validate amount
    const parsedAmount = ethers.parseEther(amount);
    if (parsedAmount <= 0n) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    // Validate deadline
    const currentTime = Math.floor(Date.now() / 1000);
    const deadlineNum = parseInt(deadline);
    if (deadlineNum <= currentTime) {
      return res.status(400).json({ error: 'Signature has expired' });
    }
    if (deadlineNum > currentTime + 3600) {
      return res.status(400).json({ error: 'Deadline too far in future' });
    }

    const action = {
      to: to,
      amount: parsedAmount,
      nonce: BigInt(nonce),
      deadline: BigInt(deadline)
    };

    console.log('Executing RWA transfer:', {
      to: to,
      amount: amount,
      nonce: nonce
    });

    const tx = await lendingPool.executeTransferRWA(action, signature, rwaToken);
    const receipt = await tx.wait();

    res.json({
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      message: 'RWA transfer executed successfully'
    });

  } catch (error) {
    console.error('RWA transfer error:', error);
    res.status(500).json({
      error: 'RWA transfer failed',
      details: error.message
    });
  }
});

app.post('/api/rwa/burn', async (req, res) => {
  try {
    const { from, amount, nonce, deadline, signature, rwaToken } = req.body;

    // Input validation
    if (!from || !amount || !nonce || !deadline || !signature || !rwaToken) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate addresses
    if (!ethers.isAddress(from) || !ethers.isAddress(rwaToken)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    // Validate amount
    const parsedAmount = ethers.parseEther(amount);
    if (parsedAmount <= 0n) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    // Validate deadline
    const currentTime = Math.floor(Date.now() / 1000);
    const deadlineNum = parseInt(deadline);
    if (deadlineNum <= currentTime) {
      return res.status(400).json({ error: 'Signature has expired' });
    }
    if (deadlineNum > currentTime + 3600) {
      return res.status(400).json({ error: 'Deadline too far in future' });
    }

    const action = {
      from: from,
      amount: parsedAmount,
      nonce: BigInt(nonce),
      deadline: BigInt(deadline)
    };

    console.log('Executing RWA burn:', {
      from: from,
      amount: amount,
      nonce: nonce
    });

    const tx = await lendingPool.executeBurnRWA(action, signature, rwaToken);
    const receipt = await tx.wait();

    res.json({
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      message: 'RWA burn executed successfully'
    });

  } catch (error) {
    console.error('RWA burn error:', error);
    res.status(500).json({
      error: 'RWA burn failed',
      details: error.message
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Relayer server running on port ${PORT}`);
  console.log(`Connected to network: ${CHAIN_ID}`);
  console.log(`LendingPool contract: ${LENDING_POOL_ADDRESS}`);
});
