const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Minting RWA tokens for:", deployer.address);

  // Load addresses from .env if available
  const envPath = path.join(__dirname, '..', '.env');
  let rwaAddress = process.env.RWA_ADDRESS;

  if (!rwaAddress) {
    // Try to find RWA contract from artifacts
    try {
      const deploymentPath = path.join(__dirname, '..', 'deployments.json');
      if (fs.existsSync(deploymentPath)) {
        const deployments = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
        rwaAddress = deployments.rwa;
      }
    } catch (error) {
      console.log("No deployment file found, trying default address...");
    }
  }

  if (!rwaAddress) {
    console.error("❌ RWA contract address not found. Please deploy contracts first or set VITE_RWA_ADDRESS in .env");
    process.exit(1);
  }

  console.log("Using RWA contract:", rwaAddress);

  // Get contract instance
  const rwa = await ethers.getContractAt("RWAAssetToken", rwaAddress);

  // Check if deployer has MINTER_ROLE
  const minterRole = await rwa.MINTER_ROLE();
  const hasMinterRole = await rwa.hasRole(minterRole, deployer.address);

  if (!hasMinterRole) {
    console.log("⚠️  Granting MINTER_ROLE to deployer...");
    const defaultAdminRole = await rwa.DEFAULT_ADMIN_ROLE();
    await rwa.grantRole(minterRole, deployer.address);
    console.log("✅ MINTER_ROLE granted");
  }

  // Check and setup compliance
  const complianceRole = await rwa.COMPLIANCE_ROLE();
  const hasComplianceRole = await rwa.hasRole(complianceRole, deployer.address);

  if (!hasComplianceRole) {
    console.log("⚠️  Granting COMPLIANCE_ROLE to deployer...");
    await rwa.grantRole(complianceRole, deployer.address);
    console.log("✅ COMPLIANCE_ROLE granted");
  }

  // Setup compliance for deployer
  console.log("📋 Setting up compliance...");
  await rwa.updateWhitelist(deployer.address, true);
  await rwa.updateKYC(deployer.address, true);
  console.log("✅ Compliance setup complete");

  // Mint RWA tokens
  console.log("🪙 Minting RWA tokens...");

  const mintTx = await rwa.mintAsset(
    deployer.address,
    ethers.parseEther("10000"), // 10,000 RWA tokens
    "QmTestRWA123456789", // Test IPFS CID
    "Demo Real Estate Token",
    "Tokenized commercial real estate property for testing LRCN platform",
    100000000, // $1,000,000 valuation in cents
    ethers.ZeroHash // No merkle root for simple minting
  );

  await mintTx.wait();
  console.log("✅ RWA tokens minted successfully!");

  // Check balance
  const balance = await rwa.balanceOf(deployer.address);
  console.log("💰 Your RWA Balance:", ethers.formatEther(balance));

  // Save minting info
  const mintingInfo = {
    contractAddress: rwaAddress,
    recipient: deployer.address,
    amount: "10000",
    assetName: "Demo Real Estate Token",
    valuation: "$1,000,000",
    timestamp: new Date().toISOString()
  };

  const infoPath = path.join(__dirname, '..', 'minting-info.json');
  fs.writeFileSync(infoPath, JSON.stringify(mintingInfo, null, 2));
  console.log("📄 Minting info saved to minting-info.json");

  console.log("\n🎉 Success! You now have RWA tokens to test the LRCN platform!");
  console.log("💡 Next steps:");
  console.log("   1. Start the frontend: npm run dev");
  console.log("   2. Connect your wallet");
  console.log("   3. Deposit RWA tokens as collateral");
  console.log("   4. Borrow dUSD stablecoins");
}

main().catch((error) => {
  console.error("❌ Minting failed:", error);
  process.exitCode = 1;
});
