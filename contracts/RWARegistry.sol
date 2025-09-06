// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract RWARegistry is ERC20, Ownable {
    struct RWA {
        string name;
        string description;
        uint256 value; // USD value in cents
        address custodian;
        bool verified;
        uint256 createdAt;
    }

    mapping(uint256 => RWA) public rwas;
    mapping(address => bool) public authorizedCustodians;
    uint256 public nextTokenId = 1;

    event RWAMinted(uint256 indexed tokenId, address indexed owner, uint256 value);
    event RWARedeemed(uint256 indexed tokenId, address indexed owner, uint256 value);
    event CustodianAuthorized(address indexed custodian);
    event CustodianRevoked(address indexed custodian);

    constructor() ERC20("Real World Asset Token", "RWA") Ownable(msg.sender) {}

    modifier onlyAuthorizedCustodian() {
        require(authorizedCustodians[msg.sender] || msg.sender == owner(), "Not authorized custodian");
        _;
    }

    function authorizeCustodian(address custodian) external onlyOwner {
        authorizedCustodians[custodian] = true;
        emit CustodianAuthorized(custodian);
    }

    function revokeCustodian(address custodian) external onlyOwner {
        authorizedCustodians[custodian] = false;
        emit CustodianRevoked(custodian);
    }

    function mintRWA(
        address to,
        string memory name,
        string memory description,
        uint256 value,
        address custodian
    ) external onlyAuthorizedCustodian returns (uint256) {
        require(value > 0, "Value must be greater than 0");

        uint256 tokenId = nextTokenId++;
        rwas[tokenId] = RWA({
            name: name,
            description: description,
            value: value,
            custodian: custodian,
            verified: false,
            createdAt: block.timestamp
        });

        _mint(to, value); // Mint tokens equal to the USD value

        emit RWAMinted(tokenId, to, value);
        return tokenId;
    }

    function redeemRWA(uint256 tokenId, uint256 amount) external {
        require(rwas[tokenId].verified, "RWA not verified");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");

        _burn(msg.sender, amount);

        emit RWARedeemed(tokenId, msg.sender, amount);
    }

    function verifyRWA(uint256 tokenId) external onlyOwner {
        rwas[tokenId].verified = true;
    }

    function getRWA(uint256 tokenId) external view returns (
        string memory name,
        string memory description,
        uint256 value,
        address custodian,
        bool verified,
        uint256 createdAt
    ) {
        RWA storage rwa = rwas[tokenId];
        return (
            rwa.name,
            rwa.description,
            rwa.value,
            rwa.custodian,
            rwa.verified,
            rwa.createdAt
        );
    }

    function getTotalRWAs() external view returns (uint256) {
        return nextTokenId - 1;
    }
}
