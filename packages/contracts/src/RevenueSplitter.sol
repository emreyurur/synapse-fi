// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ICreditLineManager} from "./interfaces/ISynapseFi.sol";

/// @title RevenueSplitter
/// @notice The agent's payout address. ERC-8183 job payouts and nanopayments
///         land here as plain USDC transfers; `flush()` (callable by anyone —
///         keeper, payer, or the agent itself) splits the balance:
///         repayment share → CreditLineManager → CreditPool, rest → treasury.
///         When the debt is fully repaid the share drops to 0 automatically;
///         when the agent is delinquent it rises to 100%.
/// @dev Deployed as an EIP-1167 minimal proxy clone per agent.
contract RevenueSplitter {
    using SafeERC20 for IERC20;

    IERC20 public asset;
    address public agent;
    address public manager;
    address public treasury;
    bool private _initialized;

    uint256 internal constant BPS = 10_000;

    event Initialized(address indexed agent, address indexed manager, address indexed treasury);
    event Flushed(uint256 toPool, uint256 toTreasury);

    error AlreadyInitialized();
    error ZeroAddress();

    function initialize(IERC20 asset_, address agent_, address manager_, address treasury_) external {
        if (_initialized) revert AlreadyInitialized();
        if (agent_ == address(0) || manager_ == address(0) || treasury_ == address(0)) revert ZeroAddress();
        _initialized = true;
        asset = asset_;
        agent = agent_;
        manager = manager_;
        treasury = treasury_;
        emit Initialized(agent_, manager_, treasury_);
    }

    /// @notice Splits the accumulated revenue. Callable by anyone.
    function flush() external returns (uint256 toPool, uint256 toTreasury) {
        uint256 balance = asset.balanceOf(address(this));
        if (balance == 0) return (0, 0);

        uint256 shareBps = ICreditLineManager(manager).revenueShareBps(agent);
        uint256 repayTarget = (balance * shareBps) / BPS;

        if (repayTarget > 0) {
            asset.forceApprove(manager, repayTarget);
            toPool = ICreditLineManager(manager).repay(agent, repayTarget);
            asset.forceApprove(manager, 0);
        }

        toTreasury = asset.balanceOf(address(this));
        if (toTreasury > 0) {
            asset.safeTransfer(treasury, toTreasury);
        }
        emit Flushed(toPool, toTreasury);
    }
}
