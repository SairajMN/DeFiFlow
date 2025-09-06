require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  networks: {
    blockdag: {
      url: process.env.RPC_URL,
      chainId: parseInt(process.env.CHAIN_ID),
      accounts: [process.env.PRIVATE_KEY],
    },
  },
};
