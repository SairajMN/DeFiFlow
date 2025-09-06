import { ethers } from 'ethers'

const NETWORKS = {
  blockdag: {
    chainId: 1043,
    chainName: 'BlockDAG Primordial',
    nativeCurrency: { name: 'BDAG', symbol: 'BDAG', decimals: 18 },
    rpcUrls: ['https://rpc.primordial.bdagscan.com'],
    blockExplorerUrls: ['https://bdagscan.com']
  },
  sepolia: {
    chainId: 11155111,
    chainName: 'Sepolia Testnet',
    nativeCurrency: { name: 'SepoliaETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://sepolia.infura.io/v3/'],
    blockExplorerUrls: ['https://sepolia.etherscan.io']
  },
  mainnet: {
    chainId: 1,
    chainName: 'Ethereum Mainnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.infura.io/v3/'],
    blockExplorerUrls: ['https://etherscan.io']
  }
}

let currentNetwork = 'blockdag'
let provider
let signer

export function getProvider() {
  if (!window.ethereum) {
    throw new Error('Please install MetaMask or another Ethereum wallet')
  }

  if (!provider) {
    provider = new ethers.BrowserProvider(window.ethereum)
  }
  return provider
}

export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error('Please install MetaMask or another Ethereum wallet to continue')
  }

  try {
    await window.ethereum.request({ method: 'eth_requestAccounts' })
  } catch (error) {
    if (error.code === 4001) {
      throw new Error('Please connect your wallet to continue')
    }
    throw error
  }
}

export function setNetwork(network) {
  currentNetwork = network
  // Reset provider and signer when network changes
  provider = null
  signer = null
}

export async function getSigner() {
  if (!signer) {
    const prov = getProvider()
    signer = await prov.getSigner()
    const network = await prov.getNetwork()
    const targetNetwork = NETWORKS[currentNetwork]

    if (network.chainId !== BigInt(targetNetwork.chainId)) {
      try {
        // Try to switch to the selected network
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${targetNetwork.chainId.toString(16)}` }]
        })
      } catch (switchError) {
        // If network doesn't exist, try to add it
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: `0x${targetNetwork.chainId.toString(16)}`,
                chainName: targetNetwork.chainName,
                nativeCurrency: targetNetwork.nativeCurrency,
                rpcUrls: targetNetwork.rpcUrls,
                blockExplorerUrls: targetNetwork.blockExplorerUrls
              }]
            })
          } catch (addError) {
            console.error(`Failed to add ${targetNetwork.chainName} network:`, addError)
            throw new Error(`Please add ${targetNetwork.chainName} network to your wallet manually`)
          }
        } else {
          console.error(`Failed to switch to ${targetNetwork.chainName} network:`, switchError)
          throw new Error(`Please switch to ${targetNetwork.chainName} network in your wallet`)
        }
      }
    }
  }
  return signer
}
