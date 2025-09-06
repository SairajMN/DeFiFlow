const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function setupRelayer() {
  console.log('🔑 Setting up Delegated Signing Relayer');
  console.log('=====================================\n');

  // Generate new wallet
  const wallet = ethers.Wallet.createRandom();

  console.log('✅ New relayer wallet generated:');
  console.log('================================');
  console.log(`Address: ${wallet.address}`);
  console.log(`Private Key: ${wallet.privateKey}`);
  console.log(`Mnemonic: ${wallet.mnemonic.phrase}\n`);

  // Check if relayer directory exists
  const relayerDir = path.join(__dirname, 'relayer');
  if (!fs.existsSync(relayerDir)) {
    fs.mkdirSync(relayerDir);
    console.log('📁 Created relayer directory');
  }

  // Create .env content
  const envContent = `# Relayer Configuration for Delegated Signing
# Generated on: ${new Date().toISOString()}

# Blockchain Connection
RPC_URL=http://127.0.0.1:8545
CHAIN_ID=31337

# Relayer Wallet (KEEP THIS SECURE - Never commit to version control)
RELAYER_PRIVATE_KEY=${wallet.privateKey}

# Contract Addresses (Update after deployment)
LENDING_POOL_ADDRESS=0x0000000000000000000000000000000000000000
DUSD_ADDRESS=0x0000000000000000000000000000000000000000

# Server Configuration
PORT=3001
`;

  const envPath = path.join(relayerDir, '.env');
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Created relayer/.env file');

  // Create .env.example for reference
  const exampleContent = `# Relayer Configuration Template
RPC_URL=http://127.0.0.1:8545
CHAIN_ID=31337
RELAYER_PRIVATE_KEY=your_relayer_private_key_here
LENDING_POOL_ADDRESS=0x...
DUSD_ADDRESS=0x...
PORT=3001
`;

  const examplePath = path.join(relayerDir, '.env.example');
  fs.writeFileSync(examplePath, exampleContent);
  console.log('✅ Created relayer/.env.example template\n');

  console.log('🎯 Next Steps:');
  console.log('==============');
  console.log('1. 🔑 Fund the relayer address with ETH for gas fees');
  console.log(`   Address to fund: ${wallet.address}`);
  console.log('2. 📋 Deploy your contracts and update contract addresses in .env');
  console.log('3. 🚀 Start the relayer: cd relayer && npm start');
  console.log('4. 🧪 Test the delegated signing flow');
  console.log('\n⚠️  Security Reminder:');
  console.log('   - Never commit .env files to version control');
  console.log('   - Keep your mnemonic phrase safe for wallet recovery');
  console.log('   - Use different keys for development and production');
  console.log('   - Regularly rotate relayer keys\n');

  console.log('📚 For more information, see: DELEGATED_SIGNING_README.md');
}

setupRelayer().catch(console.error);
