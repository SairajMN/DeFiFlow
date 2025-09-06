const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LendingPool", function () {
  let dusd, lendingPool, owner, user;
  const ratePerSecond = ethers.parseUnits("1", 9); // very small rate for test (1e9 ray)

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    const DUSD = await ethers.getContractFactory("DUSD");
    dusd = await DUSD.deploy();
    await dusd.waitForDeployment();

    const LendingPool = await ethers.getContractFactory("LendingPool");
    lendingPool = await LendingPool.deploy(await dusd.getAddress(), ratePerSecond);
    await lendingPool.waitForDeployment();

    await dusd.setVault(owner.address); // set owner as vault for testing
    await dusd.mint(user.address, ethers.parseEther("100"));
  });

  it("should deposit dUSD", async function () {
    await dusd.connect(user).approve(await lendingPool.getAddress(), ethers.parseEther("50"));
    await lendingPool.connect(user).deposit(ethers.parseEther("50"));
    expect(await lendingPool.deposits(user.address)).to.equal(ethers.parseEther("50"));
  });

  it("should withdraw dUSD", async function () {
    await dusd.connect(user).approve(await lendingPool.getAddress(), ethers.parseEther("50"));
    await lendingPool.connect(user).deposit(ethers.parseEther("50"));
    await lendingPool.connect(user).withdraw(ethers.parseEther("30"));
    expect(await lendingPool.deposits(user.address)).to.equal(ethers.parseEther("20"));
  });

  it("should accrue interest", async function () {
    await dusd.connect(user).approve(await lendingPool.getAddress(), ethers.parseEther("50"));
    await lendingPool.connect(user).deposit(ethers.parseEther("50"));
    // Simulate time passing
    await ethers.provider.send("evm_increaseTime", [3600]); // 1 hour
    await lendingPool.accrue();
    expect(await lendingPool.index()).to.be.gt(ethers.parseEther("1"));
  });
});
