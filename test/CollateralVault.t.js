const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CollateralVault", function () {
  let rwa, dusd, oracle, vault, owner, user;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    const RWAAssetToken = await ethers.getContractFactory("RWAAssetToken");
    rwa = await RWAAssetToken.deploy();
    await rwa.waitForDeployment();

    const DUSD = await ethers.getContractFactory("DUSD");
    dusd = await DUSD.deploy();
    await dusd.waitForDeployment();

    const PriceOracleMock = await ethers.getContractFactory("PriceOracleMock");
    oracle = await PriceOracleMock.deploy();
    await oracle.waitForDeployment();

    const CollateralVault = await ethers.getContractFactory("CollateralVault");
    vault = await CollateralVault.deploy(
      await rwa.getAddress(),
      await dusd.getAddress(),
      await oracle.getAddress()
    );
    await vault.waitForDeployment();

    await dusd.setVault(await vault.getAddress());
    await rwa.mint(user.address, ethers.parseEther("1000"));
  });

  it("should deposit RWA", async function () {
    await rwa.connect(user).approve(await vault.getAddress(), ethers.parseEther("100"));
    await vault.connect(user).deposit(ethers.parseEther("100"));
    expect((await vault.positions(user.address)).collateral).to.equal(ethers.parseEther("100"));
  });

  it("should borrow dUSD", async function () {
    await rwa.connect(user).approve(await vault.getAddress(), ethers.parseEther("100"));
    await vault.connect(user).deposit(ethers.parseEther("100"));
    // Borrow a smaller amount for testing
    const borrowAmount = ethers.parseEther("10");
    await vault.connect(user).borrow(borrowAmount);
    expect((await vault.positions(user.address)).debt).to.equal(borrowAmount);
  });

  it("should repay dUSD", async function () {
    await rwa.connect(user).approve(await vault.getAddress(), ethers.parseEther("100"));
    await vault.connect(user).deposit(ethers.parseEther("100"));
    const borrowAmount = ethers.parseEther("50");
    await vault.connect(user).borrow(borrowAmount);
    const repayAmount = ethers.parseEther("20");
    await dusd.connect(user).approve(await vault.getAddress(), repayAmount);
    await vault.connect(user).repay(repayAmount);
    expect((await vault.positions(user.address)).debt).to.equal(borrowAmount - repayAmount);
  });

  it("should withdraw RWA", async function () {
    await rwa.connect(user).approve(await vault.getAddress(), ethers.parseEther("100"));
    await vault.connect(user).deposit(ethers.parseEther("100"));
    const borrowAmount = ethers.parseEther("50");
    await vault.connect(user).borrow(borrowAmount);
    const repayAmount = ethers.parseEther("20");
    await dusd.connect(user).approve(await vault.getAddress(), repayAmount);
    await vault.connect(user).repay(repayAmount);
    const withdrawAmount = ethers.parseEther("10");
    await vault.connect(user).withdraw(withdrawAmount);
    expect((await vault.positions(user.address)).collateral).to.equal(ethers.parseEther("100") - withdrawAmount);
  });
});
