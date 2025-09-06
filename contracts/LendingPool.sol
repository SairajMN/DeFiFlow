// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

contract LendingPool is Ownable, EIP712 {
    using SafeERC20 for IERC20;

    IERC20 public dusd;

    uint256 public constant RAY = 1e27;
    uint256 public ratePerSecond; // per-second rate in ray
    uint256 public lastUpdate;
    uint256 public index = RAY; // current index

    mapping(address => uint256) public deposits;
    mapping(address => uint256) public scaledDeposits; // deposit * index
    mapping(address => uint256) public nonces; // for replay protection

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event Accrue(uint256 newIndex);

    // EIP-712 types
    struct DepositAction {
        uint256 amount;
        uint256 nonce;
        uint256 deadline;
    }

    struct WithdrawAction {
        uint256 amount;
        uint256 nonce;
        uint256 deadline;
    }

    // RWA specific actions
    struct MintRWAAction {
        address to;
        uint256 amount;
        string ipfsCid;
        string name;
        string description;
        uint256 valuation;
        bytes32 merkleRoot;
        uint256 nonce;
        uint256 deadline;
    }

    struct TransferRWAAction {
        address to;
        uint256 amount;
        uint256 nonce;
        uint256 deadline;
    }

    struct BurnRWAAction {
        address from;
        uint256 amount;
        uint256 nonce;
        uint256 deadline;
    }

    bytes32 private constant DEPOSIT_TYPEHASH = keccak256("DepositAction(uint256 amount,uint256 nonce,uint256 deadline)");
    bytes32 private constant WITHDRAW_TYPEHASH = keccak256("WithdrawAction(uint256 amount,uint256 nonce,uint256 deadline)");
    bytes32 private constant MINT_RWA_TYPEHASH = keccak256("MintRWAAction(address to,uint256 amount,string ipfsCid,string name,string description,uint256 valuation,bytes32 merkleRoot,uint256 nonce,uint256 deadline)");
    bytes32 private constant TRANSFER_RWA_TYPEHASH = keccak256("TransferRWAAction(address to,uint256 amount,uint256 nonce,uint256 deadline)");
    bytes32 private constant BURN_RWA_TYPEHASH = keccak256("BurnRWAAction(address from,uint256 amount,uint256 nonce,uint256 deadline)");

    constructor(address _dusd, uint256 _ratePerSecond)
        Ownable(msg.sender)
        EIP712("LendingPool", "1")
    {
        dusd = IERC20(_dusd);
        ratePerSecond = _ratePerSecond;
        lastUpdate = block.timestamp;
    }

    function accrue() public {
        uint256 timePassed = block.timestamp - lastUpdate;
        if (timePassed > 0) {
            // Simple approximation for testing: add timePassed * ratePerSecond / RAY
            uint256 interest = (timePassed * ratePerSecond) / RAY;
            index = index + interest;
            lastUpdate = block.timestamp;
            emit Accrue(index);
        }
    }

    function deposit(uint256 amount) public {
        accrue();
        dusd.safeTransferFrom(msg.sender, address(this), amount);
        uint256 scaledAmount = (amount * RAY) / index;
        scaledDeposits[msg.sender] += scaledAmount;
        deposits[msg.sender] += amount;
        emit Deposit(msg.sender, amount);
    }

    function withdraw(uint256 amount) public {
        accrue();
        require(deposits[msg.sender] >= amount, "Insufficient balance");
        uint256 scaledAmount = (amount * RAY) / index;
        scaledDeposits[msg.sender] -= scaledAmount;
        deposits[msg.sender] -= amount;
        dusd.safeTransfer(msg.sender, amount);
        emit Withdraw(msg.sender, amount);
    }

    function previewBalance(address user) public view returns (uint256) {
        uint256 timePassed = block.timestamp - lastUpdate;
        uint256 currentIndex = index;
        if (timePassed > 0) {
            uint256 interest = (timePassed * ratePerSecond) / RAY;
            currentIndex = index + interest;
        }
        return (scaledDeposits[user] * currentIndex) / RAY;
    }

    // Delegated signing functions
    function executeDeposit(DepositAction calldata action, bytes calldata signature) external {
        require(block.timestamp <= action.deadline, "Signature expired");
        require(action.nonce == nonces[msg.sender], "Invalid nonce");

        bytes32 structHash = keccak256(abi.encode(DEPOSIT_TYPEHASH, action.amount, action.nonce, action.deadline));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        require(signer == msg.sender, "Invalid signature");

        nonces[msg.sender]++;

        // Execute deposit
        accrue();
        dusd.safeTransferFrom(msg.sender, address(this), action.amount);
        uint256 scaledAmount = (action.amount * RAY) / index;
        scaledDeposits[msg.sender] += scaledAmount;
        deposits[msg.sender] += action.amount;
        emit Deposit(msg.sender, action.amount);
    }

    function executeWithdraw(WithdrawAction calldata action, bytes calldata signature) external {
        require(block.timestamp <= action.deadline, "Signature expired");
        require(action.nonce == nonces[msg.sender], "Invalid nonce");

        bytes32 structHash = keccak256(abi.encode(WITHDRAW_TYPEHASH, action.amount, action.nonce, action.deadline));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        require(signer == msg.sender, "Invalid signature");

        nonces[msg.sender]++;

        // Execute withdraw
        accrue();
        require(deposits[msg.sender] >= action.amount, "Insufficient balance");
        uint256 scaledAmount = (action.amount * RAY) / index;
        scaledDeposits[msg.sender] -= scaledAmount;
        deposits[msg.sender] -= action.amount;
        dusd.safeTransfer(msg.sender, action.amount);
        emit Withdraw(msg.sender, action.amount);
    }

    // RWA Delegated Functions
    function executeMintRWA(MintRWAAction calldata action, bytes calldata signature, address rwaToken) external {
        require(block.timestamp <= action.deadline, "Signature expired");
        require(action.nonce == nonces[msg.sender], "Invalid nonce");

        bytes32 structHash = keccak256(abi.encode(
            MINT_RWA_TYPEHASH,
            action.to,
            action.amount,
            keccak256(bytes(action.ipfsCid)),
            keccak256(bytes(action.name)),
            keccak256(bytes(action.description)),
            action.valuation,
            action.merkleRoot,
            action.nonce,
            action.deadline
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        require(signer == msg.sender, "Invalid signature");

        nonces[msg.sender]++;

        // Execute RWA mint via low-level call
        (bool success,) = rwaToken.call(
            abi.encodeWithSignature(
                "mintAsset(address,uint256,string,string,string,uint256,bytes32)",
                action.to,
                action.amount,
                action.ipfsCid,
                action.name,
                action.description,
                action.valuation,
                action.merkleRoot
            )
        );
        require(success, "RWA mint failed");
    }

    function executeTransferRWA(TransferRWAAction calldata action, bytes calldata signature, address rwaToken) external {
        require(block.timestamp <= action.deadline, "Signature expired");
        require(action.nonce == nonces[msg.sender], "Invalid nonce");

        bytes32 structHash = keccak256(abi.encode(
            TRANSFER_RWA_TYPEHASH,
            action.to,
            action.amount,
            action.nonce,
            action.deadline
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        require(signer == msg.sender, "Invalid signature");

        nonces[msg.sender]++;

        // Execute RWA transfer via low-level call
        (bool success,) = rwaToken.call(
            abi.encodeWithSignature(
                "transfer(address,uint256)",
                action.to,
                action.amount
            )
        );
        require(success, "RWA transfer failed");
    }

    function executeBurnRWA(BurnRWAAction calldata action, bytes calldata signature, address rwaToken) external {
        require(block.timestamp <= action.deadline, "Signature expired");
        require(action.nonce == nonces[msg.sender], "Invalid nonce");

        bytes32 structHash = keccak256(abi.encode(
            BURN_RWA_TYPEHASH,
            action.from,
            action.amount,
            action.nonce,
            action.deadline
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        require(signer == msg.sender, "Invalid signature");

        nonces[msg.sender]++;

        // Execute RWA burn via low-level call
        (bool success,) = rwaToken.call(
            abi.encodeWithSignature(
                "burnAsset(uint256,address,uint256)",
                0, // assetId - simplified for this example
                action.from,
                action.amount
            )
        );
        require(success, "RWA burn failed");
    }
}
