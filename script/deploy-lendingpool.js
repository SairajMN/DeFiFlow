const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying LendingPool with the account:", deployer.address);

  // Approximate 10% APR per second rate - use smaller value to avoid overflow
  const ratePerSecond = ethers.parseUnits("1", 9); // 1e9 ray (very small for demo)

  // Deploy LendingPool
  const LendingPool = await ethers.getContractFactory("LendingPool");
  const lendingPool = await LendingPool.deploy("0xA0AB3ea984cf8Ff4EC119Ce575F61d21a9D77F6c", ratePerSecond);
  await lendingPool.waitForDeployment();
  console.log("LendingPool deployed to:", await lendingPool.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
