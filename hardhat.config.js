require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
        details: {
          yul: true,
          yulDetails: {
            stackAllocation: true,
          },
        },
      },
      viaIR: true,
    },
  },
  networks: {
    blockdag: {
      url: process.env.RPC_URL || 'https://rpc.primordial.bdagscan.com',
      chainId: parseInt(process.env.CHAIN_ID) || 1043,
      accounts: process.env.PRIVATE_KEY && process.env.PRIVATE_KEY !== '0x0000000000000000000000000000000000000000000000000000000000000000'
        ? [process.env.PRIVATE_KEY]
        : [],
    },
    sepolia: {
      url: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY || '8cc9eb274556489a90980d5d81faa285'}`,
      chainId: 11155111,
      accounts: process.env.PRIVATE_KEY && process.env.PRIVATE_KEY !== '0x0000000000000000000000000000000000000000000000000000000000000000'
        ? [process.env.PRIVATE_KEY]
        : [],
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY || '8cc9eb274556489a90980d5d81faa285'}`,
      chainId: 1,
      accounts: process.env.PRIVATE_KEY && process.env.PRIVATE_KEY !== '0x0000000000000000000000000000000000000000000000000000000000000000'
        ? [process.env.PRIVATE_KEY]
        : [],
    },
  },
};
