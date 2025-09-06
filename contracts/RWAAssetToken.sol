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

    /// @notice Modifier to restrict access to compliance officer functions
    /// @dev Reverts if caller does not have COMPLIANCE_ROLE
    modifier onlyCompliance() {
        require(hasRole(COMPLIANCE_ROLE, msg.sender), "Caller is not compliance officer");
        _;
    }

    /// @notice Modifier to check if account is not frozen
    /// @param account The address to check
    /// @dev Reverts if the account is frozen
    modifier notFrozen(address account) {
        require(!frozenAccounts[account], "Account is frozen");
        _;
    }

    /// @notice Modifier to check if account is whitelisted
    /// @param account The address to check
    /// @dev Reverts if account is not whitelisted and caller is not compliance officer
    modifier onlyWhitelisted(address account) {
        require(whitelist[account] || hasRole(COMPLIANCE_ROLE, msg.sender), "Account not whitelisted");
        _;
    }

    /// @notice Modifier to check if account has valid KYC
    /// @param account The address to check
    /// @dev Reverts if KYC is expired or not verified
    modifier kycValid(address account) {
        require(kycVerified[account] && block.timestamp <= kycExpiry[account], "KYC expired or not verified");
        _;
    }

    /// @notice Mints a new RWA asset token
    /// @param to The address to receive the minted tokens
    /// @param amount The amount of tokens to mint
    /// @param ipfsCid The IPFS content identifier for the asset metadata
    /// @param name The name of the asset
    /// @param description The description of the asset
    /// @param valuation The valuation of the asset in USD cents
    /// @param merkleRoot The merkle root for batch attestations (optional)
    /// @return The ID of the newly created asset
    /// @dev Only callable by addresses with MINTER_ROLE
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

    /// @notice Burns RWA asset tokens from a specified address
    /// @param assetId The ID of the asset being burned
    /// @param from The address from which to burn tokens
    /// @param amount The amount of tokens to burn
    /// @dev Only callable by addresses with BURNER_ROLE
    function burnAsset(uint256 assetId, address from, uint256 amount) external onlyRole(BURNER_ROLE) {
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(from) >= amount, "Insufficient balance");

        _burn(from, amount);
        emit AssetBurned(assetId, from, amount);
    }

    /// @notice Adds an attestation document to an existing asset
    /// @param assetId The ID of the asset to add attestation to
    /// @param documentHash The hash of the attestation document
    /// @param ipfsCid The IPFS content identifier for the attestation
    /// @param merkleProof The merkle proof for batch verification (if applicable)
    /// @dev Only callable by addresses with COMPLIANCE_ROLE
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

    /// @notice Transfers tokens to a specified address with compliance checks
    /// @param to The address to transfer tokens to
    /// @param amount The amount of tokens to transfer
    /// @return A boolean value indicating whether the operation succeeded
    /// @dev Overrides ERC20 transfer with additional compliance checks
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

    /// @notice Transfers tokens from one address to another with compliance checks
    /// @param from The address to transfer tokens from
    /// @param to The address to transfer tokens to
    /// @param amount The amount of tokens to transfer
    /// @return A boolean value indicating whether the operation succeeded
    /// @dev Overrides ERC20 transferFrom with additional compliance checks
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
    /// @notice Freezes an account to prevent transfers
    /// @param account The address to freeze
    /// @dev Only callable by compliance officers
    function freezeAccount(address account) external onlyCompliance {
        frozenAccounts[account] = true;
        emit AccountFrozen(account);
    }

    /// @notice Unfreezes a previously frozen account
    /// @param account The address to unfreeze
    /// @dev Only callable by compliance officers
    function unfreezeAccount(address account) external onlyCompliance {
        frozenAccounts[account] = false;
        emit AccountUnfrozen(account);
    }

    /// @notice Updates the whitelist status of an account
    /// @param account The address to update
    /// @param status The new whitelist status
    /// @dev Only callable by compliance officers
    function updateWhitelist(address account, bool status) external onlyCompliance {
        whitelist[account] = status;
        emit WhitelistUpdated(account, status);
    }

    /// @notice Updates the whitelist status for multiple accounts
    /// @param accounts The array of addresses to update
    /// @param status The new whitelist status for all accounts
    /// @dev Only callable by compliance officers
    function batchUpdateWhitelist(address[] calldata accounts, bool status) external onlyCompliance {
        for (uint256 i = 0; i < accounts.length; i++) {
            whitelist[accounts[i]] = status;
            emit WhitelistUpdated(accounts[i], status);
        }
    }

    /// @notice Updates the KYC verification status of an account
    /// @param account The address to update
    /// @param verified The new KYC verification status
    /// @dev Only callable by compliance officers. Sets expiry if verified
    function updateKYC(address account, bool verified) external onlyCompliance {
        kycVerified[account] = verified;
        if (verified) {
            kycExpiry[account] = block.timestamp + KYC_VALIDITY_PERIOD;
        }
        emit KYCUpdated(account, verified, kycExpiry[account]);
    }

    /// @notice Freezes an asset to prevent certain operations
    /// @param assetId The ID of the asset to freeze
    /// @dev Only callable by compliance officers
    function freezeAsset(uint256 assetId) external onlyCompliance {
        require(assetMetadata[assetId].createdAt > 0, "Asset does not exist");
        assetMetadata[assetId].frozen = true;
    }

    /// @notice Unfreezes a previously frozen asset
    /// @param assetId The ID of the asset to unfreeze
    /// @dev Only callable by compliance officers
    function unfreezeAsset(uint256 assetId) external onlyCompliance {
        require(assetMetadata[assetId].createdAt > 0, "Asset does not exist");
        assetMetadata[assetId].frozen = false;
    }

    // View functions
    /// @notice Gets the metadata for a specific asset
    /// @param assetId The ID of the asset to query
    /// @return ipfsCid The IPFS content identifier
    /// @return name The asset name
    /// @return description The asset description
    /// @return valuation The asset valuation in USD cents
    /// @return createdAt The timestamp when the asset was created
    /// @return merkleRoot The merkle root for attestations
    /// @return frozen Whether the asset is frozen
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

    /// @notice Gets the number of attestations for a specific asset
    /// @param assetId The ID of the asset to query
    /// @return The number of attestations
    function getAttestationCount(uint256 assetId) external view returns (uint256) {
        return assetAttestations[assetId].length;
    }

    /// @notice Gets a specific attestation for an asset
    /// @param assetId The ID of the asset
    /// @param index The index of the attestation to retrieve
    /// @return documentHash The hash of the attestation document
    /// @return attestor The address of the attestor
    /// @return timestamp The timestamp of the attestation
    /// @return ipfsCid The IPFS content identifier for the attestation
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

    /// @notice Checks if a transfer is allowed between two addresses
    /// @param from The sender address
    /// @param to The recipient address
    /// @param amount The amount to transfer
    /// @return Whether the transfer is allowed
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
