// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract RWAAssetToken is ERC20, Ownable, AccessControl {
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    struct AssetMetadata {
        string ipfsCid;
        string name;
        string description;
        uint256 valuation; // USD cents
        uint256 createdAt;
        bytes32 merkleRoot; // For batch attestations
        bool frozen;
    }

    struct Attestation {
        bytes32 documentHash;
        address attestor;
        uint256 timestamp;
        string ipfsCid;
    }

    // Asset ID to metadata
    mapping(uint256 => AssetMetadata) public assetMetadata;
    // Asset ID to attestations
    mapping(uint256 => Attestation[]) public assetAttestations;

    // Whitelist for transfers
    mapping(address => bool) public whitelist;
    // Frozen accounts
    mapping(address => bool) public frozenAccounts;

    // KYC/AML compliance
    mapping(address => bool) public kycVerified;
    mapping(address => uint256) public kycExpiry;

    uint256 public nextAssetId = 1;
    uint256 public constant MAX_VALUATION = 1_000_000_000 * 100; // $1B max
    uint256 public constant KYC_VALIDITY_PERIOD = 365 days;

    event AssetMinted(uint256 indexed assetId, address indexed to, uint256 amount, string ipfsCid);
    event AssetBurned(uint256 indexed assetId, address indexed from, uint256 amount);
    event AttestationAdded(uint256 indexed assetId, bytes32 documentHash, address attestor);
    event AccountFrozen(address indexed account);
    event AccountUnfrozen(address indexed account);
    event WhitelistUpdated(address indexed account, bool status);
    event KYCUpdated(address indexed account, bool verified, uint256 expiry);

    constructor()
        ERC20("Real World Asset Token", "RWA")
        Ownable(msg.sender)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(COMPLIANCE_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(BURNER_ROLE, msg.sender);
    }

    modifier onlyCompliance() {
        require(hasRole(COMPLIANCE_ROLE, msg.sender), "Caller is not compliance officer");
        _;
    }

    modifier notFrozen(address account) {
        require(!frozenAccounts[account], "Account is frozen");
        _;
    }

    modifier onlyWhitelisted(address account) {
        require(whitelist[account] || hasRole(COMPLIANCE_ROLE, msg.sender), "Account not whitelisted");
        _;
    }

    modifier kycValid(address account) {
        require(kycVerified[account] && block.timestamp <= kycExpiry[account], "KYC expired or not verified");
        _;
    }

    function mintAsset(
        address to,
        uint256 amount,
        string memory ipfsCid,
        string memory name,
        string memory description,
        uint256 valuation,
        bytes32 merkleRoot
    ) external onlyRole(MINTER_ROLE) returns (uint256) {
        require(amount > 0, "Amount must be greater than 0");
        require(valuation > 0 && valuation <= MAX_VALUATION, "Invalid valuation");
        require(bytes(ipfsCid).length > 0, "IPFS CID required");
        require(bytes(name).length > 0, "Asset name required");

        uint256 assetId = nextAssetId++;
        assetMetadata[assetId] = AssetMetadata({
            ipfsCid: ipfsCid,
            name: name,
            description: description,
            valuation: valuation,
            createdAt: block.timestamp,
            merkleRoot: merkleRoot,
            frozen: false
        });

        _mint(to, amount);
        emit AssetMinted(assetId, to, amount, ipfsCid);
        return assetId;
    }

    function burnAsset(uint256 assetId, address from, uint256 amount) external onlyRole(BURNER_ROLE) {
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(from) >= amount, "Insufficient balance");

        _burn(from, amount);
        emit AssetBurned(assetId, from, amount);
    }

    function addAttestation(
        uint256 assetId,
        bytes32 documentHash,
        string memory ipfsCid,
        bytes32[] calldata merkleProof
    ) external onlyRole(COMPLIANCE_ROLE) {
        require(assetMetadata[assetId].createdAt > 0, "Asset does not exist");

        // Verify against merkle root if provided
        if (assetMetadata[assetId].merkleRoot != bytes32(0)) {
            bytes32 leaf = keccak256(abi.encodePacked(documentHash, ipfsCid));
            require(MerkleProof.verify(merkleProof, assetMetadata[assetId].merkleRoot, leaf), "Invalid merkle proof");
        }

        assetAttestations[assetId].push(Attestation({
            documentHash: documentHash,
            attestor: msg.sender,
            timestamp: block.timestamp,
            ipfsCid: ipfsCid
        }));

        emit AttestationAdded(assetId, documentHash, msg.sender);
    }

    function transfer(address to, uint256 amount)
        public
        override
        notFrozen(msg.sender)
        notFrozen(to)
        onlyWhitelisted(msg.sender)
        onlyWhitelisted(to)
        kycValid(msg.sender)
        kycValid(to)
        returns (bool)
    {
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount)
        public
        override
        notFrozen(from)
        notFrozen(to)
        onlyWhitelisted(from)
        onlyWhitelisted(to)
        kycValid(from)
        kycValid(to)
        returns (bool)
    {
        return super.transferFrom(from, to, amount);
    }

    // Compliance functions
    function freezeAccount(address account) external onlyCompliance {
        frozenAccounts[account] = true;
        emit AccountFrozen(account);
    }

    function unfreezeAccount(address account) external onlyCompliance {
        frozenAccounts[account] = false;
        emit AccountUnfrozen(account);
    }

    function updateWhitelist(address account, bool status) external onlyCompliance {
        whitelist[account] = status;
        emit WhitelistUpdated(account, status);
    }

    function batchUpdateWhitelist(address[] calldata accounts, bool status) external onlyCompliance {
        for (uint256 i = 0; i < accounts.length; i++) {
            whitelist[accounts[i]] = status;
            emit WhitelistUpdated(accounts[i], status);
        }
    }

    function updateKYC(address account, bool verified) external onlyCompliance {
        kycVerified[account] = verified;
        if (verified) {
            kycExpiry[account] = block.timestamp + KYC_VALIDITY_PERIOD;
        }
        emit KYCUpdated(account, verified, kycExpiry[account]);
    }

    function freezeAsset(uint256 assetId) external onlyCompliance {
        require(assetMetadata[assetId].createdAt > 0, "Asset does not exist");
        assetMetadata[assetId].frozen = true;
    }

    function unfreezeAsset(uint256 assetId) external onlyCompliance {
        require(assetMetadata[assetId].createdAt > 0, "Asset does not exist");
        assetMetadata[assetId].frozen = false;
    }

    // View functions
    function getAssetMetadata(uint256 assetId) external view returns (
        string memory ipfsCid,
        string memory name,
        string memory description,
        uint256 valuation,
        uint256 createdAt,
        bytes32 merkleRoot,
        bool frozen
    ) {
        AssetMetadata storage metadata = assetMetadata[assetId];
        return (
            metadata.ipfsCid,
            metadata.name,
            metadata.description,
            metadata.valuation,
            metadata.createdAt,
            metadata.merkleRoot,
            metadata.frozen
        );
    }

    function getAttestationCount(uint256 assetId) external view returns (uint256) {
        return assetAttestations[assetId].length;
    }

    function getAttestation(uint256 assetId, uint256 index) external view returns (
        bytes32 documentHash,
        address attestor,
        uint256 timestamp,
        string memory ipfsCid
    ) {
        require(index < assetAttestations[assetId].length, "Invalid attestation index");
        Attestation storage attestation = assetAttestations[assetId][index];
        return (
            attestation.documentHash,
            attestation.attestor,
            attestation.timestamp,
            attestation.ipfsCid
        );
    }

    function isTransferAllowed(address from, address to, uint256 amount) external view returns (bool) {
        return !frozenAccounts[from] &&
               !frozenAccounts[to] &&
               (whitelist[from] || hasRole(COMPLIANCE_ROLE, from)) &&
               (whitelist[to] || hasRole(COMPLIANCE_ROLE, to)) &&
               kycVerified[from] &&
               block.timestamp <= kycExpiry[from] &&
               kycVerified[to] &&
               block.timestamp <= kycExpiry[to] &&
               balanceOf(from) >= amount;
    }
}
