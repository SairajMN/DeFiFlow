# Delegated Signing Implementation

This document describes the implementation of Delegated Signing for the LRCN dApp, which allows users to sign transactions with their wallet while keeping private keys secure and off-chain.

## Overview

The delegated signing system enables:
- Users to sign EIP-712 typed messages instead of sending raw transactions
- A backend relayer to execute transactions on behalf of users
- Complete elimination of private keys from the frontend and .env files
- Enhanced security through signature expiration and nonce-based replay protection

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React dApp    │    │   Express       │    │   Smart         │
│   Frontend      │───▶│   Relayer       │───▶│   Contract      │
│                 │    │   Backend       │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        │ 1. Sign EIP-712       │ 2. Verify & Submit   │ 3. Execute
        │    Message            │    Transaction       │    Transaction
```

## Components

### 1. Smart Contract (LendingPool.sol)

The contract supports delegated signing through:

```solidity
// EIP-712 Typed Structures
struct DepositAction {
    uint256 amount;
    uint256 nonce;
    uint256 deadline;
}

struct WithdrawAction {
    uint256 amount;
    uint256 nonce;
    uint256 deadline;
}

// Delegated Functions
function executeDeposit(DepositAction calldata action, bytes calldata signature) external
function executeWithdraw(WithdrawAction calldata action, bytes calldata signature) external

// Nonce tracking for replay protection
mapping(address => uint256) public nonces;
```

**Security Features:**
- EIP-712 structured data signing
- Deadline-based signature expiration
- Nonce-based replay attack prevention
- Signature verification using ECDSA.recover()

### 2. Backend Relayer (Node.js/Express)

The relayer service handles:

- **Input Validation**: Comprehensive validation of all request parameters
- **Security Checks**: Deadline validation, amount validation, signature verification
- **Transaction Execution**: Submitting verified transactions to the blockchain
- **Error Handling**: Detailed error responses for different failure scenarios

**Security Features:**
- Rate limiting (100 requests per 15 minutes per IP)
- Input sanitization and type validation
- Signature expiration enforcement (max 1 hour validity)
- Comprehensive error handling with specific error messages

### 3. Frontend Utilities (delegatedSigning.js)

Provides helper functions for:

```javascript
// Create EIP-712 typed messages
createDepositMessage(amount, nonce, deadline, contractAddress)
createWithdrawMessage(amount, nonce, deadline, contractAddress)

// Sign messages with wallet
signTypedMessage(signer, domain, types, message)

// Send to relayer
sendToRelayer(endpoint, payload)

// Complete flows
delegatedDeposit(signer, amount, nonce, deadline, contractAddress, relayerUrl)
delegatedWithdraw(signer, amount, nonce, deadline, contractAddress, relayerUrl)

// Utility functions
getUserNonce(userAddress, relayerUrl)
getDeadline(minutes)
```

## Workflow

### For Developers

1. **Contract Deployment**: Deploy the LendingPool contract with EIP-712 support
2. **Relayer Setup**: Configure and start the Express relayer service
3. **Environment Configuration**: Set up environment variables (no private keys needed)
4. **Frontend Integration**: Use the provided utilities in React components

### For Users

1. **Connect Wallet**: User connects their wallet (MetaMask, Ledger, etc.)
2. **Sign Transaction**: User reviews and signs the EIP-712 typed message
3. **Submit to Relayer**: Signed message is sent to the backend relayer
4. **Transaction Execution**: Relayer verifies and executes the transaction on-chain

## Security Considerations

### Signature Expiration
- Signatures expire after a configurable deadline (default: 30 minutes)
- Relayer enforces maximum deadline of 1 hour to prevent long-term signature reuse
- Expired signatures are rejected with clear error messages

### Replay Attack Protection
- Each user has a nonce that increments with each transaction
- Nonce is included in the signed message and verified by the contract
- Invalid nonce attempts are logged and rejected

### Input Validation
- All inputs are validated for type and format
- Amounts must be positive and properly formatted
- Addresses are validated using ethers.isAddress()
- Comprehensive error messages for debugging

### Rate Limiting
- API endpoints are rate-limited to prevent abuse
- 100 requests per 15-minute window per IP address
- Configurable rate limits for different environments

## API Endpoints

### POST /api/deposit
Execute a delegated deposit transaction.

**Request Body:**
```json
{
  "amount": "100.0",
  "nonce": "0",
  "deadline": "1694123456",
  "signature": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "txHash": "0x...",
  "blockNumber": 12345,
  "gasUsed": "21000",
  "message": "Deposit executed successfully"
}
```

### POST /api/withdraw
Execute a delegated withdraw transaction.

**Request Body:**
```json
{
  "amount": "50.0",
  "nonce": "1",
  "deadline": "1694123456",
  "signature": "0x..."
}
```

### GET /api/nonce/:address
Get the current nonce for a user address.

**Response:**
```json
{
  "nonce": "2"
}
```

## Environment Variables

### Relayer (.env)
```bash
RPC_URL=https://your-rpc-endpoint
CHAIN_ID=31337
RELAYER_PRIVATE_KEY=your_relayer_private_key
LENDING_POOL_ADDRESS=0x...
DUSD_ADDRESS=0x...
PORT=3001
```

### Frontend (.env)
```bash
REACT_APP_RELAYER_URL=http://localhost:3001
```

## Setting Up Relayer Private Key

### Option 1: Generate New Private Key (Recommended for Development)

1. **Using Hardhat/Node.js:**
```bash
# In your project directory
node -e "
const { ethers } = require('ethers');
const wallet = ethers.Wallet.createRandom();
console.log('Address:', wallet.address);
console.log('Private Key:', wallet.privateKey);
console.log('Mnemonic:', wallet.mnemonic.phrase);
"
```

2. **Using Python:**
```python
from eth_account import Account

# Generate new account
account = Account.create()

print(f"Address: {account.address}")
print(f"Private Key: {account.key.hex()}")
```

3. **Using web3 CLI:**
```bash
npm install -g web3
web3 account create
```

### Option 2: Use Existing Wallet (Production)

1. **Export from MetaMask:**
   - Open MetaMask → Account Options → Account Details
   - Click "Export Private Key"
   - Copy the private key

2. **Create Dedicated Relayer Wallet:**
   - Create a new MetaMask wallet specifically for the relayer
   - Export the private key for the .env file
   - Fund this wallet with sufficient ETH for gas fees

### Security Best Practices

1. **Never commit private keys to version control**
   - Add `.env` to `.gitignore`
   - Use environment-specific keys (dev/staging/prod)

2. **Use dedicated relayer wallet**
   - Separate from personal/main wallets
   - Fund only with necessary ETH for gas
   - Monitor transaction activity

3. **Environment-specific keys**
   - Development: Use testnet keys
   - Production: Use secure key management (AWS KMS, Azure Key Vault, etc.)

4. **Key rotation**
   - Regularly rotate relayer keys
   - Have backup keys ready
   - Test key rotation process

### Funding the Relayer

**Testnet (Sepolia, Goerli):**
```bash
# Get testnet ETH from faucets
# Sepolia: https://sepoliafaucet.com/
# Goerli: https://goerlifaucet.com/
```

**Mainnet:**
- Fund the relayer address with sufficient ETH
- Calculate gas costs: ~50,000-100,000 gas per transaction
- Monitor balance and set up alerts

### Example Setup Script

Create `setup-relayer.js`:
```javascript
const { ethers } = require('ethers');
const fs = require('fs');

async function setupRelayer() {
  // Generate new wallet
  const wallet = ethers.Wallet.createRandom();

  console.log('🔑 Relayer Setup Complete');
  console.log('========================');
  console.log(`Address: ${wallet.address}`);
  console.log(`Private Key: ${wallet.privateKey}`);
  console.log(`Mnemonic: ${wallet.mnemonic.phrase}`);
  console.log('');

  // Create .env content
  const envContent = `# Relayer Configuration
RPC_URL=http://127.0.0.1:8545
CHAIN_ID=31337
RELAYER_PRIVATE_KEY=${wallet.privateKey}
LENDING_POOL_ADDRESS=0x0000000000000000000000000000000000000000
DUSD_ADDRESS=0x0000000000000000000000000000000000000000
PORT=3001
`;

  fs.writeFileSync('relayer/.env', envContent);
  console.log('✅ Created relayer/.env file');
  console.log('');
  console.log('Next steps:');
  console.log('1. Fund the relayer address with ETH for gas');
  console.log('2. Deploy contracts and update contract addresses');
  console.log('3. Start the relayer: cd relayer && npm start');
}

setupRelayer();
```

Run with: `node setup-relayer.js`

## Testing

### Unit Tests
- Test EIP-712 message creation and signing
- Test relayer input validation
- Test contract signature verification
- Test nonce increment logic

### Integration Tests
- End-to-end delegated signing flow
- Signature expiration handling
- Replay attack prevention
- Error handling scenarios

### Security Testing
- Attempt replay attacks with same signature
- Test expired signature rejection
- Test invalid signature handling
- Test rate limiting effectiveness

## Deployment Checklist

- [ ] Smart contract deployed with EIP-712 support
- [ ] Relayer service configured and tested
- [ ] Frontend utilities integrated
- [ ] Environment variables configured
- [ ] Security audit completed
- [ ] Rate limiting configured
- [ ] Monitoring and logging set up
- [ ] Documentation updated

## Best Practices

1. **Never store private keys** in frontend code, .env files, or backend
2. **Always validate inputs** on both frontend and backend
3. **Use short signature deadlines** to minimize risk window
4. **Implement rate limiting** to prevent abuse
5. **Log security events** for monitoring and incident response
6. **Regular security audits** of the implementation
7. **Keep dependencies updated** with security patches

## Troubleshooting

### Common Issues

**Signature Verification Failed**
- Check that the contract address matches the signing domain
- Verify the EIP-712 types match between frontend and contract
- Ensure the signer address is correct

**Nonce Mismatch**
- Fetch the current nonce before creating the signature
- Ensure the nonce hasn't changed between signing and execution

**Signature Expired**
- Check system clock synchronization
- Reduce signature deadline if network latency is high
- Implement retry logic with fresh signatures

**Rate Limiting**
- Implement exponential backoff for retries
- Consider upgrading rate limits for legitimate use cases
- Monitor rate limit usage patterns

## Future Enhancements

- Multi-signature support
- Gasless transactions (meta-transactions)
- Batch transaction processing
- Cross-chain signature verification
- Hardware wallet integration improvements
- Advanced security monitoring and alerting
