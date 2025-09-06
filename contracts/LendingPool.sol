// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LendingPool is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public dusd;

    uint256 public constant RAY = 1e27;
    uint256 public ratePerSecond; // per-second rate in ray
    uint256 public lastUpdate;
    uint256 public index = RAY; // current index

    mapping(address => uint256) public deposits;
    mapping(address => uint256) public scaledDeposits; // deposit * index

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event Accrue(uint256 newIndex);

    constructor(address _dusd, uint256 _ratePerSecond) Ownable(msg.sender) {
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
}
