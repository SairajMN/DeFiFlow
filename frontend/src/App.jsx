import { useState, useEffect } from 'react'
import ConnectButton from './components/ConnectButton'
import Tabs from './components/Tabs'
import Stat from './components/Stat'
import { ethers } from 'ethers'
import { getProvider, getSigner, connectWallet, setNetwork } from './lib/ethers'
import { addresses } from './lib/addresses'
import { abis } from './lib/format'

function App() {
  const [account, setAccount] = useState(null)
  const [balances, setBalances] = useState({ rwa: '0', dusd: '0' })
  const [position, setPosition] = useState({ collateral: '0', debt: '0' })
  const [maxBorrowable, setMaxBorrowable] = useState('0')
  const [previewBalance, setPreviewBalance] = useState('0')
  const [showBridgeModal, setShowBridgeModal] = useState(false)
  const [bridgeAmount, setBridgeAmount] = useState('')
  const [selectedChain, setSelectedChain] = useState('ethereum')
  const [bridgeLoading, setBridgeLoading] = useState(false)
  const [bridgeTxHash, setBridgeTxHash] = useState('')
  const [showUsernameModal, setShowUsernameModal] = useState(false)
  const [username, setUsername] = useState('')
  const [walletAddress, setWalletAddress] = useState('')
  const [pendingConnection, setPendingConnection] = useState(false)
  const [selectedNetwork, setSelectedNetwork] = useState('blockdag')

  const initiateWalletConnection = async () => {
    setShowUsernameModal(true)
  }

  const confirmConnection = async () => {
    setPendingConnection(true)
    try {
      console.log('Starting wallet connection...')

      // Validate wallet address if provided
      if (walletAddress && !ethers.isAddress(walletAddress)) {
        throw new Error('Invalid wallet address format')
      }

      // First, try to connect to wallet
      console.log('Requesting wallet accounts...')
      await window.ethereum.request({ method: 'eth_requestAccounts' })

      console.log('Getting signer...')
      const signer = await getSigner()
      const connectedAddress = await signer.getAddress()

      console.log('Wallet connected:', connectedAddress)

      // If user specified an address, check if it matches the connected wallet
      if (walletAddress && walletAddress.toLowerCase() !== connectedAddress.toLowerCase()) {
        alert(`Connected wallet (${connectedAddress}) doesn't match the specified address (${walletAddress}). Please connect with the correct wallet.`)
        return
      }

      setAccount(connectedAddress)

      // Set default username if none provided
      if (!username.trim()) {
        // Check if we have any existing accounts to determine the next number
        const existingAccounts = JSON.parse(localStorage.getItem('lrcn_accounts') || '[]')
        const nextNumber = existingAccounts.length + 1
        const defaultName = `Account ${nextNumber}`
        setUsername(defaultName)

        // Store account mapping
        const accountData = {
          address: connectedAddress,
          username: defaultName,
          connectedAt: new Date().toISOString()
        }
        existingAccounts.push(accountData)
        localStorage.setItem('lrcn_accounts', JSON.stringify(existingAccounts))
      }

      console.log('Connection successful!')
    } catch (error) {
      console.error('Connection failed:', error)
      alert(`Connection failed: ${error.message}`)
    } finally {
      setShowUsernameModal(false)
      setPendingConnection(false)
    }
  }

  const disconnectWallet = () => {
    setAccount(null)
    // Clear all state
    setBalances({ rwa: '0', dusd: '0' })
    setPosition({ collateral: '0', debt: '0' })
    setMaxBorrowable('0')
    setPreviewBalance('0')
    setBridgeAmount('')
    setBridgeTxHash('')
    setShowBridgeModal(false)
  }

  const handleNetworkChange = async (network) => {
    setSelectedNetwork(network)
    setNetwork(network)
    // Disconnect wallet when switching networks
    disconnectWallet()
  }

  const updateBalances = async () => {
    if (!account) return
    try {
      const provider = getProvider()
      const networkAddresses = addresses[selectedNetwork]
      const rwaContract = new ethers.Contract(networkAddresses.rwa, abis.rwa, provider)
      const dusdContract = new ethers.Contract(networkAddresses.dusd, abis.dusd, provider)
      const vaultContract = new ethers.Contract(networkAddresses.vault, abis.vault, provider)
      const lendingPoolContract = new ethers.Contract(networkAddresses.lendingPool, abis.lendingPool, provider)

      const rwaBalance = await rwaContract.balanceOf(account)
      const dusdBalance = await dusdContract.balanceOf(account)
      const pos = await vaultContract.positions(account)
      const maxBorrow = await vaultContract.getMaxBorrow(account)
      const preview = await lendingPoolContract.previewBalance(account)

      setBalances({
        rwa: ethers.formatEther(rwaBalance),
        dusd: ethers.formatEther(dusdBalance)
      })
      setPosition({
        collateral: ethers.formatEther(pos.collateral),
        debt: ethers.formatEther(pos.debt)
      })
      setMaxBorrowable(ethers.formatEther(maxBorrow))
      setPreviewBalance(ethers.formatEther(preview))
    } catch (error) {
      console.error('Update balances failed:', error)
    }
  }

  const handleBridge = async (assetType) => {
    if (!bridgeAmount || !account) return

    setBridgeLoading(true)
    try {
      const signer = await getSigner()
      const networkAddresses = addresses[selectedNetwork]
      let contract, tx

      if (assetType === 'rwa') {
        contract = new ethers.Contract(networkAddresses.rwa, abis.rwa, signer)
        tx = await contract.approve('0x1234567890123456789012345678901234567890', ethers.parseEther(bridgeAmount)) // Mock bridge contract
        await tx.wait()
        // Simulate bridge transaction
        setBridgeTxHash('0x' + Math.random().toString(16).substr(2, 64))
      } else if (assetType === 'dusd') {
        contract = new ethers.Contract(networkAddresses.dusd, abis.dusd, signer)
        tx = await contract.approve('0x1234567890123456789012345678901234567890', ethers.parseEther(bridgeAmount)) // Mock bridge contract
        await tx.wait()
        // Simulate bridge transaction
        setBridgeTxHash('0x' + Math.random().toString(16).substr(2, 64))
      } else if (assetType === 'multi') {
        // Multi-asset bridge - approve both tokens
        const rwaContract = new ethers.Contract(networkAddresses.rwa, abis.rwa, signer)
        const dusdContract = new ethers.Contract(networkAddresses.dusd, abis.dusd, signer)

        const rwaTx = await rwaContract.approve('0x1234567890123456789012345678901234567890', ethers.parseEther(bridgeAmount))
        await rwaTx.wait()

        const dusdTx = await dusdContract.approve('0x1234567890123456789012345678901234567890', ethers.parseEther(bridgeAmount))
        await dusdTx.wait()

        // Simulate bridge transaction
        setBridgeTxHash('0x' + Math.random().toString(16).substr(2, 64))
      }

      // Update balances after bridge
      await updateBalances()

      // Show success message
      setTimeout(() => {
        alert(`Successfully bridged ${bridgeAmount} ${assetType.toUpperCase()} to ${selectedChain.toUpperCase()}!\n\nTransaction Hash: ${bridgeTxHash}`)
        setBridgeAmount('')
        setBridgeTxHash('')
      }, 2000)

    } catch (error) {
      console.error('Bridge failed:', error)
      alert('Bridge transaction failed. Please try again.')
    } finally {
      setBridgeLoading(false)
    }
  }

  useEffect(() => {
    if (account) {
      updateBalances()
    }
  }, [account])

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">LRCN</h1>
              <p className="text-sm text-slate-400">Liquid RWA Credit Network</p>
            </div>
            <div className="flex items-center gap-4">
              <select
                value={selectedNetwork}
                onChange={(e) => handleNetworkChange(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1 text-sm text-white focus:border-blue-400 focus:outline-none"
              >
                <option value="hardhat">Hardhat (Local)</option>
                <option value="blockdag">BlockDAG (Testnet)</option>
                <option value="sepolia">Sepolia (Testnet)</option>
                <option value="mainnet">Ethereum Mainnet</option>
              </select>
              <ConnectButton
                onConnect={initiateWalletConnection}
                account={account}
                username={username}
                onDisconnect={disconnectWallet}
                isConnecting={pendingConnection}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Hero Section */}
        {!account && (
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Borrow Against Your Assets
            </h2>
            <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
              Deposit tokenized real-world assets as collateral, borrow dUSD stablecoins,
              and earn yield by lending in the pool - all on {selectedNetwork === 'blockdag' ? 'BlockDAG' : selectedNetwork === 'sepolia' ? 'Sepolia Testnet' : 'Ethereum Mainnet'}.
            </p>
            <div className="flex justify-center gap-4">
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <div className="text-2xl font-bold text-blue-400">70%</div>
                <div className="text-sm text-slate-400">Max LTV</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <div className="text-2xl font-bold text-green-400">10%</div>
                <div className="text-sm text-slate-400">APR Yield</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <div className="text-2xl font-bold text-purple-400">EVM</div>
                <div className="text-sm text-slate-400">Compatible</div>
              </div>
            </div>
          </div>
        )}

        {account && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <div className="text-sm text-slate-400 mb-1">RWA Balance</div>
                <div className="text-2xl font-bold text-white">{balances.rwa}</div>
                <div className="text-xs text-slate-500">RWA Tokens</div>
              </div>
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <div className="text-sm text-slate-400 mb-1">dUSD Balance</div>
                <div className="text-2xl font-bold text-white">{balances.dusd}</div>
                <div className="text-xs text-slate-500">Stablecoins</div>
              </div>
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <div className="text-sm text-slate-400 mb-1">Max Borrowable</div>
                <div className="text-2xl font-bold text-blue-400">{maxBorrowable}</div>
                <div className="text-xs text-slate-500">dUSD Available</div>
              </div>
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <div className="text-sm text-slate-400 mb-1">Lending Balance</div>
                <div className="text-2xl font-bold text-green-400">{previewBalance}</div>
                <div className="text-xs text-slate-500">With Interest</div>
              </div>
            </div>

            {/* Position Overview */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-8">
              <h3 className="text-lg font-semibold mb-4 text-white">Your Position</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="text-sm text-slate-400 mb-2">Collateral</div>
                  <div className="text-xl font-bold text-white">{position.collateral} RWA</div>
                  <div className="text-xs text-slate-500 mt-1">Deposited Assets</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="text-sm text-slate-400 mb-2">Debt</div>
                  <div className="text-xl font-bold text-red-400">{position.debt} dUSD</div>
                  <div className="text-xs text-slate-500 mt-1">Outstanding Loan</div>
                </div>
              </div>
            </div>

            {/* Action Tabs */}
            <Tabs onUpdate={updateBalances} selectedNetwork={selectedNetwork} />
          </>
        )}

        {/* Username Modal */}
        {showUsernameModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-2xl border border-slate-700 max-w-md w-full">
              <div className="p-6 border-b border-slate-700">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-white">Connect Wallet</h3>
                  <button
                    onClick={() => {
                      setShowUsernameModal(false)
                      setPendingConnection(false)
                    }}
                    className="text-slate-400 hover:text-white text-2xl"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🔗</span>
                  </div>
                  <h4 className="text-lg font-semibold text-white mb-2">Connect to Wallet</h4>
                  <p className="text-slate-400 text-sm">
                    Enter wallet address and optional username to connect
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Wallet Address <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      value={walletAddress}
                      onChange={(e) => setWalletAddress(e.target.value)}
                      placeholder="0x..."
                      className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none font-mono"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Enter the wallet address you want to connect to
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Username (Optional)</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter username or leave blank for default"
                      className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                      maxLength={20}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      {!username.trim() ? "Will use default: Account 1, Account 2, etc." : ""}
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowUsernameModal(false)
                        setPendingConnection(false)
                      }}
                      className="flex-1 bg-slate-600 hover:bg-slate-700 text-white py-3 px-4 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmConnection}
                      disabled={pendingConnection || !walletAddress.trim()}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-3 px-4 rounded-lg transition-colors"
                    >
                      {pendingConnection ? 'Connecting...' : 'Connect Wallet'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 pt-8 border-t border-slate-700">
          <div className="flex justify-center gap-6 mb-4">
            <div className="text-sm text-slate-400">Built on {selectedNetwork === 'blockdag' ? 'BlockDAG' : selectedNetwork === 'sepolia' ? 'Sepolia Testnet' : 'Ethereum Mainnet'}</div>
            <div className="text-sm text-slate-400">EVM Compatible</div>
            <div className="text-sm text-slate-400">Real-World Assets</div>
          </div>
          <button
            onClick={() => setShowBridgeModal(true)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105"
          >
            🌉 Bridge Assets
          </button>

          {/* Bridge Modal */}
          {showBridgeModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-slate-800 rounded-2xl border border-slate-700 max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-slate-700">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white">Bridge Assets</h3>
                    <button
                      onClick={() => setShowBridgeModal(false)}
                      className="text-slate-400 hover:text-white text-2xl"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Bridge Info */}
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl">🌉</span>
                    </div>
                    <h4 className="text-lg font-semibold text-white mb-2">Cross-Chain Bridge</h4>
                    <p className="text-slate-400 text-sm">
                      Move your assets between BlockDAG and other EVM-compatible chains
                    </p>
                  </div>

                  {/* Amount Input */}
                  <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                    <label className="block text-sm font-medium text-white mb-2">Bridge Amount</label>
                    <input
                      type="number"
                      value={bridgeAmount}
                      onChange={(e) => setBridgeAmount(e.target.value)}
                      placeholder="Enter amount to bridge"
                      className="w-full p-3 bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                    />
                  </div>

                  {/* Chain Selection */}
                  <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                    <label className="block text-sm font-medium text-white mb-2">Destination Chain</label>
                    <select
                      value={selectedChain}
                      onChange={(e) => setSelectedChain(e.target.value)}
                      className="w-full p-3 bg-slate-600 border border-slate-500 rounded-lg text-white focus:border-blue-400 focus:outline-none"
                    >
                      <option value="ethereum">Ethereum Mainnet</option>
                      <option value="bsc">Binance Smart Chain</option>
                      <option value="polygon">Polygon</option>
                      <option value="arbitrum">Arbitrum</option>
                      <option value="optimism">Optimism</option>
                    </select>
                  </div>

                  {/* Bridge Options */}
                  <div className="space-y-4">
                    <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-white">RWA Tokens</span>
                        <span className="text-sm text-slate-400">BlockDAG → {selectedChain}</span>
                      </div>
                      <p className="text-xs text-slate-500 mb-3">Bridge your tokenized real-world assets</p>
                      <button
                        onClick={() => handleBridge('rwa')}
                        disabled={bridgeLoading || !bridgeAmount}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                      >
                        {bridgeLoading ? 'Bridging...' : 'Bridge RWA'}
                      </button>
                    </div>

                    <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-white">dUSD Stablecoins</span>
                        <span className="text-sm text-slate-400">BlockDAG → {selectedChain}</span>
                      </div>
                      <p className="text-xs text-slate-500 mb-3">Bridge stablecoins across chains</p>
                      <button
                        onClick={() => handleBridge('dusd')}
                        disabled={bridgeLoading || !bridgeAmount}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                      >
                        {bridgeLoading ? 'Bridging...' : 'Bridge dUSD'}
                      </button>
                    </div>

                    <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-white">Multi-Asset Bridge</span>
                        <span className="text-sm text-slate-400">BlockDAG → {selectedChain}</span>
                      </div>
                      <p className="text-xs text-slate-500 mb-3">Bridge multiple assets simultaneously</p>
                      <button
                        onClick={() => handleBridge('multi')}
                        disabled={bridgeLoading || !bridgeAmount}
                        className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                      >
                        {bridgeLoading ? 'Bridging...' : 'Multi-Bridge'}
                      </button>
                    </div>
                  </div>

                  {/* Bridge Stats */}
                  <div className="bg-slate-700/30 rounded-lg p-4">
                    <h5 className="font-medium text-white mb-3">Bridge Statistics</h5>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-slate-400">Total Bridged</div>
                        <div className="text-white font-semibold">$2.4M+</div>
                      </div>
                      <div>
                        <div className="text-slate-400">Active Chains</div>
                        <div className="text-white font-semibold">5 Networks</div>
                      </div>
                      <div>
                        <div className="text-slate-400">Avg. Time</div>
                        <div className="text-white font-semibold">2-5 min</div>
                      </div>
                      <div>
                        <div className="text-slate-400">Fee</div>
                        <div className="text-white font-semibold">0.1%</div>
                      </div>
                    </div>
                  </div>

                  {/* Bridge Status */}
                  {bridgeTxHash && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-green-400 text-sm">✅</span>
                        </div>
                        <div>
                          <h6 className="font-medium text-green-400 mb-1">Bridge Successful</h6>
                          <p className="text-slate-300 text-sm">
                            Transaction Hash: {bridgeTxHash.slice(0, 10)}...{bridgeTxHash.slice(-8)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bridge Info */}
                  <div className="bg-slate-700/30 rounded-lg p-4">
                    <h6 className="font-medium text-white mb-2">Bridge Information</h6>
                    <div className="text-sm text-slate-300 space-y-1">
                      <p>• Bridge time: 2-5 minutes</p>
                      <p>• Bridge fee: 0.1% of amount</p>
                      <p>• Supported chains: Ethereum, BSC, Polygon, Arbitrum, Optimism</p>
                      <p>• Minimum bridge amount: 0.01 tokens</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
