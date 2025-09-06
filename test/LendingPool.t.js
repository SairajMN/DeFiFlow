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

  describe("Delegated Signing", function () {
    it("should execute delegated deposit with valid signature", async function () {
      const amount = ethers.parseEther("10");
      const nonce = await lendingPool.nonces(user.address);
      const deadline = (await ethers.provider.getBlock('latest')).timestamp + 3600; // 1 hour from now

      // Create EIP-712 signature
      const domain = {
        name: "LendingPool",
        version: "1",
        chainId: 31337, // Hardhat network
        verifyingContract: await lendingPool.getAddress()
      };

      const types = {
        DepositAction: [
          { name: 'amount', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
        ]
      };

      const message = {
        amount: amount,
        nonce: nonce,
        deadline: deadline
      };

      const signature = await user.signTypedData(domain, types, message);

      // Execute delegated deposit
      await dusd.connect(user).approve(await lendingPool.getAddress(), amount);
      await lendingPool.connect(user).executeDeposit(
        { amount, nonce, deadline },
        signature
      );

      expect(await lendingPool.deposits(user.address)).to.equal(amount);
    });

    it("should execute delegated withdraw with valid signature", async function () {
      // First deposit some funds
      await dusd.connect(user).approve(await lendingPool.getAddress(), ethers.parseEther("50"));
      await lendingPool.connect(user).deposit(ethers.parseEther("50"));

      const amount = ethers.parseEther("20");
      const nonce = await lendingPool.nonces(user.address);
      const deadline = (await ethers.provider.getBlock('latest')).timestamp + 3600;

      // Create EIP-712 signature
      const domain = {
        name: "LendingPool",
        version: "1",
        chainId: 31337,
        verifyingContract: await lendingPool.getAddress()
      };

      const types = {
        WithdrawAction: [
          { name: 'amount', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
        ]
      };

      const message = {
        amount: amount,
        nonce: nonce,
        deadline: deadline
      };

      const signature = await user.signTypedData(domain, types, message);

      // Execute delegated withdraw
      await lendingPool.connect(user).executeWithdraw(
        { amount, nonce, deadline },
        signature
      );

      expect(await lendingPool.deposits(user.address)).to.equal(ethers.parseEther("30"));
    });

    it("should reject delegated transaction with invalid nonce", async function () {
      const amount = ethers.parseEther("10");
      const invalidNonce = 999; // Invalid nonce
      const deadline = (await ethers.provider.getBlock('latest')).timestamp + 3600;

      const domain = {
        name: "LendingPool",
        version: "1",
        chainId: 31337,
        verifyingContract: await lendingPool.getAddress()
      };

      const types = {
        DepositAction: [
          { name: 'amount', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
        ]
      };

      const message = {
        amount: amount,
        nonce: invalidNonce,
        deadline: deadline
      };

      const signature = await user.signTypedData(domain, types, message);

      await expect(
        lendingPool.connect(owner).executeDeposit(
          { amount, nonce: invalidNonce, deadline },
          signature
        )
      ).to.be.revertedWith("Invalid nonce");
    });

    it("should reject delegated transaction with expired deadline", async function () {
      const amount = ethers.parseEther("10");
      const nonce = await lendingPool.nonces(user.address);
      const expiredDeadline = (await ethers.provider.getBlock('latest')).timestamp - 3600; // Already expired

      const domain = {
        name: "LendingPool",
        version: "1",
        chainId: 31337,
        verifyingContract: await lendingPool.getAddress()
      };

      const types = {
        DepositAction: [
          { name: 'amount', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
        ]
      };

      const message = {
        amount: amount,
        nonce: nonce,
        deadline: expiredDeadline
      };

      const signature = await user.signTypedData(domain, types, message);

      await expect(
        lendingPool.connect(owner).executeDeposit(
          { amount, nonce, deadline: expiredDeadline },
          signature
        )
      ).to.be.revertedWith("Signature expired");
    });
  });
});
