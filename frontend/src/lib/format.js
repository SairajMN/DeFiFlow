import CollateralVaultABI from './abis/CollateralVault.json'
import LendingPoolABI from './abis/LendingPool.json'
import DUSDABI from './abis/DUSD.json'
import RWAAssetTokenABI from './abis/RWAAssetToken.json'
import YieldRouterABI from './abis/YieldRouter.json'
import RWARegistryABI from './abis/RWARegistry.json'
import GovernanceABI from './abis/Governance.json'

export const abis = {
  vault: CollateralVaultABI,
  lendingPool: LendingPoolABI,
  dusd: DUSDABI,
  rwa: RWAAssetTokenABI,
  yieldRouter: YieldRouterABI,
  rwaRegistry: RWARegistryABI,
  governance: GovernanceABI
};
