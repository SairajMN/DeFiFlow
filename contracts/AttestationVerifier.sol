// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract AttestationVerifier is Ownable, AccessControl {
    bytes32 public constant ATTESTOR_ROLE = keccak256("ATTESTOR_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    struct AttestationRequest {
        bytes32 documentHash;
        string ipfsCid;
        address requester;
        uint256 timestamp;
        bool fulfilled;
        bytes32 attestationId;
    }

    struct Attestation {
        bytes32 attestationId;
        bytes32 documentHash;
        address attestor;
        uint256 timestamp;
        string metadata;
        bytes signature;
        bool verified;
    }

    // Attestation requests
    mapping(bytes32 => AttestationRequest) public attestationRequests;
    // Attestations by ID
    mapping(bytes32 => Attestation) public attestations;
    // Merkle roots for batch verification
    mapping(bytes32 => bytes32) public merkleRoots;
    // Verified attestors
    mapping(address => bool) public verifiedAttestors;

    uint256 public nextAttestationId = 1;
    uint256 public constant ATTESTATION_FEE = 0.01 ether;

    event AttestationRequested(bytes32 indexed requestId, address indexed requester, bytes32 documentHash);
    event AttestationSubmitted(bytes32 indexed attestationId, address indexed attestor, bytes32 documentHash);
    event AttestationVerified(bytes32 indexed attestationId, address indexed verifier);
    event MerkleRootUpdated(bytes32 indexed rootHash, bytes32 merkleRoot);
    event AttestorStatusChanged(address indexed attestor, bool status);

    constructor() Ownable(msg.sender) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ATTESTOR_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
    }

    modifier onlyVerifiedAttestor() {
        require(verifiedAttestors[msg.sender] || hasRole(ATTESTOR_ROLE, msg.sender), "Not a verified attestor");
        _;
    }

    modifier onlyVerifier() {
        require(hasRole(VERIFIER_ROLE, msg.sender), "Not a verifier");
        _;
    }

    function requestAttestation(bytes32 documentHash, string memory ipfsCid) external payable returns (bytes32) {
        require(msg.value >= ATTESTATION_FEE, "Insufficient fee");
        require(documentHash != bytes32(0), "Invalid document hash");
        require(bytes(ipfsCid).length > 0, "IPFS CID required");

        bytes32 requestId = keccak256(abi.encodePacked(documentHash, msg.sender, block.timestamp));
        require(attestationRequests[requestId].timestamp == 0, "Request already exists");

        attestationRequests[requestId] = AttestationRequest({
            documentHash: documentHash,
            ipfsCid: ipfsCid,
            requester: msg.sender,
            timestamp: block.timestamp,
            fulfilled: false,
            attestationId: bytes32(0)
        });

        emit AttestationRequested(requestId, msg.sender, documentHash);
        return requestId;
    }

    function submitAttestation(
        bytes32 requestId,
        string memory metadata,
        bytes memory signature
    ) external onlyVerifiedAttestor returns (bytes32) {
        AttestationRequest storage request = attestationRequests[requestId];
        require(request.timestamp > 0, "Request does not exist");
        require(!request.fulfilled, "Request already fulfilled");

        // Verify signature
        bytes32 messageHash = keccak256(abi.encodePacked(request.documentHash, request.ipfsCid, metadata));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        address signer = ECDSA.recover(ethSignedMessageHash, signature);
        require(signer == request.requester, "Invalid signature");

        bytes32 attestationId = keccak256(abi.encodePacked(requestId, msg.sender, block.timestamp));

        attestations[attestationId] = Attestation({
            attestationId: attestationId,
            documentHash: request.documentHash,
            attestor: msg.sender,
            timestamp: block.timestamp,
            metadata: metadata,
            signature: signature,
            verified: false
        });

        request.fulfilled = true;
        request.attestationId = attestationId;

        emit AttestationSubmitted(attestationId, msg.sender, request.documentHash);
        return attestationId;
    }

    function verifyAttestation(bytes32 attestationId) external onlyVerifier {
        Attestation storage attestation = attestations[attestationId];
        require(attestation.timestamp > 0, "Attestation does not exist");
        require(!attestation.verified, "Already verified");

        attestation.verified = true;
        emit AttestationVerified(attestationId, msg.sender);
    }

    function batchVerifyAttestations(bytes32[] calldata attestationIds) external onlyVerifier {
        for (uint256 i = 0; i < attestationIds.length; i++) {
            bytes32 attestationId = attestationIds[i];
            Attestation storage attestation = attestations[attestationId];
            if (attestation.timestamp > 0 && !attestation.verified) {
                attestation.verified = true;
                emit AttestationVerified(attestationId, msg.sender);
            }
        }
    }

    function submitMerkleRoot(bytes32 rootHash, bytes32 merkleRoot) external onlyVerifier {
        merkleRoots[rootHash] = merkleRoot;
        emit MerkleRootUpdated(rootHash, merkleRoot);
    }

    function verifyWithMerkleProof(
        bytes32 attestationId,
        bytes32[] calldata merkleProof
    ) external view returns (bool) {
        Attestation storage attestation = attestations[attestationId];
        require(attestation.timestamp > 0, "Attestation does not exist");

        bytes32 leaf = keccak256(abi.encodePacked(
            attestation.attestationId,
            attestation.documentHash,
            attestation.attestor,
            attestation.metadata
        ));

        return MerkleProof.verify(merkleProof, merkleRoots[attestation.attestationId], leaf);
    }

    function setAttestorStatus(address attestor, bool status) external onlyVerifier {
        verifiedAttestors[attestor] = status;
        emit AttestorStatusChanged(attestor, status);
    }

    function batchSetAttestorStatus(address[] calldata attestor, bool status) external onlyVerifier {
        for (uint256 i = 0; i < attestor.length; i++) {
            verifiedAttestors[attestor[i]] = status;
            emit AttestorStatusChanged(attestor[i], status);
        }
    }

    // View functions
    function getAttestation(bytes32 attestationId) external view returns (
        bytes32 documentHash,
        address attestor,
        uint256 timestamp,
        string memory metadata,
        bytes memory signature,
        bool verified
    ) {
        Attestation storage attestation = attestations[attestationId];
        return (
            attestation.documentHash,
            attestation.attestor,
            attestation.timestamp,
            attestation.metadata,
            attestation.signature,
            attestation.verified
        );
    }

    function getAttestationRequest(bytes32 requestId) external view returns (
        bytes32 documentHash,
        string memory ipfsCid,
        address requester,
        uint256 timestamp,
        bool fulfilled,
        bytes32 attestationId
    ) {
        AttestationRequest storage request = attestationRequests[requestId];
        return (
            request.documentHash,
            request.ipfsCid,
            request.requester,
            request.timestamp,
            request.fulfilled,
            request.attestationId
        );
    }

    function isAttestationVerified(bytes32 attestationId) external view returns (bool) {
        return attestations[attestationId].verified;
    }

    function getPendingRequestsCount() external view returns (uint256) {
        // This would need to be implemented with a counter or iterable mapping
        return 0; // Placeholder
    }

    // Withdraw fees
    function withdrawFees() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    receive() external payable {}
}
