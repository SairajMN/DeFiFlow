import { useState } from 'react'
import { ethers } from 'ethers'
import { getSigner } from '../lib/ethers'
import { addresses } from '../lib/addresses'
import { abis } from '../lib/format'

function Tabs({ onUpdate }) {
  const [activeTab, setActiveTab] = useState('borrow')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)

  // EIP-712 domain for LendingPool
  const domain = {
    name: 'LendingPool',
    version: '1',
    chainId: 1043, // BlockDAG chain ID
    verifyingContract: addresses.lendingPool
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
          contract = new ethers.Contract(addresses.rwa, abis.rwa, signer)
          tx = await contract.approve(addresses.vault, ethers.parseEther(amount))
          await tx.wait()
          contract = new ethers.Contract(addresses.vault, abis.vault, signer)
          tx = await contract.deposit(ethers.parseEther(amount))
          await tx.wait()
          break
        case 'borrow':
          contract = new ethers.Contract(addresses.vault, abis.vault, signer)
          tx = await contract.borrow(ethers.parseEther(amount))
          await tx.wait()
          break
        case 'approve-lend':
          contract = new ethers.Contract(addresses.dusd, abis.dusd, signer)
          tx = await contract.approve(addresses.lendingPool, ethers.parseEther(amount))
          await tx.wait()
          break
        case 'lend':
          // Fetch nonce from contract
          contract = new ethers.Contract(addresses.lendingPool, abis.lendingPool, signer)
          const userAddress = await signer.getAddress()
          const nonce = await contract.nonces(userAddress)

          // Create EIP-712 message
          const message = {
            amount: ethers.parseEther(amount),
            nonce: nonce,
            deadline: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
          }

          // Sign the typed message
          const signature = await signer.signTypedData(domain, types, message)

          // Send to relayer backend
          const response = await fetch('http://localhost:3001/api/deposit', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              amount: amount,
              nonce: nonce.toString(),
              deadline: message.deadline.toString(),
              signature: signature
            })
          })

          if (!response.ok) {
            throw new Error('Relayer request failed')
          }

          const result = await response.json()
          console.log('Delegated deposit successful:', result.txHash)
          break
        case 'repay':
          contract = new ethers.Contract(addresses.dusd, abis.dusd, signer)
          tx = await contract.approve(addresses.vault, ethers.parseEther(amount))
          await tx.wait()
          contract = new ethers.Contract(addresses.vault, abis.vault, signer)
          tx = await contract.repay(ethers.parseEther(amount))
          await tx.wait()
          break
        case 'withdraw':
          contract = new ethers.Contract(addresses.vault, abis.vault, signer)
          tx = await contract.withdraw(ethers.parseEther(amount))
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
    { id: 'manage', label: 'Manage Position' }
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
        </div>
      </div>
    </div>
  )
}

export default Tabs
