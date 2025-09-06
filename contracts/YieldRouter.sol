// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract YieldRouter is Ownable {
    struct YieldStrategy {
        address token;
        address yieldFarm;
        uint256 allocation;
        bool active;
    }

    mapping(address => YieldStrategy) public strategies;
    address[] public supportedTokens;

    event StrategyUpdated(address indexed token, address yieldFarm, uint256 allocation);
    event Rebalanced(address indexed token, uint256 amount);

    constructor() Ownable(msg.sender) {}

    function addStrategy(address token, address yieldFarm, uint256 allocation) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(yieldFarm != address(0), "Invalid yield farm address");
        require(allocation <= 10000, "Allocation exceeds 100%");

        strategies[token] = YieldStrategy(token, yieldFarm, allocation, true);

        // Add to supported tokens if not already present
        bool exists = false;
        for (uint i = 0; i < supportedTokens.length; i++) {
            if (supportedTokens[i] == token) {
                exists = true;
                break;
            }
        }
        if (!exists) {
            supportedTokens.push(token);
        }

        emit StrategyUpdated(token, yieldFarm, allocation);
    }

    function rebalance(address token) external onlyOwner {
        YieldStrategy storage strategy = strategies[token];
        require(strategy.active, "Strategy not active");

        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No tokens to rebalance");

        // Transfer tokens to yield farm (simplified)
        IERC20(token).transfer(strategy.yieldFarm, balance);

        emit Rebalanced(token, balance);
    }

    function getAPY(address token) external view returns (uint256) {
        // Mock APY calculation - in real implementation, this would query the yield farm
        YieldStrategy storage strategy = strategies[token];
        if (!strategy.active) return 0;

        // Return mock APY based on allocation
        return strategy.allocation * 10; // 0.1% per allocation unit
    }

    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
    }
}
