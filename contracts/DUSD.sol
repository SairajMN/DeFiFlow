// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DUSD is ERC20, Ownable {
    address public vault;

    /// @notice Contract constructor
    /// @dev Initializes the ERC20 token with name "Decentralized USD" and symbol "dUSD"
    constructor() ERC20("Decentralized USD", "dUSD") Ownable(msg.sender) {}

    /// @notice Modifier to restrict access to vault-only functions
    /// @dev Reverts if caller is not the designated vault address
    modifier onlyVault() {
        require(msg.sender == vault, "Only vault can mint/burn");
        _;
    }

    /// @notice Sets the vault address that can mint and burn tokens
    /// @param _vault The address to set as the vault
    /// @dev Only callable by the contract owner
    function setVault(address _vault) public onlyOwner {
        vault = _vault;
    }

    /// @notice Mints new tokens to the specified address
    /// @param to The address to receive the minted tokens
    /// @param amount The amount of tokens to mint
    /// @dev Only callable by the vault address
    function mint(address to, uint256 amount) public onlyVault {
        _mint(to, amount);
    }

    /// @notice Burns tokens from the specified address
    /// @param from The address from which to burn tokens
    /// @param amount The amount of tokens to burn
    /// @dev Only callable by the vault address
    function burn(address from, uint256 amount) public onlyVault {
        _burn(from, amount);
    }
}
