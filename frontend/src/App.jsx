import { useState, useEffect } from 'react'
import ConnectButton from './components/ConnectButton'
import Tabs from './components/Tabs'
import { ethers } from 'ethers'
import { getProvider, getSigner } from './lib/ethers'
import { addresses } from './lib/addresses'

function App() {
  const [account, setAccount] = useState(null)
  const [username, setUsername] = useState('')
  const [pendingConnection, setPendingConnection] = useState(false)
  const [showBridgeModal, setShowBridgeModal] = useState(false)
  const [showLearnMoreModal, setShowLearnMoreModal] = useState(false)
  const [bridgeAmount, setBridgeAmount] = useState('')
  const [bridgeAsset, setBridgeAsset] = useState('rwa')
  const [bridgeDestination, setBridgeDestination] = useState('ethereum')
  const [bridgeLoading, setBridgeLoading] = useState(false)
  const [balances, setBalances] = useState({ rwa: '0', dusd: '0' })
  const [selectedNetwork, setSelectedNetwork] = useState('blockdag')

  const networkAddresses = addresses[selectedNetwork]

  const initiateWalletConnection = async () => {
    setPendingConnection(true)
    try {
      if (typeof window.ethereum === 'undefined') {
        alert('Please install MetaMask or another Web3 wallet to continue.')
        return
      }

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const address = await signer.getAddress()

      setAccount(address)
      setUsername(`User ${address.slice(-4)}`)
      await updateBalances(address)
    } catch (error) {
      console.error('Connection failed:', error)
      alert('Failed to connect wallet. Please try again.')
    } finally {
      setPendingConnection(false)
    }
  }

  const disconnectWallet = () => {
    setAccount(null)
    setUsername('')
    setBalances({ rwa: '0', dusd: '0' })
  }

  const updateBalances = async (userAddress = account) => {
    if (!userAddress) return

    try {
      const provider = getProvider()
      const rwaContract = new ethers.Contract(networkAddresses.rwa, [], provider)
      const dusdContract = new ethers.Contract(networkAddresses.dusd, [], provider)

      const rwaBalance = await rwaContract.balanceOf(userAddress)
      const dusdBalance = await dusdContract.balanceOf(userAddress)

      setBalances({
        rwa: ethers.formatEther(rwaBalance || '0'),
        dusd: ethers.formatEther(dusdBalance || '0')
      })
    } catch (error) {
      console.error('Failed to update balances:', error)
    }
  }

  const handleBridgeAssets = () => {
    setShowBridgeModal(true)
  }

  const handleLearnMore = () => {
    setShowLearnMoreModal(true)
  }

  const handleDeposit = async (asset) => {
    if (!account) {
      alert('Please connect your wallet first')
      return
    }

    try {
      const signer = await getSigner()
      const amount = prompt(`Enter amount of ${asset} to deposit:`)

      if (!amount || isNaN(amount)) {
        alert('Invalid amount')
        return
      }

      // Approve RWA tokens
      const rwaContract = new ethers.Contract(networkAddresses.rwa, [], signer)
      const approveTx = await rwaContract.approve(networkAddresses.vault, ethers.parseEther(amount))
      await approveTx.wait()

      // Deposit to vault
      const vaultContract = new ethers.Contract(networkAddresses.vault, [], signer)
      const depositTx = await vaultContract.deposit(ethers.parseEther(amount))
      await depositTx.wait()

      alert(`Successfully deposited ${amount} ${asset}!`)
      await updateBalances()
    } catch (error) {
      console.error('Deposit failed:', error)
      alert('Deposit failed. Please try again.')
    }
  }

  const executeBridge = async () => {
    if (!bridgeAmount || !account) return

    setBridgeLoading(true)
    try {
      const signer = await getSigner()

      if (bridgeAsset === 'rwa') {
        const rwaContract = new ethers.Contract(networkAddresses.rwa, [], signer)
        const tx = await rwaContract.transfer('0x' + '0'.repeat(40), ethers.parseEther(bridgeAmount)) // Mock bridge
        await tx.wait()
      } else if (bridgeAsset === 'dusd') {
        const dusdContract = new ethers.Contract(networkAddresses.dusd, [], signer)
        const tx = await dusdContract.transfer('0x' + '0'.repeat(40), ethers.parseEther(bridgeAmount)) // Mock bridge
        await tx.wait()
      }

      alert(`Successfully bridged ${bridgeAmount} ${bridgeAsset.toUpperCase()} to ${bridgeDestination.toUpperCase()}!`)
      setBridgeAmount('')
      setShowBridgeModal(false)
      await updateBalances()
    } catch (error) {
      console.error('Bridge failed:', error)
      alert('Bridge failed. Please try again.')
    } finally {
      setBridgeLoading(false)
    }
  }

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  useEffect(() => {
    if (account) {
      updateBalances()
    }
  }, [account, selectedNetwork])

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">DeFiFlow</h1>
                <p className="text-xs text-slate-400">Where Real Assets Meet Smart DeFi</p>
              </div>
            </div>

            {/* Navigation Links */}
            <div className="hidden md:flex items-center space-x-8">
              <button onClick={() => scrollToSection('dashboard')} className="text-slate-300 hover:text-white transition-colors">Dashboard</button>
              <button onClick={() => scrollToSection('markets')} className="text-slate-300 hover:text-white transition-colors">Markets</button>
              <button onClick={handleBridgeAssets} className="text-slate-300 hover:text-white transition-colors">Bridge</button>
              <button onClick={() => scrollToSection('earn')} className="text-slate-300 hover:text-white transition-colors">Earn</button>
            </div>

            {/* Wallet Connection */}
            <div className="flex items-center space-x-4">
              {account && (
                <div className="hidden md:flex items-center space-x-2 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-slate-300">{account.slice(0, 6)}...{account.slice(-4)}</span>
                </div>
              )}
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
      </nav>

      <main className="container mx-auto px-6 py-8">
        {/* Hero Section */}
        <section className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-purple-500 to-teal-400 bg-clip-text text-transparent">
            Unlock the Power of Real-World Assets
          </h1>
          <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto leading-relaxed">
            Deposit tokenized real-world assets as collateral, borrow dUSD stablecoins, and earn yield by lending in the pool - all on BlockDAG.
          </p>

          {/* Key Metrics */}
          <div className="flex flex-col md:flex-row justify-center items-center gap-6 mb-10">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700 min-w-[200px]">
              <div className="flex items-center justify-center mb-3">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-3xl font-bold text-blue-400 mb-1">70%</div>
              <div className="text-sm text-slate-400">Max LTV</div>
            </div>
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700 min-w-[200px]">
              <div className="flex items-center justify-center mb-3">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="text-3xl font-bold text-green-400 mb-1">10%</div>
              <div className="text-sm text-slate-400">APR Yield</div>
            </div>
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700 min-w-[200px]">
              <div className="flex items-center justify-center mb-3">
                <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="text-3xl font-bold text-purple-400 mb-1">EVM</div>
              <div className="text-sm text-slate-400">Compatible</div>
            </div>
          </div>

          {/* Call-to-Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleBridgeAssets}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-4 px-8 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              Bridge Assets
            </button>
            <button
              onClick={handleLearnMore}
              className="bg-slate-800 hover:bg-slate-700 text-white font-semibold py-4 px-8 rounded-lg transition-all duration-200 border border-slate-600"
            >
              Learn More
            </button>
          </div>
        </section>

        {/* Dashboard Stats Section */}
        {account && (
          <section id="dashboard" className="mb-16">
            <h2 className="text-2xl font-bold text-white mb-8 text-center">Your Dashboard</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
                <div className="text-sm text-slate-400 mb-2">Total Collateral Deposited</div>
                <div className="text-2xl font-bold text-white">$0.00</div>
                <div className="text-xs text-slate-500 mt-1">Value in USD</div>
              </div>
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
                <div className="text-sm text-slate-400 mb-2">dUSD Borrowed</div>
                <div className="text-2xl font-bold text-white">$0.00</div>
                <div className="text-xs text-slate-500 mt-1">Outstanding debt</div>
              </div>
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
                <div className="text-sm text-slate-400 mb-2">Current Yield Earned</div>
                <div className="text-2xl font-bold text-green-400">$0.00</div>
                <div className="text-xs text-slate-500 mt-1">Total earnings</div>
              </div>
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
                <div className="text-sm text-slate-400 mb-2">Health Factor</div>
                <div className="text-2xl font-bold text-slate-400">N/A</div>
                <div className="text-xs text-slate-500 mt-1">Liquidation risk</div>
              </div>
            </div>
          </section>
        )}

        {/* RWA Registry & Actions */}
        {account && (
          <section id="earn" className="mb-16">
            <h2 className="text-2xl font-bold text-white mb-8 text-center">RWA Registry & Actions</h2>
            <Tabs onUpdate={updateBalances} selectedNetwork={selectedNetwork} />
          </section>
        )}

        {/* Asset Markets Table */}
        <section id="markets" className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">Available Markets</h2>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No Markets Available</h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                Markets will be displayed here once they are configured and deployed on the network.
                Use the RWA Registry tab above to mint and manage your RWA tokens.
              </p>
              {!account && (
                <button
                  onClick={initiateWalletConnection}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Connect Wallet to View Markets
                </button>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800">
        <div className="container mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <span className="text-xl font-bold text-white">DeFiFlow</span>
              </div>
              <p className="text-slate-400 text-sm">
                Where Real Assets Meet Smart DeFi on BlockDAG.
              </p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Platform</h3>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Dashboard</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Markets</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Bridge</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Earn</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Resources</h3>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Support</a></li>
                <li><a href="#" className="hover:text-white transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Community</h3>
              <div className="flex space-x-4">
                <a href="#" className="text-slate-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                </a>
                <a href="#" className="text-slate-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.019 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/>
                  </svg>
                </a>
                <a href="#" className="text-slate-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.174-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.749.097.118.112.221.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.746-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24.009 12.017 24.009c6.624 0 11.99-5.367 11.99-11.987C24.007 5.367 18.641.001.001.001z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-slate-400 text-sm">
            <p>&copy; 2025 DeFiFlow - Where Real Assets Meet Smart DeFi. All rights reserved.</p>
          </div>
        </div>
      </footer>

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
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">Cross-Chain Bridge</h4>
                <p className="text-slate-400 text-sm">
                  Move your assets between BlockDAG and other EVM-compatible chains
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Asset Type</label>
                  <select
                    value={bridgeAsset}
                    onChange={(e) => setBridgeAsset(e.target.value)}
                    className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-400 focus:outline-none"
                  >
                    <option value="rwa">RWA Tokens</option>
                    <option value="dusd">dUSD Stablecoins</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">Amount</label>
                  <input
                    type="number"
                    value={bridgeAmount}
                    onChange={(e) => setBridgeAmount(e.target.value)}
                    placeholder="Enter amount to bridge"
                    className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">Destination Chain</label>
                  <select
                    value={bridgeDestination}
                    onChange={(e) => setBridgeDestination(e.target.value)}
                    className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-400 focus:outline-none"
                  >
                    <option value="ethereum">Ethereum Mainnet</option>
                    <option value="bsc">Binance Smart Chain</option>
                    <option value="polygon">Polygon</option>
                    <option value="arbitrum">Arbitrum</option>
                    <option value="optimism">Optimism</option>
                  </select>
                </div>

                <button
                  onClick={executeBridge}
                  disabled={bridgeLoading || !bridgeAmount}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200"
                >
                  {bridgeLoading ? 'Bridging...' : 'Bridge Assets'}
                </button>
              </div>

              <div className="bg-slate-700/30 rounded-lg p-4">
                <h5 className="font-medium text-white mb-2">Bridge Information</h5>
                <div className="text-sm text-slate-300 space-y-1">
                  <p>• Bridge time: 2-5 minutes</p>
                  <p>• Bridge fee: 0.1% of amount</p>
                  <p>• Supported chains: Ethereum, BSC, Polygon, Arbitrum, Optimism</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Learn More Modal */}
      {showLearnMoreModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">Learn More About DeFiFlow</h3>
                <button
                  onClick={() => setShowLearnMoreModal(false)}
                  className="text-slate-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">Understanding Real-World Asset Tokenization</h4>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <h5 className="font-semibold text-white mb-2">What are Real-World Assets (RWAs)?</h5>
                  <p className="text-slate-300 text-sm">
                    Real-World Assets are physical or traditional financial assets that have been tokenized on the blockchain.
                    This includes real estate, treasury bonds, commodities, and other traditional investments that are typically
                    illiquid and difficult to trade.
                  </p>
                </div>

                <div className="bg-slate-700/30 rounded-lg p-4">
                  <h5 className="font-semibold text-white mb-2">How DeFiFlow Works</h5>
                  <p className="text-slate-300 text-sm">
                    DeFiFlow allows users to deposit tokenized RWAs as collateral and borrow dUSD stablecoins against them.
                    This provides liquidity to RWA holders while enabling borrowing at competitive rates. The platform
                    also offers yield farming opportunities for dUSD lenders.
                  </p>
                </div>

                <div className="bg-slate-700/30 rounded-lg p-4">
                  <h5 className="font-semibold text-white mb-2">Key Features</h5>
                  <ul className="text-slate-300 text-sm space-y-1">
                    <li>• <strong>70% Max LTV:</strong> Borrow up to 70% of your collateral value</li>
                    <li>• <strong>10% APR Yield:</strong> Competitive returns for liquidity providers</li>
                    <li>• <strong>EVM Compatible:</strong> Works with all Ethereum Virtual Machine chains</li>
                    <li>• <strong>Cross-Chain Bridge:</strong> Move assets between different blockchains</li>
                    <li>• <strong>Real-Time Oracle:</strong> Accurate asset valuations and price feeds</li>
                  </ul>
                </div>

                <div className="bg-slate-700/30 rounded-lg p-4">
                  <h5 className="font-semibold text-white mb-2">Supported Assets</h5>
                  <ul className="text-slate-300 text-sm space-y-1">
                    <li>• Tokenized US Treasury Bonds</li>
                    <li>• Real Estate Tokens</li>
                    <li>• Commodity Tokens</li>
                    <li>• Private Equity Tokens</li>
                    <li>• Other institutional-grade RWAs</li>
                  </ul>
                </div>

                <div className="bg-slate-700/30 rounded-lg p-4">
                  <h5 className="font-semibold text-white mb-2">Security & Compliance</h5>
                  <p className="text-slate-300 text-sm">
                    DeFiFlow implements industry-standard security practices including multi-signature wallets,
                    regular audits, and compliance with relevant regulations. All smart contracts are thoroughly
                    tested and verified on multiple blockchain networks.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowLearnMoreModal(false)}
                  className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowLearnMoreModal(false)
                    initiateWalletConnection()
                  }}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200"
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Background overlay for modals */}
      {(showBridgeModal || showLearnMoreModal) && (
        <div
          className="fixed inset-0 -z-10"
          onClick={() => {
            setShowBridgeModal(false)
            setShowLearnMoreModal(false)
          }}
        />
      )}
    </div>
  )
}

export default App
