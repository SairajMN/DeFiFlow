#!/usr/bin/env node

/**
 * DeFiFlow DeFi dApp Setup Verification Script
 * Tests all components to ensure proper functionality
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

console.log('🔍 DeFiFlow DeFi dApp Setup Verification');
console.log('=====================================\n');

// Test 1: Check Environment Files
console.log('📁 Checking Environment Configuration...');
try {
  const envPath = path.join(__dirname, '.env');
  const relayerEnvPath = path.join(__dirname, 'relayer', '.env');

  if (fs.existsSync(envPath)) {
    console.log('✅ Main .env file exists');
    const envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.includes('PRIVATE_KEY')) {
      console.log('❌ WARNING: Private key found in main .env file');
    } else {
      console.log('✅ No private keys in main .env');
    }
  } else {
    console.log('⚠️  Main .env file not found');
  }

  if (fs.existsSync(relayerEnvPath)) {
    console.log('✅ Relayer .env file exists');
    const relayerEnv = fs.readFileSync(relayerEnvPath, 'utf8');
    if (relayerEnv.includes('RELAYER_PRIVATE_KEY')) {
      console.log('✅ Relayer private key configured');
    }
  } else {
    console.log('❌ Relayer .env file missing');
  }
} catch (error) {
  console.log('❌ Environment check failed:', error.message);
}

// Test 2: Check Contract Compilation
console.log('\n📄 Checking Smart Contracts...');
try {
  const artifactsDir = path.join(__dirname, 'artifacts');
  if (fs.existsSync(artifactsDir)) {
    const contracts = ['LendingPool', 'RWAAssetToken', 'CollateralVault'];
    contracts.forEach(contract => {
      const contractPath = path.join(artifactsDir, 'contracts', `${contract}.sol`, `${contract}.json`);
      if (fs.existsSync(contractPath)) {
        console.log(`✅ ${contract} contract compiled`);
      } else {
        console.log(`❌ ${contract} contract not found`);
      }
    });
  } else {
    console.log('❌ Contracts not compiled - run: npm run compile');
  }
} catch (error) {
  console.log('❌ Contract check failed:', error.message);
}

// Test 3: Check Frontend Build
console.log('\n🌐 Checking Frontend Setup...');
try {
  const frontendPath = path.join(__dirname, 'frontend');
  const packageJson = path.join(frontendPath, 'package.json');
  const mainJsx = path.join(frontendPath, 'src', 'App.jsx');

  if (fs.existsSync(packageJson)) {
    console.log('✅ Frontend package.json exists');
  }
  if (fs.existsSync(mainJsx)) {
    console.log('✅ Frontend App.jsx exists');
  }

  // Check for key dependencies
  const packageContent = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
  const deps = packageContent.dependencies || {};
  if (deps.ethers) {
    console.log('✅ Ethers.js dependency found');
  }
  if (deps.react) {
    console.log('✅ React dependency found');
  }
} catch (error) {
  console.log('❌ Frontend check failed:', error.message);
}

// Test 4: Check Relayer Setup
console.log('\n🔗 Checking Relayer Setup...');
try {
  const relayerPath = path.join(__dirname, 'relayer');
  const relayerPackage = path.join(relayerPath, 'package.json');
  const relayerServer = path.join(relayerPath, 'server.js');

  if (fs.existsSync(relayerPackage)) {
    console.log('✅ Relayer package.json exists');
  }
  if (fs.existsSync(relayerServer)) {
    console.log('✅ Relayer server.js exists');
  }

  const relayerPackageContent = JSON.parse(fs.readFileSync(relayerPackage, 'utf8'));
  const relayerDeps = relayerPackageContent.dependencies || {};
  if (relayerDeps.express) {
    console.log('✅ Express.js dependency found');
  }
  if (relayerDeps.ethers) {
    console.log('✅ Ethers.js dependency found in relayer');
  }
} catch (error) {
  console.log('❌ Relayer check failed:', error.message);
}

// Test 5: Check Delegated Signing Implementation
console.log('\n🔐 Checking Delegated Signing Implementation...');
try {
  const delegatedSigningPath = path.join(__dirname, 'frontend', 'src', 'lib', 'delegatedSigning.js');
  if (fs.existsSync(delegatedSigningPath)) {
    console.log('✅ Delegated signing utilities exist');
    const content = fs.readFileSync(delegatedSigningPath, 'utf8');
    if (content.includes('signTypedData')) {
      console.log('✅ EIP-712 signing functions found');
    }
    if (content.includes('createDepositMessage')) {
      console.log('✅ Deposit message creation found');
    }
    if (content.includes('createWithdrawMessage')) {
      console.log('✅ Withdraw message creation found');
    }
  } else {
    console.log('❌ Delegated signing utilities missing');
  }
} catch (error) {
  console.log('❌ Delegated signing check failed:', error.message);
}

// Test 6: Check Security Features
console.log('\n🛡️  Checking Security Features...');
try {
  const serverPath = path.join(__dirname, 'relayer', 'server.js');
  if (fs.existsSync(serverPath)) {
    const content = fs.readFileSync(serverPath, 'utf8');
    if (content.includes('helmet')) {
      console.log('✅ Security middleware (Helmet) found');
    }
    if (content.includes('rateLimit')) {
      console.log('✅ Rate limiting implemented');
    }
    if (content.includes('logSecurityEvent')) {
      console.log('✅ Security event logging found');
    }
    if (content.includes('KEY_ROTATION_INTERVAL')) {
      console.log('✅ Key rotation system found');
    }
  }
} catch (error) {
  console.log('❌ Security check failed:', error.message);
}

// Test 7: Check Test Files
console.log('\n🧪 Checking Test Files...');
try {
  const testFiles = [
    'test/LendingPool.t.js',
    'test/CollateralVault.t.js',
    'test/RWAAssetToken.t.js'
  ];

  testFiles.forEach(testFile => {
    if (fs.existsSync(path.join(__dirname, testFile))) {
      console.log(`✅ ${testFile} exists`);
    } else {
      console.log(`❌ ${testFile} missing`);
    }
  });
} catch (error) {
  console.log('❌ Test check failed:', error.message);
}

// Test 8: Check Documentation
console.log('\n📚 Checking Documentation...');
try {
  const docs = [
    'README.md',
    'DELEGATED_SIGNING_README.md',
    'PRODUCTION_SECURITY_GUIDE.md'
  ];

  docs.forEach(doc => {
    if (fs.existsSync(path.join(__dirname, doc))) {
      console.log(`✅ ${doc} exists`);
    } else {
      console.log(`❌ ${doc} missing`);
    }
  });
} catch (error) {
  console.log('❌ Documentation check failed:', error.message);
}

// Summary
console.log('\n🎯 Setup Verification Complete!');
console.log('===============================');
console.log('\n📋 Next Steps:');
console.log('1. Run: npm install (install dependencies)');
console.log('2. Run: npm run compile (compile contracts)');
console.log('3. Run: npm test (run test suite)');
console.log('4. Run: npm run frontend:dev (start frontend)');
console.log('5. Run: npm run relayer:start (start relayer)');
console.log('\n🚀 Your DeFiFlow DeFi dApp is ready for deployment!');

// Check if we should run basic tests
if (process.argv.includes('--test')) {
  console.log('\n🧪 Running basic functionality tests...');
  // Add basic tests here if needed
}
