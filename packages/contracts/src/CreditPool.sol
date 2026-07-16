// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626, IERC20} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ICreditPool} from "./interfaces/ISynapseFi.sol";

/// @title CreditPool
/// @notice ERC-4626 USDC vault (spUSDC). LP deposits fund uncollateralized
///         credit lines opened by the CreditLineManager. Interest repayments
///         accrue to LPs; `reserveFactorBps` of interest is set aside as
///         protocol reserves (first-loss buffer, excluded from share price).
contract CreditPool is ERC4626, Ownable, ICreditPool {
    using SafeERC20 for IERC20;

    address public manager;
    /// @notice Principal currently lent out to agents.
    uint256 public totalLent;
    /// @notice Protocol reserves held in this contract, excluded from totalAssets.
    uint256 public reserves;
    uint16 public reserveFactorBps = 1000; // 10%

    uint256 internal constant BPS = 10_000;

    event ManagerSet(address indexed manager);
    event LentOut(address indexed to, uint256 amount);
    event RepaymentReceived(uint256 principal, uint256 interest, uint256 toReserves);
    event ReserveFactorSet(uint16 reserveFactorBps);
    event ReservesWithdrawn(address indexed to, uint256 amount);

    error NotManager();
    error InsufficientLiquidity();
    error InvalidReserveFactor();

    modifier onlyManager() {
        if (msg.sender != manager) revert NotManager();
        _;
    }

    constructor(IERC20 asset_, address initialOwner)
        ERC4626(asset_)
        ERC20("SynapseFi Pool USDC", "spUSDC")
        Ownable(initialOwner)
    {}

    // ── Admin ────────────────────────────────────────────────

    function setManager(address manager_) external onlyOwner {
        manager = manager_;
        emit ManagerSet(manager_);
    }

    function setReserveFactor(uint16 bps) external onlyOwner {
        if (bps > BPS) revert InvalidReserveFactor();
        reserveFactorBps = bps;
        emit ReserveFactorSet(bps);
    }

    function withdrawReserves(address to, uint256 amount) external onlyOwner {
        reserves -= amount;
        IERC20(asset()).safeTransfer(to, amount);
        emit ReservesWithdrawn(to, amount);
    }

    // ── Manager hooks ────────────────────────────────────────

    /// @inheritdoc ICreditPool
    function lendOut(address to, uint256 amount) external onlyManager {
        if (amount > availableLiquidity()) revert InsufficientLiquidity();
        totalLent += amount;
        IERC20(asset()).safeTransfer(to, amount);
        emit LentOut(to, amount);
    }

    /// @inheritdoc ICreditPool
    /// @dev Pulls `principal + interest` from the manager (which must approve).
    function receiveRepayment(uint256 principal, uint256 interest) external onlyManager {
        IERC20(asset()).safeTransferFrom(msg.sender, address(this), principal + interest);
        totalLent -= principal;
        uint256 toReserves = (interest * reserveFactorBps) / BPS;
        reserves += toReserves;
        emit RepaymentReceived(principal, interest, toReserves);
    }

    // ── Views / ERC-4626 overrides ───────────────────────────

    /// @notice Idle cash available for new draws or LP withdrawals.
    function availableLiquidity() public view returns (uint256) {
        return IERC20(asset()).balanceOf(address(this)) - reserves;
    }

    /// @dev LP-owned assets: idle cash + lent principal, excluding reserves.
    function totalAssets() public view override returns (uint256) {
        return availableLiquidity() + totalLent;
    }

    /// @inheritdoc ICreditPool
    function utilizationBps() public view returns (uint256) {
        uint256 total = totalAssets();
        return total == 0 ? 0 : (totalLent * BPS) / total;
    }

    /// @dev Withdrawals are capped by idle cash (lent principal is illiquid).
    function maxWithdraw(address owner_) public view override returns (uint256) {
        uint256 base = super.maxWithdraw(owner_);
        uint256 cash = availableLiquidity();
        return base < cash ? base : cash;
    }

    function maxRedeem(address owner_) public view override returns (uint256) {
        uint256 base = super.maxRedeem(owner_);
        uint256 cashShares = _convertToShares(availableLiquidity(), Math.Rounding.Floor);
        return base < cashShares ? base : cashShares;
    }

    /// @dev Mitigates ERC-4626 inflation attacks on an empty vault.
    function _decimalsOffset() internal pure override returns (uint8) {
        return 3;
    }
}
