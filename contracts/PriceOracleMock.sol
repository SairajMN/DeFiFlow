// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract PriceOracleMock is Ownable {
    uint256 public price; // 8 decimals

    constructor() Ownable(msg.sender) {
        price = 1e8; // $1.00 default
    }

    function setPrice(uint256 _price) public onlyOwner {
        price = _price;
    }

    function getPrice() public view returns (uint256) {
        return price;
    }
}
