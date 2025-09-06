# 🌐 LRCN
 ## Where Real Assets Meet Smart DeFi.
**Liquidity Rebalancing Credit Network — built on BlockDAG**

---

## 📌 Overview

The **LRCN DeFi Protocol** project built to demonstrate the power of **BlockDAG's EVM & SDK** for DeFi innovation.
It enables users to **lend, borrow, earn yield, and interact with synthetic real-world assets (RWA)** in a single dApp.

Key innovations:
- ⚡ **Auto-Rebalancing Credit Pools** — yield strategies rebalance dynamically.
- 🌍 **Synthetic RWA Tokens** — on-chain representation of assets (Treasuries, Real Estate).
- 🔗 **Cross-Chain Bridge Integration** — BlockDAG bridge SDK for future liquidity movement.
- 🛡 **Delegated Risk Control** — enforce borrowing caps with BlockDAG signatures.
- 🌐 **Multi-Network Support** — BlockDAG, Sepolia testnet, and Ethereum mainnet
- 🖥️ **Cross-Platform** — Web, Desktop (Electron), Mobile (Capacitor)
- 🚀 **One-Click Deployment** — Vercel, Electron, and Capacitor builds

---

## 🔐 Delegated Signing Implementation

This dApp now supports **Delegated Signing** using EIP-712 typed messages, allowing users to keep their private keys secure in their wallets while transactions are executed by a backend relayer.

### Key Features:
- ✅ **No Private Keys in Codebase** - Private keys remain in user wallets
- ✅ **EIP-712 Typed Messages** - Structured, human-readable transaction data
- ✅ **Nonce-based Replay Protection** - Prevents signature reuse
- ✅ **Signature Expiration** - Messages expire after deadline
- ✅ **Backend Relayer** - Secure transaction execution service

### Workflow:
1. **User Action**: User initiates action (e.g., lend dUSD) in frontend
2. **Message Creation**: Frontend creates EIP-712 typed message with action details
3. **Wallet Signing**: User signs the typed message with their wallet
4. **Backend Submission**: Signed message sent to relayer service
5. **Signature Verification**: Relayer verifies signature (optional, contract also verifies)
6. **Transaction Execution**: Relayer submits transaction to blockchain
7. **Contract Validation**: Smart contract verifies signature and executes action

### Security Features:
- **Replay Protection**: Nonce tracking prevents signature reuse
- **Expiration**: Messages expire after configurable deadline
- **Rate Limiting**: API endpoints protected against abuse
- **Input Validation**: All inputs validated on both frontend and backend

### For Developers:
1. **Deploy Contracts**: Deploy updated LendingPool contract with EIP-712 support
2. **Setup Relayer**: Configure and run the Node.js relayer service
3. **Update Frontend**: Use EIP-712 signing for supported actions
4. **Test Integration**: Verify end-to-end workflow functionality

### For Users:
1. **Connect Wallet**: Link your MetaMask or compatible wallet
2. **Sign Messages**: Approve actions by signing typed messages
3. **Automatic Execution**: Transactions executed securely by relayer
4. **Gas-free Experience**: No gas costs for message signing

### Security Considerations:
- **Private Key Security**: Private keys never leave the user's wallet
- **Message Clarity**: EIP-712 ensures users see exactly what they're signing
- **Expiration Protection**: Messages expire to prevent stale approvals
- **Nonce Management**: Sequential nonces prevent replay attacks
- **Rate Limiting**: Prevents abuse of the relayer service
- **Input Validation**: Comprehensive validation on all inputs
- **Error Handling**: Graceful failure handling with user feedback
- **Audit Trail**: All transactions logged for monitoring

---

## 🔒 Security Implementation Details

### EIP-712 Domain Separator
```javascript
const domain = {
  name: 'LendingPool',
  version: '1',
  chainId: 1043, // BlockDAG
  verifyingContract: lendingPoolAddress
}
```

### Typed Message Structure
```javascript
const types = {
  DepositAction: [
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }
  ]
}
```

### Contract Security Features
- **Signature Verification**: ECDSA recovery with domain separation
- **Deadline Enforcement**: Rejects expired signatures
- **Nonce Validation**: Prevents replay attacks
- **Access Control**: Only authorized users can execute actions

### Backend Security
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Sanitization**: All inputs validated and sanitized
- **Error Handling**: No sensitive information leaked in errors
- **HTTPS Only**: All communications encrypted
- **CORS Protection**: Configured for allowed origins only

---

## 🏗️ Architecture

**1. Smart Contracts (Solidity, BlockDAG EVM)**  
- `LendingPool.sol` → deposits, borrowing, repayments, withdrawals.  
- `YieldRouter.sol` → simulates auto-rebalancing yield strategies.  
- `RWARegistry.sol` → mints synthetic RWA tokens.  
- `Governance.sol` → lightweight DAO for parameter updates.  

**2. Frontend (React + TailwindCSS)**  
- Wallet connect (MetaMask + BlockDAG SDK).  
- Unified dashboard with lending & borrowing flows.  
- Live balances, yields, and governance interactions.  

**3. Backend Scripts (Node.js / Hardhat)**  
- Deployment, verification, and demo scripts.  
- Mock oracle & RWA minting scripts.  

---

## 🔑 Core Functions

### 🔹 LendingPool.sol
```solidity
function deposit(address token, uint256 amount) external;
function borrow(address token, uint256 amount) external;
function repay(address token, uint256 amount) external;
function withdraw(address token, uint256 amount) external;
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- MetaMask wallet
- BlockDAG testnet account (optional)

### Installation & Setup

```bash
# Clone repository
git clone <repository-url>
cd lrcn

# Install root dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..

# Install relayer dependencies
cd relayer && npm install && cd ..
```

### Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# Add Infura API key (already configured)
# Private key is optional and only needed for contract deployment
```

#### 🔐 Private Key Security

**Important:** Your private key is NOT stored in `.env` by default for security reasons.

**Only add your private key when deploying contracts:**

```bash
# Temporarily add your private key for deployment
echo "PRIVATE_KEY=0xyour_private_key_here" >> .env

# Deploy contracts
npm run deploy:all

# Remove private key immediately after deployment
sed -i '/PRIVATE_KEY/d' .env
```

**Alternative secure deployment methods:**
- Use Hardhat with encrypted keystore
- Deploy via hardware wallet interface
- Use deployment services with secure key management

### 🔧 Relayer Configuration

The relayer service is configured to work without a private key for development/testing:

```bash
# Relayer will start with read-only mode when private key is not configured
cd relayer && npm start

# Output:
# ⚠️ Relayer private key not configured - some features will be disabled
# Relayer server running on port 3001
```

**To enable full relayer functionality:**
```bash
# Add relayer private key to relayer/.env
echo "RELAYER_PRIVATE_KEY=0xyour_relayer_private_key" >> relayer/.env
```

### Deploy Contracts

```bash
# Compile contracts
npm run compile

# Deploy all contracts to BlockDAG testnet
npm run deploy:all

# Or deploy to specific network
npx hardhat run script/deploy-all.js --network sepolia
```

### Start Development

```bash
# Start frontend (port 5173)
npm run frontend:dev

# Start relayer service (port 3001)
npm run relayer:start

# Open http://localhost:5173 in browser
```

---

## 🌐 Network Support

The dApp supports multiple networks:

- **BlockDAG Testnet** (Primary)
- **Sepolia Testnet** (Ethereum)
- **Ethereum Mainnet**

Switch networks using the dropdown in the header. Contract addresses are automatically loaded for each network.

---

## 🖥️ Cross-Platform Builds

### Desktop (Electron)

```bash
# Development
npm run desktop:dev

# Production build
npm run build:desktop

# Creates: .exe (Windows), .dmg (macOS), .AppImage (Linux)
```

### Mobile (Capacitor)

```bash
# Build web assets
npm run frontend:build

# Generate mobile projects
npm run build:mobile

# Open in Android Studio
npx cap open android

# Open in XCode
npx cap open ios
```

### Web (Vercel)

```bash
# Deploy to Vercel
vercel --prod

# Or use Vercel CLI
npm run frontend:build
vercel deploy --prebuilt
```

---

## 📋 Project Structure

```
/contracts                 # Solidity smart contracts
├── LendingPool.sol       # Main lending protocol
├── YieldRouter.sol       # Yield farming strategies
├── RWARegistry.sol       # RWA tokenization
├── Governance.sol        # DAO governance
└── ...

/frontend                  # React + Vite application
├── src/
│   ├── components/       # React components
│   ├── lib/             # Utilities & configs
│   └── ...
├── dist/                # Built assets
└── ...

/desktop                  # Electron desktop build
├── main.js              # Electron main process
├── package.json         # Desktop dependencies
└── ...

/mobile                  # Capacitor mobile build
├── capacitor.config.json
└── ...

/relayer                  # Backend relayer service
├── server.js           # Express server
└── ...

/scripts                 # Deployment & utility scripts
└── deploy-all.js       # Full deployment script
```

---

## 🎯 Hackathon Demo Script

### For Judges & Reviewers:

1. **Network Switching Demo**
   - Show network selector dropdown
   - Switch between BlockDAG, Sepolia, Ethereum
   - Demonstrate automatic address loading

2. **Lending/Borrowing Flow**
   - Connect MetaMask wallet
   - Deposit RWA tokens as collateral
   - Borrow dUSD stablecoins
   - View real-time balances

3. **Yield Farming**
   - Lend dUSD tokens
   - View APY calculations
   - Demonstrate yield strategies

4. **Governance**
   - Create proposals
   - Vote on proposals
   - Execute approved proposals

5. **Cross-Platform**
   - Show desktop app
   - Demonstrate mobile responsiveness
   - Highlight Vercel deployment

### Key Technical Highlights:
- ✅ Multi-network support with automatic switching
- ✅ EIP-712 delegated signing for security
- ✅ Cross-platform compatibility (Web/Desktop/Mobile)
- ✅ Real-time balance updates
- ✅ Comprehensive error handling
- ✅ TypeScript-ready architecture
- ✅ Test token integration for demo purposes

### Test Tokens Configuration:
```javascript
// Your test token addresses are configured in:
frontend/src/lib/addresses.js (BlockDAG network)

// Main test tokens: 0xdE5F720670C02e5542376bD3e7163529ef5c958c
// Test token 1: 0x7679C988FFb52F7B513AE22d7845e7BAA38Bdd93
// Test token 2: 0x7679C988FFb52F7B513AE22d7845e7BAA38Bdd93
// Test token 3: 0xc95961Daa5581fd7C184CDB2Cb1B35f471E0710A
// Test token 4: 0x073Fc0d656B3714B3087ac24d283f9d05fd819b8
```

---

## 🔧 Development Scripts

```bash
# Full development setup
npm run dev              # Start all services

# Individual services
npm run frontend:dev     # Frontend only
npm run relayer:start    # Relayer only

# Build commands
npm run frontend:build   # Build frontend
npm run build:desktop    # Build desktop app
npm run build:mobile     # Build mobile app

# Deployment
npm run deploy:all       # Deploy all contracts
vercel --prod           # Deploy to Vercel
```

---

## 📊 Contract Addresses

After deployment, addresses are automatically saved to:
- `frontend/src/lib/addresses.js` (Frontend config)
- `.env` (Environment variables)

Example deployed addresses:
```
LENDINGPOOL_ADDRESS=0x1234...
YIELDROUTER_ADDRESS=0x5678...
RWAREGISTRY_ADDRESS=0x9abc...
GOVERNANCE_ADDRESS=0xdef0...
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🆘 Support

For questions or issues:
- Create an issue on GitHub
- Join our Discord community
- Check the documentation

---

**Built with ❤️ for BlockDAG Hackathon**
