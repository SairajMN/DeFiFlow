import { ethers } from 'ethers'

const BLOCKDAG_CHAIN_ID = 1043 // BlockDAG Primordial chain ID

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

export async function getSigner() {
  if (!signer) {
    const prov = getProvider()
    signer = await prov.getSigner()
    const network = await prov.getNetwork()

    if (network.chainId !== BigInt(BLOCKDAG_CHAIN_ID)) {
      try {
        // Try to switch to BlockDAG network
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${BLOCKDAG_CHAIN_ID.toString(16)}` }]
        })
      } catch (switchError) {
        // If network doesn't exist, try to add it
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: `0x${BLOCKDAG_CHAIN_ID.toString(16)}`,
                chainName: 'BlockDAG Primordial',
                nativeCurrency: {
                  name: 'BDAG',
                  symbol: 'BDAG',
                  decimals: 18
                },
                rpcUrls: ['https://rpc.primordial.bdagscan.com'],
                blockExplorerUrls: ['https://bdagscan.com']
              }]
            })
          } catch (addError) {
            console.error('Failed to add BlockDAG network:', addError)
            throw new Error('Please add BlockDAG network to your wallet manually')
          }
        } else {
          console.error('Failed to switch to BlockDAG network:', switchError)
          throw new Error('Please switch to BlockDAG network in your wallet')
        }
      }
    }
  }
  return signer
}
