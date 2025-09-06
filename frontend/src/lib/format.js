import CollateralVaultABI from './abis/CollateralVault.json'
import LendingPoolABI from './abis/LendingPool.json'
import DUSDABI from './abis/DUSD.json'
import RWAAssetTokenABI from './abis/RWAAssetToken.json'
// Add placeholders for additional ABIs - replace with actual compiled ABIs
const YieldRouterABI = [] // TODO: Add actual ABI
const RWARegistryABI = [] // TODO: Add actual ABI
const GovernanceABI = [] // TODO: Add actual ABI

export const abis = {
  vault: CollateralVaultABI,
  lendingPool: LendingPoolABI,
  dusd: DUSDABI,
  rwa: RWAAssetTokenABI,
  yieldRouter: YieldRouterABI,
  rwaRegistry: RWARegistryABI,
  governance: GovernanceABI
}
