const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RWAAssetToken", function () {
  let rwaToken, owner, compliance, minter, burner, user1, user2;

  beforeEach(async function () {
    [owner, compliance, minter, burner, user1, user2] = await ethers.getSigners();

    const RWAAssetToken = await ethers.getContractFactory("RWAAssetToken");
    rwaToken = await RWAAssetToken.deploy();

    // Setup roles
    await rwaToken.connect(owner).grantRole(await rwaToken.COMPLIANCE_ROLE(), compliance.address);
    await rwaToken.connect(owner).grantRole(await rwaToken.MINTER_ROLE(), minter.address);
    await rwaToken.connect(owner).grantRole(await rwaToken.BURNER_ROLE(), burner.address);

    // Add users to whitelist
    await rwaToken.connect(compliance).updateWhitelist(user1.address, true);
    await rwaToken.connect(compliance).updateWhitelist(user2.address, true);

    // Set KYC verified
    await rwaToken.connect(compliance).updateKYC(user1.address, true);
    await rwaToken.connect(compliance).updateKYC(user2.address, true);
  });

  describe("Minting", function () {
    it("Should mint RWA asset correctly", async function () {
      const ipfsCid = "QmTest123";
      const name = "Test Asset";
      const description = "Test Description";
      const valuation = 1000000; // $10,000 in cents
      const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test"));

      await expect(rwaToken.connect(minter).mintAsset(
        user1.address,
        1000,
        ipfsCid,
        name,
        description,
        valuation,
        merkleRoot
      )).to.emit(rwaToken, "AssetMinted");

      expect(await rwaToken.balanceOf(user1.address)).to.equal(1000);
    });

    it("Should revert minting without MINTER_ROLE", async function () {
      await expect(rwaToken.connect(user1).mintAsset(
        user1.address,
        1000,
        "QmTest123",
        "Test",
        "Description",
        1000000,
        ethers.ZeroHash
      )).to.be.reverted;
    });
  });

  describe("Transfers", function () {
    beforeEach(async function () {
      // Mint some tokens
      await rwaToken.connect(minter).mintAsset(
        user1.address,
        1000,
        "QmTest123",
        "Test Asset",
        "Description",
        1000000,
        ethers.ZeroHash
      );
    });

    it("Should allow whitelisted transfer", async function () {
      await expect(rwaToken.connect(user1).transfer(user2.address, 500))
        .to.emit(rwaToken, "Transfer");

      expect(await rwaToken.balanceOf(user1.address)).to.equal(500);
      expect(await rwaToken.balanceOf(user2.address)).to.equal(500);
    });

    it("Should revert transfer from non-whitelisted address", async function () {
      await rwaToken.connect(compliance).updateWhitelist(user1.address, false);

      await expect(rwaToken.connect(user1).transfer(user2.address, 500))
        .to.be.revertedWith("Account not whitelisted");
    });

    it("Should revert transfer to non-whitelisted address", async function () {
      await rwaToken.connect(compliance).updateWhitelist(user2.address, false);

      await expect(rwaToken.connect(user1).transfer(user2.address, 500))
        .to.be.revertedWith("Account not whitelisted");
    });

    it("Should revert transfer with expired KYC", async function () {
      // Set KYC expiry to past
      await ethers.provider.send("evm_increaseTime", [366 * 24 * 60 * 60]); // 1 year
      await ethers.provider.send("evm_mine");

      await expect(rwaToken.connect(user1).transfer(user2.address, 500))
        .to.be.revertedWith("KYC expired or not verified");
    });
  });

  describe("Compliance", function () {
    it("Should freeze account", async function () {
      await rwaToken.connect(compliance).freezeAccount(user1.address);
      expect(await rwaToken.frozenAccounts(user1.address)).to.be.true;
    });

    it("Should prevent transfer from frozen account", async function () {
      // Mint tokens first
      await rwaToken.connect(minter).mintAsset(
        user1.address,
        1000,
        "QmTest123",
        "Test",
        "Description",
        1000000,
        ethers.ZeroHash
      );

      await rwaToken.connect(compliance).freezeAccount(user1.address);

      await expect(rwaToken.connect(user1).transfer(user2.address, 500))
        .to.be.revertedWith("Account is frozen");
    });
  });

  describe("Attestations", function () {
    it("Should add attestation without merkle proof", async function () {
      // Mint asset without merkle root
      await rwaToken.connect(minter).mintAsset(
        user1.address,
        1000,
        "QmTest123",
        "Test Asset",
        "Description",
        1000000,
        ethers.ZeroHash
      );

      const assetId = 1;
      const documentHash = ethers.keccak256(ethers.toUtf8Bytes("document"));
      const ipfsCid = "QmAttestation123";

      // Should work without merkle proof when merkle root is zero
      await expect(rwaToken.connect(compliance).addAttestation(
        assetId,
        documentHash,
        ipfsCid,
        [] // Empty proof
      )).to.emit(rwaToken, "AttestationAdded");
    });
  });
});
