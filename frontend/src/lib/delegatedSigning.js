import { ethers } from 'ethers'

// EIP-712 Domain and Types for LendingPool
export const LENDING_POOL_DOMAIN = {
  name: "LendingPool",
  version: "1",
  chainId: 1043, // Update based on network
  verifyingContract: "0x0000000000000000000000000000000000000000" // Will be set dynamically
}

export const DEPOSIT_TYPES = {
  DepositAction: [
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }
  ]
}

export const WITHDRAW_TYPES = {
  WithdrawAction: [
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }
  ]
}

// RWA Action Types
export const MINT_RWA_TYPES = {
  MintRWAAction: [
    { name: 'to', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'ipfsCid', type: 'string' },
    { name: 'name', type: 'string' },
    { name: 'description', type: 'string' },
    { name: 'valuation', type: 'uint256' },
    { name: 'merkleRoot', type: 'bytes32' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }
  ]
}

export const TRANSFER_RWA_TYPES = {
  TransferRWAAction: [
    { name: 'to', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }
  ]
}

export const BURN_RWA_TYPES = {
  BurnRWAAction: [
    { name: 'from', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }
  ]
}

// Generate EIP-712 typed message for deposit
export async function createDepositMessage(amount, nonce, deadline, lendingPoolAddress) {
  const domain = { ...LENDING_POOL_DOMAIN, verifyingContract: lendingPoolAddress }

  const message = {
    amount: ethers.parseEther(amount),
    nonce: BigInt(nonce),
    deadline: BigInt(deadline)
  }

  return { domain, types: DEPOSIT_TYPES, message }
}

// Generate EIP-712 typed message for withdraw
export async function createWithdrawMessage(amount, nonce, deadline, lendingPoolAddress) {
  const domain = { ...LENDING_POOL_DOMAIN, verifyingContract: lendingPoolAddress }

  const message = {
    amount: ethers.parseEther(amount),
    nonce: BigInt(nonce),
    deadline: BigInt(deadline)
  }

  return { domain, types: WITHDRAW_TYPES, message }
}

// Sign typed message with wallet
export async function signTypedMessage(signer, domain, types, message) {
  try {
    const signature = await signer.signTypedData(domain, types, message)
    return signature
  } catch (error) {
    console.error('Error signing typed message:', error)
    throw new Error('Failed to sign message')
  }
}

// Send signed message to relayer
export async function sendToRelayer(endpoint, payload) {
  const response = await fetch(`${process.env.REACT_APP_RELAYER_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Relayer request failed')
  }

  return await response.json()
}

// Complete delegated deposit flow
export async function delegatedDeposit(signer, amount, nonce, deadline, lendingPoolAddress, relayerUrl) {
  // Create typed message
  const { domain, types, message } = await createDepositMessage(amount, nonce, deadline, lendingPoolAddress)

  // Sign with wallet
  const signature = await signTypedMessage(signer, domain, types, message)

  // Send to relayer
  const payload = {
    amount,
    nonce: nonce.toString(),
    deadline: deadline.toString(),
    signature
  }

  return await sendToRelayer('/api/deposit', payload)
}

// Complete delegated withdraw flow
export async function delegatedWithdraw(signer, amount, nonce, deadline, lendingPoolAddress, relayerUrl) {
  // Create typed message
  const { domain, types, message } = await createWithdrawMessage(amount, nonce, deadline, lendingPoolAddress)

  // Sign with wallet
  const signature = await signTypedMessage(signer, domain, types, message)

  // Send to relayer
  const payload = {
    amount,
    nonce: nonce.toString(),
    deadline: deadline.toString(),
    signature
  }

  return await sendToRelayer('/api/withdraw', payload)
}

// Get user nonce from relayer
export async function getUserNonce(userAddress, relayerUrl) {
  const response = await fetch(`${relayerUrl}/api/nonce/${userAddress}`)

  if (!response.ok) {
    throw new Error('Failed to fetch nonce')
  }

  const data = await response.json()
  return data.nonce
}

// Generate EIP-712 typed message for RWA mint
export async function createMintRWAMessage(to, amount, ipfsCid, name, description, valuation, merkleRoot, nonce, deadline, lendingPoolAddress) {
  const domain = { ...LENDING_POOL_DOMAIN, verifyingContract: lendingPoolAddress }

  const message = {
    to: to,
    amount: ethers.parseEther(amount),
    ipfsCid: ipfsCid,
    name: name,
    description: description,
    valuation: BigInt(valuation),
    merkleRoot: merkleRoot,
    nonce: BigInt(nonce),
    deadline: BigInt(deadline)
  }

  return { domain, types: MINT_RWA_TYPES, message }
}

// Generate EIP-712 typed message for RWA transfer
export async function createTransferRWAMessage(to, amount, nonce, deadline, lendingPoolAddress) {
  const domain = { ...LENDING_POOL_DOMAIN, verifyingContract: lendingPoolAddress }

  const message = {
    to: to,
    amount: ethers.parseEther(amount),
    nonce: BigInt(nonce),
    deadline: BigInt(deadline)
  }

  return { domain, types: TRANSFER_RWA_TYPES, message }
}

// Generate EIP-712 typed message for RWA burn
export async function createBurnRWAMessage(from, amount, nonce, deadline, lendingPoolAddress) {
  const domain = { ...LENDING_POOL_DOMAIN, verifyingContract: lendingPoolAddress }

  const message = {
    from: from,
    amount: ethers.parseEther(amount),
    nonce: BigInt(nonce),
    deadline: BigInt(deadline)
  }

  return { domain, types: BURN_RWA_TYPES, message }
}

// Complete delegated RWA mint flow
export async function delegatedMintRWA(signer, to, amount, ipfsCid, name, description, valuation, merkleRoot, nonce, deadline, lendingPoolAddress, rwaTokenAddress, relayerUrl) {
  // Create typed message
  const { domain, types, message } = await createMintRWAMessage(to, amount, ipfsCid, name, description, valuation, merkleRoot, nonce, deadline, lendingPoolAddress)

  // Sign with wallet
  const signature = await signTypedMessage(signer, domain, types, message)

  // Send to relayer
  const payload = {
    to,
    amount,
    ipfsCid,
    name,
    description,
    valuation: valuation.toString(),
    merkleRoot,
    nonce: nonce.toString(),
    deadline: deadline.toString(),
    signature,
    rwaToken: rwaTokenAddress
  }

  return await sendToRelayer('/api/rwa/mint', payload)
}

// Complete delegated RWA transfer flow
export async function delegatedTransferRWA(signer, to, amount, nonce, deadline, lendingPoolAddress, rwaTokenAddress, relayerUrl) {
  // Create typed message
  const { domain, types, message } = await createTransferRWAMessage(to, amount, nonce, deadline, lendingPoolAddress)

  // Sign with wallet
  const signature = await signTypedMessage(signer, domain, types, message)

  // Send to relayer
  const payload = {
    to,
    amount,
    nonce: nonce.toString(),
    deadline: deadline.toString(),
    signature,
    rwaToken: rwaTokenAddress
  }

  return await sendToRelayer('/api/rwa/transfer', payload)
}

// Complete delegated RWA burn flow
export async function delegatedBurnRWA(signer, from, amount, nonce, deadline, lendingPoolAddress, rwaTokenAddress, relayerUrl) {
  // Create typed message
  const { domain, types, message } = await createBurnRWAMessage(from, amount, nonce, deadline, lendingPoolAddress)

  // Sign with wallet
  const signature = await signTypedMessage(signer, domain, types, message)

  // Send to relayer
  const payload = {
    from,
    amount,
    nonce: nonce.toString(),
    deadline: deadline.toString(),
    signature,
    rwaToken: rwaTokenAddress
  }

  return await sendToRelayer('/api/rwa/burn', payload)
}

// Calculate deadline (current time + 30 minutes)
export function getDeadline(minutes = 30) {
  return Math.floor(Date.now() / 1000) + (minutes * 60)
}
