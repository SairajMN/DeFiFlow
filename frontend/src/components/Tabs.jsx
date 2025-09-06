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
  const [rwaName, setRwaName] = useState('')
  const [rwaDescription, setRwaDescription] = useState('')
  const [rwaValue, setRwaValue] = useState('')
  const [rwaCustodian, setRwaCustodian] = useState('')
  const [tokenId, setTokenId] = useState('')
  const [rwaDetails, setRwaDetails] = useState(null)
  const [allRwas, setAllRwas] = useState([])
  const [custodianAddress, setCustodianAddress] = useState('')
  const [userStats, setUserStats] = useState({
    apy: '0',
    totalEarned: '0',
    lentAmount: '0',
    availableRewards: '0'
  })

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

  const fetchUserStats = async () => {
    try {
      const signer = await getSigner()
      const userAddress = await signer.getAddress()
      const provider = getProvider()

      // Fetch APY from YieldRouter
      const yieldRouterContract = new ethers.Contract(networkAddresses.yieldRouter, abis.yieldRouter, provider)
      const apy = await yieldRouterContract.getAPY()

      // Fetch user lending position from LendingPool
      const lendingPoolContract = new ethers.Contract(networkAddresses.lendingPool, abis.lendingPool, provider)
      const lentAmount = await lendingPoolContract.getUserLendingPosition(userAddress)

      // Fetch available rewards
      const availableRewards = await lendingPoolContract.getPendingRewards(userAddress)

      setUserStats({
        apy: ethers.formatEther(apy),
        totalEarned: '0', // This would need a contract function to track total earned
        lentAmount: ethers.formatEther(lentAmount),
        availableRewards: ethers.formatEther(availableRewards)
      })
    } catch (error) {
      console.error('Failed to fetch user stats:', error)
    }
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
          const lenderAddress = await signer.getAddress()
          const relayerUrl = process.env.REACT_APP_RELAYER_URL || 'http://localhost:3001'

          // Get current nonce from relayer
          const nonce = await getUserNonce(lenderAddress, relayerUrl)

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
          const userAddress = await signer.getAddress()
          tx = await contract.mintRWA(userAddress, rwaName, rwaDescription, ethers.parseEther(rwaValue), rwaCustodian || userAddress)
          await tx.wait()
          setRwaName('')
          setRwaDescription('')
          setRwaValue('')
          setRwaCustodian('')
          break
        case 'redeemRWA':
          contract = new ethers.Contract(networkAddresses.rwaRegistry, abis.rwaRegistry, signer)
          tx = await contract.redeemRWA(parseInt(tokenId), ethers.parseEther(amount))
          await tx.wait()
          break
        case 'getRWA':
          contract = new ethers.Contract(networkAddresses.rwaRegistry, abis.rwaRegistry, getProvider())
          const rwa = await contract.getRWA(parseInt(tokenId))
          setRwaDetails({
            name: rwa[0],
            description: rwa[1],
            value: ethers.formatEther(rwa[2]),
            custodian: rwa[3],
            verified: rwa[4],
            createdAt: new Date(Number(rwa[5]) * 1000).toLocaleString()
          })
          break
        case 'verifyRWA':
          contract = new ethers.Contract(networkAddresses.rwaRegistry, abis.rwaRegistry, signer)
          tx = await contract.verifyRWA(parseInt(tokenId))
          await tx.wait()
          break
        case 'authorizeCustodian':
          contract = new ethers.Contract(networkAddresses.rwaRegistry, abis.rwaRegistry, signer)
          tx = await contract.authorizeCustodian(custodianAddress)
          await tx.wait()
          setCustodianAddress('')
          break
        case 'revokeCustodian':
          contract = new ethers.Contract(networkAddresses.rwaRegistry, abis.rwaRegistry, signer)
          tx = await contract.revokeCustodian(custodianAddress)
          await tx.wait()
          setCustodianAddress('')
          break
        case 'listRWAs':
          contract = new ethers.Contract(networkAddresses.rwaRegistry, abis.rwaRegistry, getProvider())
          const totalRWAs = await contract.getTotalRWAs()
          const rwaList = []
          for (let i = 1; i <= Number(totalRWAs); i++) {
            const rwa = await contract.getRWA(i)
            rwaList.push({
              id: i,
              name: rwa[0],
              description: rwa[1],
              value: ethers.formatEther(rwa[2]),
              custodian: rwa[3],
              verified: rwa[4],
              createdAt: new Date(Number(rwa[5]) * 1000).toLocaleString()
            })
          }
          setAllRwas(rwaList)
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
        case 'claim-rewards':
          contract = new ethers.Contract(networkAddresses.lendingPool, abis.lendingPool, signer)
          tx = await contract.claimRewards()
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
    { id: 'earn', label: 'Earn Yield' },
    { id: 'manage', label: 'Manage Position' },
    { id: 'yield', label: 'Yield Management' },
    { id: 'rwa', label: 'RWA Registry & Actions' },
    { id: 'governance', label: 'Governance' }
  ]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="flex border-b border-slate-700">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                if (tab.id === 'earn') {
                  fetchUserStats()
                }
              }}
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

          {activeTab === 'earn' && (
            <div>
              <h3 className="text-xl font-bold mb-4 text-white">Earn Yield</h3>
              <p className="text-slate-400 mb-6">Earn yield by lending dUSD tokens or participating in yield farming</p>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-700/30 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-400 mb-1">{userStats.apy}%</div>
                  <div className="text-sm text-slate-400">Current APY</div>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-400 mb-1">${userStats.totalEarned}</div>
                  <div className="text-sm text-slate-400">Total Earned</div>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-400 mb-1">${userStats.lentAmount}</div>
                  <div className="text-sm text-slate-400">Lent Amount</div>
                </div>
              </div>

              {/* Lend dUSD Section */}
              <div className="bg-slate-700/30 rounded-lg p-4 mb-4">
                <h4 className="text-lg font-semibold text-white mb-3">Lend dUSD</h4>
                <p className="text-slate-400 text-sm mb-4">Lend your dUSD tokens to earn yield from borrowers</p>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Amount of dUSD to lend"
                  className="w-full p-3 mb-4 bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
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

              {/* Yield Farming Section */}
              <div className="bg-slate-700/30 rounded-lg p-4 mb-4">
                <h4 className="text-lg font-semibold text-white mb-3">Yield Farming</h4>
                <p className="text-slate-400 text-sm mb-4">Stake your tokens in yield farming pools for additional rewards</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <select className="p-3 bg-slate-600 border border-slate-500 rounded-lg text-white focus:border-blue-400 focus:outline-none">
                    <option value="">Select Pool</option>
                    <option value="dusd-usdc">dUSD-USDC LP</option>
                    <option value="dusd-eth">dUSD-ETH LP</option>
                    <option value="rwa-dusd">RWA-dUSD LP</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Amount to stake"
                    className="p-3 bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                  />
                </div>
                <button
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200"
                >
                  {loading ? 'Staking...' : 'Stake in Pool'}
                </button>
              </div>

              {/* Claim Rewards */}
              <div className="bg-slate-700/30 rounded-lg p-4">
                <h4 className="text-lg font-semibold text-white mb-3">Claim Rewards</h4>
                <p className="text-slate-400 text-sm mb-4">Claim your accumulated yield rewards</p>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-white font-semibold">Available Rewards</div>
                    <div className="text-green-400">{userStats.availableRewards} dUSD</div>
                  </div>
                  <button
                    onClick={() => handleAction('claim-rewards')}
                    disabled={loading}
                    className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white font-semibold py-2 px-6 rounded-lg transition-all duration-200"
                  >
                    {loading ? 'Claiming...' : 'Claim All'}
                  </button>
                </div>
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
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-white">RWA Registry & Actions</h3>

              {/* Mint RWA Section */}
              <div className="bg-slate-700/30 rounded-lg p-4">
                <h4 className="text-lg font-semibold text-white mb-3">Mint New RWA</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <input
                    type="text"
                    value={rwaName}
                    onChange={(e) => setRwaName(e.target.value)}
                    placeholder="RWA Name"
                    className="p-3 bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                  />
                  <input
                    type="number"
                    value={rwaValue}
                    onChange={(e) => setRwaValue(e.target.value)}
                    placeholder="Value (USD)"
                    className="p-3 bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                  />
                </div>
                <input
                  type="text"
                  value={rwaDescription}
                  onChange={(e) => setRwaDescription(e.target.value)}
                  placeholder="RWA Description"
                  className="w-full p-3 mb-4 bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                />
                <input
                  type="text"
                  value={rwaCustodian}
                  onChange={(e) => setRwaCustodian(e.target.value)}
                  placeholder="Custodian Address (optional)"
                  className="w-full p-3 mb-4 bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                />
                <button
                  onClick={() => handleAction('mintRWA')}
                  disabled={loading || !rwaName || !rwaValue}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200"
                >
                  {loading ? 'Minting...' : 'Mint RWA Token'}
                </button>
              </div>

              {/* View RWA Section */}
              <div className="bg-slate-700/30 rounded-lg p-4">
                <h4 className="text-lg font-semibold text-white mb-3">View RWA Details</h4>
                <input
                  type="number"
                  value={tokenId}
                  onChange={(e) => setTokenId(e.target.value)}
                  placeholder="Token ID"
                  className="w-full p-3 mb-4 bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                />
                <button
                  onClick={() => handleAction('getRWA')}
                  disabled={loading || !tokenId}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 mb-4"
                >
                  {loading ? 'Loading...' : 'Get RWA Details'}
                </button>

                {rwaDetails && (
                  <div className="bg-slate-600 rounded-lg p-4">
                    <h5 className="font-semibold text-white mb-2">{rwaDetails.name}</h5>
                    <p className="text-slate-300 text-sm mb-2">{rwaDetails.description}</p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-400">Value:</span>
                        <span className="text-white ml-2">${rwaDetails.value}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Verified:</span>
                        <span className={`ml-2 ${rwaDetails.verified ? 'text-green-400' : 'text-red-400'}`}>
                          {rwaDetails.verified ? 'Yes' : 'No'}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400">Custodian:</span>
                        <span className="text-white ml-2 font-mono text-xs">{rwaDetails.custodian}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400">Created:</span>
                        <span className="text-white ml-2">{rwaDetails.createdAt}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Redeem RWA Section */}
              <div className="bg-slate-700/30 rounded-lg p-4">
                <h4 className="text-lg font-semibold text-white mb-3">Redeem RWA</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <input
                    type="number"
                    value={tokenId}
                    onChange={(e) => setTokenId(e.target.value)}
                    placeholder="Token ID"
                    className="p-3 bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                  />
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Amount to Redeem"
                    className="p-3 bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => handleAction('redeemRWA')}
                  disabled={loading || !tokenId || !amount}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200"
                >
                  {loading ? 'Redeeming...' : 'Redeem RWA'}
                </button>
              </div>

              {/* Admin Actions */}
              <div className="bg-slate-700/30 rounded-lg p-4">
                <h4 className="text-lg font-semibold text-white mb-3">Admin Actions</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <input
                    type="number"
                    value={tokenId}
                    onChange={(e) => setTokenId(e.target.value)}
                    placeholder="Token ID to Verify"
                    className="p-3 bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={custodianAddress}
                    onChange={(e) => setCustodianAddress(e.target.value)}
                    placeholder="Custodian Address"
                    className="p-3 bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleAction('verifyRWA')}
                    disabled={loading || !tokenId}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200"
                  >
                    {loading ? 'Verifying...' : 'Verify RWA'}
                  </button>
                  <button
                    onClick={() => handleAction('authorizeCustodian')}
                    disabled={loading || !custodianAddress}
                    className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200"
                  >
                    {loading ? 'Authorizing...' : 'Authorize Custodian'}
                  </button>
                  <button
                    onClick={() => handleAction('revokeCustodian')}
                    disabled={loading || !custodianAddress}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200"
                  >
                    {loading ? 'Revoking...' : 'Revoke Custodian'}
                  </button>
                </div>
              </div>

              {/* List All RWAs */}
              <div className="bg-slate-700/30 rounded-lg p-4">
                <h4 className="text-lg font-semibold text-white mb-3">All RWAs</h4>
                <button
                  onClick={() => handleAction('listRWAs')}
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 mb-4"
                >
                  {loading ? 'Loading...' : 'List All RWAs'}
                </button>

                {allRwas.length > 0 && (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {allRwas.map((rwa) => (
                      <div key={rwa.id} className="bg-slate-600 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <h5 className="font-semibold text-white">{rwa.name}</h5>
                          <span className="text-xs text-slate-400">ID: {rwa.id}</span>
                        </div>
                        <p className="text-slate-300 text-sm mb-2">{rwa.description}</p>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Value: ${rwa.value}</span>
                          <span className={`text-slate-400 ${rwa.verified ? 'text-green-400' : 'text-red-400'}`}>
                            {rwa.verified ? 'Verified' : 'Unverified'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
