// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CollateralVault is Ownable {
    using SafeERC20 for IERC20;

    struct Position {
        uint256 collateral;
        uint256 debt;
    }

    mapping(address => Position) public positions;

    IERC20 public rwa;
    IERC20 public dusd;
    address public oracle;

    uint256 public constant LTV_BPS = 7000;
    uint256 public constant BPS = 10000;

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event Borrow(address indexed user, uint256 amount);
    event Repay(address indexed user, uint256 amount);

    constructor(address _rwa, address _dusd, address _oracle) Ownable(msg.sender) {
        rwa = IERC20(_rwa);
        dusd = IERC20(_dusd);
        oracle = _oracle;
    }

    function deposit(uint256 amount) public {
        require(amount > 0, "Amount must be > 0");
        rwa.safeTransferFrom(msg.sender, address(this), amount);
        positions[msg.sender].collateral += amount;
        emit Deposit(msg.sender, amount);
    }

    function withdraw(uint256 amount) public {
        require(amount > 0, "Amount must be > 0");
        require(positions[msg.sender].collateral >= amount, "Insufficient collateral");
        uint256 maxWithdraw = getMaxWithdraw(msg.sender);
        require(amount <= maxWithdraw, "Would exceed LTV");
        positions[msg.sender].collateral -= amount;
        rwa.safeTransfer(msg.sender, amount);
        emit Withdraw(msg.sender, amount);
    }

    function borrow(uint256 amount) public {
        require(amount > 0, "Amount must be > 0");
        uint256 maxBorrow = getMaxBorrow(msg.sender);
        require(amount <= maxBorrow, "Exceeds max borrowable");
        positions[msg.sender].debt += amount;
        // Mint dUSD to borrower
        (bool success,) = address(dusd).call(abi.encodeWithSignature("mint(address,uint256)", msg.sender, amount));
        require(success, "Mint failed");
        emit Borrow(msg.sender, amount);
    }

    function repay(uint256 amount) public {
        require(amount > 0, "Amount must be > 0");
        require(positions[msg.sender].debt >= amount, "Insufficient debt");
        dusd.safeTransferFrom(msg.sender, address(this), amount);
        positions[msg.sender].debt -= amount;
        emit Repay(msg.sender, amount);
    }

    function getMaxBorrow(address user) public returns (uint256) {
        uint256 price = getPrice(); // 8 decimals
        uint256 collateralValue = (positions[user].collateral * price * 1e10) / 1e18; // Convert to 18 decimals
        uint256 maxBorrowValue = (collateralValue * LTV_BPS) / BPS;
        return maxBorrowValue;
    }

    function getMaxWithdraw(address user) public returns (uint256) {
        uint256 debtValue = positions[user].debt;
        uint256 price = getPrice(); // 8 decimals
        uint256 maxWithdrawValue = (debtValue * BPS) / LTV_BPS;
        uint256 maxWithdrawCollateral = (maxWithdrawValue * 1e18) / (price * 1e10); // Convert from 18 decimals
        return positions[user].collateral - maxWithdrawCollateral;
    }

    function getPrice() internal returns (uint256) {
        (bool success, bytes memory data) = oracle.call(abi.encodeWithSignature("getPrice()"));
        require(success, "Oracle call failed");
        return abi.decode(data, (uint256));
    }

    function liquidate(address user) public {
        // For simplicity, not implemented in MVP
        revert("Liquidation not implemented");
    }
}
