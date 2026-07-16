// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IInterestRateModel} from "./interfaces/ISynapseFi.sol";

/// @title InterestRateModel
/// @notice Kinked utilization curve: `baseAprBps` at 0%, `aprAtKinkBps` at the
///         kink, `maxAprBps` at 100% utilization. Mirrored in
///         packages/shared/src/index.ts (RATE_MODEL) for the frontend.
contract InterestRateModel is IInterestRateModel {
    uint256 public immutable baseAprBps;
    uint256 public immutable kinkUtilizationBps;
    uint256 public immutable aprAtKinkBps;
    uint256 public immutable maxAprBps;

    uint256 internal constant BPS = 10_000;

    error InvalidParams();

    constructor(uint256 base_, uint256 kinkUtil_, uint256 atKink_, uint256 max_) {
        if (kinkUtil_ == 0 || kinkUtil_ >= BPS || atKink_ < base_ || max_ < atKink_) revert InvalidParams();
        baseAprBps = base_;
        kinkUtilizationBps = kinkUtil_;
        aprAtKinkBps = atKink_;
        maxAprBps = max_;
    }

    /// @inheritdoc IInterestRateModel
    function aprBps(uint256 utilizationBps) public view returns (uint256) {
        uint256 u = utilizationBps > BPS ? BPS : utilizationBps;
        if (u <= kinkUtilizationBps) {
            return baseAprBps + ((aprAtKinkBps - baseAprBps) * u) / kinkUtilizationBps;
        }
        return aprAtKinkBps + ((maxAprBps - aprAtKinkBps) * (u - kinkUtilizationBps)) / (BPS - kinkUtilizationBps);
    }
}
