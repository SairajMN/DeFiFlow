const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("🚀 Starting LRCN Protocol Deployment...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Get network name
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === 'unknown' ? 'blockdag' : network.name;
  console.log("Network:", networkName);

  const deployedAddresses = {};

  // Deploy DUSD first (stablecoin)
  console.log("\n📄 Deploying DUSD...");
  const DUSD = await ethers.getContractFactory("DUSD");
  const dusd = await DUSD.deploy();
  await dusd.waitForDeployment();
  deployedAddresses.dusd = await dusd.getAddress();
  console.log("✅ DUSD deployed to:", deployedAddresses.dusd);

  // Deploy PriceOracleMock
  console.log("\n📊 Deploying PriceOracleMock...");
  const PriceOracleMock = await ethers.getContractFactory("PriceOracleMock");
  const oracle = await PriceOracleMock.deploy();
  await oracle.waitForDeployment();
  deployedAddresses.oracle = await oracle.getAddress();
  console.log("✅ PriceOracleMock deployed to:", deployedAddresses.oracle);

  // Deploy RWAAssetToken
  console.log("\n🏛️ Deploying RWAAssetToken...");
  const RWAAssetToken = await ethers.getContractFactory("RWAAssetToken");
  const rwa = await RWAAssetToken.deploy();
  await rwa.waitForDeployment();
  deployedAddresses.rwa = await rwa.getAddress();
  console.log("✅ RWAAssetToken deployed to:", deployedAddresses.rwa);

  // Deploy CollateralVault
  console.log("\n🏦 Deploying CollateralVault...");
  const CollateralVault = await ethers.getContractFactory("CollateralVault");
  const vault = await CollateralVault.deploy(deployedAddresses.rwa, deployedAddresses.dusd, deployedAddresses.oracle);
  await vault.waitForDeployment();
  deployedAddresses.vault = await vault.getAddress();
  console.log("✅ CollateralVault deployed to:", deployedAddresses.vault);

  // Deploy LendingPool
  console.log("\n💰 Deploying LendingPool...");
  const LendingPool = await ethers.getContractFactory("LendingPool");
  const lendingPool = await LendingPool.deploy(deployedAddresses.dusd, deployedAddresses.vault);
  await lendingPool.waitForDeployment();
  deployedAddresses.lendingPool = await lendingPool.getAddress();
  console.log("✅ LendingPool deployed to:", deployedAddresses.lendingPool);

  // Deploy YieldRouter
  console.log("\n📈 Deploying YieldRouter...");
  const YieldRouter = await ethers.getContractFactory("YieldRouter");
  const yieldRouter = await YieldRouter.deploy();
  await yieldRouter.waitForDeployment();
  deployedAddresses.yieldRouter = await yieldRouter.getAddress();
  console.log("✅ YieldRouter deployed to:", deployedAddresses.yieldRouter);

  // Deploy RWARegistry
  console.log("\n📋 Deploying RWARegistry...");
  const RWARegistry = await ethers.getContractFactory("RWARegistry");
  const rwaRegistry = await RWARegistry.deploy();
  await rwaRegistry.waitForDeployment();
  deployedAddresses.rwaRegistry = await rwaRegistry.getAddress();
  console.log("✅ RWARegistry deployed to:", deployedAddresses.rwaRegistry);

  // Deploy Governance
  console.log("\n🏛️ Deploying Governance...");
  const Governance = await ethers.getContractFactory("Governance");
  const governance = await Governance.deploy(deployedAddresses.dusd);
  await governance.waitForDeployment();
  deployedAddresses.governance = await governance.getAddress();
  console.log("✅ Governance deployed to:", deployedAddresses.governance);

  // Update addresses.js file
  console.log("\n📝 Updating addresses configuration...");

  const addressesPath = path.join(__dirname, '..', 'frontend', 'src', 'lib', 'addresses.js');
  let addressesContent = fs.readFileSync(addressesPath, 'utf8');

  // Update the addresses for the current network
  const networkAddresses = Object.entries(deployedAddresses).map(([key, value]) => {
    return `    ${key}: '${value}'`;
  }).join(',\n');

  // Replace the network addresses
  const networkRegex = new RegExp(`(${networkName}: \\{)[^}]+(})`, 's');
  addressesContent = addressesContent.replace(networkRegex, `$1\n${networkAddresses}\n  $2`);

  fs.writeFileSync(addressesPath, addressesContent);
  console.log("✅ Addresses updated in frontend/src/lib/addresses.js");

  // Create/update .env with deployed addresses
  console.log("\n🔧 Updating environment variables...");

  let envContent = '';
  if (fs.existsSync('.env')) {
    envContent = fs.readFileSync('.env', 'utf8');
  }

  // Add deployed addresses to .env
  Object.entries(deployedAddresses).forEach(([key, value]) => {
    const envKey = key.toUpperCase() + '_ADDRESS';
    const envLine = `${envKey}=${value}`;

    // Check if line already exists
    if (envContent.includes(envKey + '=')) {
      envContent = envContent.replace(new RegExp(`${envKey}=.*`), envLine);
    } else {
      envContent += `\n${envLine}`;
    }
  });

  fs.writeFileSync('.env', envContent.trim());
  console.log("✅ Environment variables updated in .env");

  console.log("\n🎉 LRCN Protocol Deployment Complete!");
  console.log("📋 Deployed Addresses:");
  Object.entries(deployedAddresses).forEach(([key, value]) => {
    console.log(`   ${key}: ${value}`);
  });

  console.log("\n🚀 Next steps:");
  console.log("   1. Start the frontend: cd frontend && npm run dev");
  console.log("   2. Start the relayer: cd relayer && npm start");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
