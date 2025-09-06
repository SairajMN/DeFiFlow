const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy RWA
  const RWAAssetToken = await ethers.getContractFactory("RWAAssetToken");
  const rwa = await RWAAssetToken.deploy();
  await rwa.waitForDeployment();
  console.log("RWA deployed to:", await rwa.getAddress());

  // Deploy DUSD
  const DUSD = await ethers.getContractFactory("DUSD");
  const dusd = await DUSD.deploy();
  await dusd.waitForDeployment();
  console.log("DUSD deployed to:", await dusd.getAddress());

  // Deploy Oracle
  const PriceOracleMock = await ethers.getContractFactory("PriceOracleMock");
  const oracle = await PriceOracleMock.deploy();
  await oracle.waitForDeployment();
  console.log("Oracle deployed to:", await oracle.getAddress());

  // Deploy Vault
  const CollateralVault = await ethers.getContractFactory("CollateralVault");
  const vault = await CollateralVault.deploy(
    await rwa.getAddress(),
    await dusd.getAddress(),
    await oracle.getAddress()
  );
  await vault.waitForDeployment();
  console.log("Vault deployed to:", await vault.getAddress());

  // Set vault in DUSD
  await dusd.setVault(await vault.getAddress());

  // Approximate 10% APR per second rate - use smaller value to avoid overflow
  const ratePerSecond = ethers.parseUnits("1", 9); // 1e9 ray (very small for demo)

  // Deploy LendingPool
  const LendingPool = await ethers.getContractFactory("LendingPool");
  const lendingPool = await LendingPool.deploy(await dusd.getAddress(), ratePerSecond);
  await lendingPool.waitForDeployment();
  console.log("LendingPool deployed to:", await lendingPool.getAddress());

  // Deploy YieldRouter
  const YieldRouter = await ethers.getContractFactory("YieldRouter");
  const yieldRouter = await YieldRouter.deploy(await dusd.getAddress());
  await yieldRouter.waitForDeployment();
  console.log("YieldRouter deployed to:", await yieldRouter.getAddress());

  // Deploy RWARegistry
  const RWARegistry = await ethers.getContractFactory("RWARegistry");
  const rwaRegistry = await RWARegistry.deploy(await rwa.getAddress());
  await rwaRegistry.waitForDeployment();
  console.log("RWARegistry deployed to:", await rwaRegistry.getAddress());

  // Deploy Governance
  const Governance = await ethers.getContractFactory("Governance");
  const governance = await Governance.deploy();
  await governance.waitForDeployment();
  console.log("Governance deployed to:", await governance.getAddress());

  // Seed demo
  await rwa.mint(deployer.address, ethers.parseEther("100000"));
  console.log("Minted 100000 RWA to deployer");

  console.log("Deployment complete!");
  console.log("Addresses:");
  console.log("RWA:", await rwa.getAddress());
  console.log("DUSD:", await dusd.getAddress());
  console.log("Oracle:", await oracle.getAddress());
  console.log("Vault:", await vault.getAddress());
  console.log("LendingPool:", await lendingPool.getAddress());
  console.log("YieldRouter:", await yieldRouter.getAddress());
  console.log("RWARegistry:", await rwaRegistry.getAddress());
  console.log("Governance:", await governance.getAddress());

  // Auto-inject addresses into .env
  const envPath = path.join(__dirname, '..', '.env');
  const envContent = `
RPC_URL=https://rpc.primordial.bdagscan.com
CHAIN_ID=1043
INFURA_API_KEY=8cc9eb274556489a90980d5d81faa285

# Frontend Environment Variables
VITE_BLOCKDAG_RPC_URL=https://rpc.primordial.bdagscan.com
VITE_LENDINGPOOL_ADDRESS=${await lendingPool.getAddress()}
VITE_YIELDROUTER_ADDRESS=${await yieldRouter.getAddress()}
VITE_RWAREGISTRY_ADDRESS=${await rwaRegistry.getAddress()}
VITE_GOVERNANCE_ADDRESS=${await governance.getAddress()}
`;

  fs.writeFileSync(envPath, envContent.trim());
  console.log("Addresses injected into .env file");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
