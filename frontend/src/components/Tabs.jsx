import { useState } from 'react'
import { ethers } from 'ethers'
import { getSigner, getProvider } from '../lib/ethers'
import { addresses } from '../lib/addresses'
import { abis } from '../lib/format'
import {
  delegatedDeposit,
  delegatedWithdraw,
  getUserNonce,
  getDeadline
} from '../lib/delegatedSigning'

function Tabs({ onUpdate, selectedNetwork }) {
  const [activeTab, setActiveTab] = useState('borrow')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)

  const networkAddresses = addresses[selectedNetwork]

  // EIP-712 domain for LendingPool
  const domain = {
    name: 'LendingPool',
    version: '1',
    chainId: selectedNetwork === 'blockdag' ? 1043 : selectedNetwork === 'sepolia' ? 11155111 : 1,
    verifyingContract: networkAddresses.lendingPool
  }

  // EIP-712 types
  const types = {
    DepositAction: [
      { name: 'amount', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' }
    ],
    WithdrawAction: [
      { name: 'amount', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' }
    ]
  }

  const handleAction = async (action) => {
    setLoading(true)
    try {
      const signer = await getSigner()
      let contract, tx

      switch (action) {
        case 'deposit':
          contract = new ethers.Contract(networkAddresses.rwa, abis.rwa, signer)
          tx = await contract.approve(networkAddresses.vault, ethers.parseEther(amount))
          await tx.wait()
          contract = new ethers.Contract(networkAddresses.vault, abis.vault, signer)
          tx = await contract.deposit(ethers.parseEther(amount))
          await tx.wait()
          break
        case 'borrow':
          contract = new ethers.Contract(networkAddresses.vault, abis.vault, signer)
          tx = await contract.borrow(ethers.parseEther(amount))
          await tx.wait()
          break
        case 'approve-lend':
          contract = new ethers.Contract(networkAddresses.dusd, abis.dusd, signer)
          tx = await contract.approve(networkAddresses.lendingPool, ethers.parseEther(amount))
          await tx.wait()
          break
        case 'lend':
          // Use delegated signing utilities
          const userAddress = await signer.getAddress()
          const relayerUrl = process.env.REACT_APP_RELAYER_URL || 'http://localhost:3001'

          // Get current nonce from relayer
          const nonce = await getUserNonce(userAddress, relayerUrl)

          // Calculate deadline (30 minutes from now)
          const deadline = getDeadline(30)

          // Execute delegated deposit
          const result = await delegatedDeposit(
            signer,
            amount,
            nonce,
            deadline,
            networkAddresses.lendingPool,
            relayerUrl
          )

          console.log('Delegated deposit successful:', result.txHash)
          break
        case 'repay':
          contract = new ethers.Contract(networkAddresses.dusd, abis.dusd, signer)
          tx = await contract.approve(networkAddresses.vault, ethers.parseEther(amount))
          await tx.wait()
          contract = new ethers.Contract(networkAddresses.vault, abis.vault, signer)
          tx = await contract.repay(ethers.parseEther(amount))
          await tx.wait()
          break
        case 'withdraw':
          contract = new ethers.Contract(networkAddresses.vault, abis.vault, signer)
          tx = await contract.withdraw(ethers.parseEther(amount))
          await tx.wait()
          break
        case 'getAPY':
          contract = new ethers.Contract(networkAddresses.yieldRouter, abis.yieldRouter, getProvider())
          const apy = await contract.getAPY()
          alert(`Current APY: ${ethers.formatEther(apy)}%`)
          break
        case 'rebalance':
          contract = new ethers.Contract(networkAddresses.yieldRouter, abis.yieldRouter, signer)
          tx = await contract.rebalance()
          await tx.wait()
          break
        case 'mintRWA':
          contract = new ethers.Contract(networkAddresses.rwaRegistry, abis.rwaRegistry, signer)
          tx = await contract.mintRWA(ethers.parseEther(amount))
          await tx.wait()
          break
        case 'redeemRWA':
          contract = new ethers.Contract(networkAddresses.rwaRegistry, abis.rwaRegistry, signer)
          tx = await contract.redeemRWA(ethers.parseEther(amount))
          await tx.wait()
          break
        case 'proposeChange':
          contract = new ethers.Contract(networkAddresses.governance, abis.governance, signer)
          tx = await contract.proposeChange(amount) // amount as description
          await tx.wait()
          break
        case 'vote':
          contract = new ethers.Contract(networkAddresses.governance, abis.governance, signer)
          tx = await contract.vote(parseInt(amount)) // amount as proposal ID
          await tx.wait()
          break
        case 'executeProposal':
          contract = new ethers.Contract(networkAddresses.governance, abis.governance, signer)
          tx = await contract.executeProposal(parseInt(amount)) // amount as proposal ID
          await tx.wait()
          break
      }
      await onUpdate()
      setAmount('')
    } catch (error) {
      console.error('Action failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'borrow', label: 'Borrow dUSD' },
    { id: 'lend', label: 'Lend dUSD' },
    { id: 'manage', label: 'Manage Position' },
    { id: 'yield', label: 'Yield Management' },
    { id: 'rwa', label: 'RWA Registry' },
    { id: 'governance', label: 'Governance' }
  ]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="flex border-b border-slate-700">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-6 py-4 font-semibold text-sm transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-slate-700 text-white border-b-2 border-blue-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'borrow' && (
            <div>
              <h3 className="text-xl font-bold mb-4 text-white">Borrow dUSD</h3>
              <p className="text-slate-400 mb-4">Deposit RWA tokens as collateral to borrow dUSD stablecoins</p>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount of RWA to deposit"
                className="w-full p-3 mb-4 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => handleAction('deposit')}
                  disabled={loading || !amount}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200"
                >
                  {loading ? 'Depositing...' : 'Deposit RWA'}
                </button>
                <button
                  onClick={() => handleAction('borrow')}
                  disabled={loading || !amount}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200"
                >
                  {loading ? 'Borrowing...' : 'Borrow dUSD'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'lend' && (
            <div>
              <h3 className="text-xl font-bold mb-4 text-white">Lend dUSD</h3>
              <p className="text-slate-400 mb-4">Lend your dUSD tokens to earn yield from borrowers</p>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount of dUSD to lend"
                className="w-full p-3 mb-4 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => handleAction('approve-lend')}
                  disabled={loading || !amount}
                  className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200"
                >
                  {loading ? 'Approving...' : 'Approve dUSD'}
                </button>
                <button
                  onClick={() => handleAction('lend')}
                  disabled={loading || !amount}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200"
                >
                  {loading ? 'Lending...' : 'Lend dUSD'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'manage' && (
            <div>
              <h3 className="text-xl font-bold mb-4 text-white">Manage Position</h3>
              <p className="text-slate-400 mb-4">Repay loans or withdraw collateral from your position</p>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount to repay or withdraw"
                className="w-full p-3 mb-4 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => handleAction('repay')}
                  disabled={loading || !amount}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200"
                >
                  {loading ? 'Repaying...' : 'Repay dUSD'}
                </button>
                <button
                  onClick={() => handleAction('withdraw')}
                  disabled={loading || !amount}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200"
                >
                  {loading ? 'Withdrawing...' : 'Withdraw RWA'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'yield' && (
            <div>
              <h3 className="text-xl font-bold mb-4 text-white">Yield Management</h3>
              <p className="text-slate-400 mb-4">Rebalance yield strategies and view current APY</p>
              <div className="mb-4">
                <button
                  onClick={() => handleAction('getAPY')}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200"
                >
                  Get Current APY
                </button>
              </div>
              <button
                onClick={() => handleAction('rebalance')}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200"
              >
                {loading ? 'Rebalancing...' : 'Rebalance Yield'}
              </button>
            </div>
          )}

          {activeTab === 'rwa' && (
            <div>
              <h3 className="text-xl font-bold mb-4 text-white">RWA Registry</h3>
              <p className="text-slate-400 mb-4">Mint or redeem Real-World Asset tokens</p>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount of RWA"
                className="w-full p-3 mb-4 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => handleAction('mintRWA')}
                  disabled={loading || !amount}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200"
                >
                  {loading ? 'Minting...' : 'Mint RWA'}
                </button>
                <button
                  onClick={() => handleAction('redeemRWA')}
                  disabled={loading || !amount}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200"
                >
                  {loading ? 'Redeeming...' : 'Redeem RWA'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'governance' && (
            <div>
              <h3 className="text-xl font-bold mb-4 text-white">Governance</h3>
              <p className="text-slate-400 mb-4">Propose changes, vote on proposals, or execute approved proposals</p>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Proposal description or ID"
                className="w-full p-3 mb-4 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => handleAction('proposeChange')}
                  disabled={loading || !amount}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200"
                >
                  {loading ? 'Proposing...' : 'Propose Change'}
                </button>
                <button
                  onClick={() => handleAction('vote')}
                  disabled={loading || !amount}
                  className="flex-1 bg-pink-600 hover:bg-pink-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200"
                >
                  {loading ? 'Voting...' : 'Vote'}
                </button>
                <button
                  onClick={() => handleAction('executeProposal')}
                  disabled={loading || !amount}
                  className="flex-1 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200"
                >
                  {loading ? 'Executing...' : 'Execute Proposal'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Tabs
