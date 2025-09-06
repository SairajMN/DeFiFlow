# 🌐 LRCN DeFi Protocol  
**Liquidity Rebalancing Credit Network — built on BlockDAG**

---

## 📌 Overview

The **LRCN DeFi Protocol** project built to demonstrate the power of **BlockDAG’s EVM & SDK** for DeFi innovation.  
It enables users to **lend, borrow, earn yield, and interact with synthetic real-world assets (RWA)** in a single dApp.  

Key innovations:  
- ⚡ **Auto-Rebalancing Credit Pools** — yield strategies rebalance dynamically.  
- 🌍 **Synthetic RWA Tokens** — on-chain representation of assets (Treasuries, Real Estate).  
- 🔗 **Cross-Chain Bridge Integration** — BlockDAG bridge SDK for future liquidity movement.  
- 🛡 **Delegated Risk Control** — enforce borrowing caps with BlockDAG signatures.  

---

## 🏗️ Architecture

**1. Smart Contracts (Solidity, BlockDAG EVM)**  
- `LendingPool.sol` → deposits, borrowing, repayments, withdrawals.  
- `YieldRouter.sol` → simulates auto-rebalancing yield strategies.  
- `RWARegistry.sol` → mints synthetic RWA tokens.  
- `Governance.sol` → lightweight DAO for parameter updates.  

**2. Frontend (React + TailwindCSS)**  
- Wallet connect (MetaMask + BlockDAG SDK).  
- Unified dashboard with lending & borrowing flows.  
- Live balances, yields, and governance interactions.  

**3. Backend Scripts (Node.js / Hardhat)**  
- Deployment, verification, and demo scripts.  
- Mock oracle & RWA minting scripts.  

---

## 🔑 Core Functions

### 🔹 LendingPool.sol
```solidity
function deposit(address token, uint256 amount) external;
function borrow(address token, uint256 amount) external;
function repay(address token, uint256 amount) external;
function withdraw(address token, uint256 amount) external;
 