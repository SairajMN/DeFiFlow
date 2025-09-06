// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DUSD is ERC20, Ownable {
    address public vault;

    constructor() ERC20("Decentralized USD", "dUSD") Ownable(msg.sender) {}

    modifier onlyVault() {
        require(msg.sender == vault, "Only vault can mint/burn");
        _;
    }

    function setVault(address _vault) public onlyOwner {
        vault = _vault;
    }

    function mint(address to, uint256 amount) public onlyVault {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) public onlyVault {
        _burn(from, amount);
    }
}
