import { useState } from 'react'

function ConnectButton({ onConnect, account, username, onDisconnect, isConnecting }) {
  const [showDropdown, setShowDropdown] = useState(false)

  const handleConnect = async () => {
    try {
      await onConnect()
    } catch (error) {
      console.error('Connect button error:', error)
    }
  }

  const handleDisconnect = () => {
    if (onDisconnect) {
      onDisconnect()
    }
    setShowDropdown(false)
  }

  if (account) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
        >
          <div className="w-2 h-2 bg-green-300 rounded-full"></div>
          {username || account.slice(0, 6) + '...' + account.slice(-4)}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showDropdown && (
          <div className="absolute right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-50">
            <div className="p-3 border-b border-slate-700">
              <div className="text-xs text-slate-400">Connected Account</div>
              <div className="text-sm text-white font-semibold mb-1">{username || 'Unnamed Account'}</div>
              <div className="text-xs text-slate-500 font-mono">{account.slice(0, 8)}...{account.slice(-6)}</div>
            </div>
            <div className="p-2">
              <button
                onClick={handleDisconnect}
                className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-slate-700 rounded transition-colors"
              >
                Disconnect Wallet
              </button>
            </div>
          </div>
        )}

        {/* Click outside to close dropdown */}
        {showDropdown && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
        )}
      </div>
    )
  }

  return (
    <button
      onClick={handleConnect}
      disabled={isConnecting}
      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold py-2 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:transform-none"
    >
      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  )
}

export default ConnectButton
