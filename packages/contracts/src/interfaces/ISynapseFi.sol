// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IScoreOracle {
    function getScore(address agent) external view returns (uint16 score, bool fresh);
}

interface IInterestRateModel {
    function aprBps(uint256 utilizationBps) external view returns (uint256);
}

interface ICreditPool {
    function utilizationBps() external view returns (uint256);
    function lendOut(address to, uint256 amount) external;
    function receiveRepayment(uint256 principal, uint256 interest) external;
}

interface ICreditLineManager {
    function revenueShareBps(address agent) external view returns (uint256);
    function repay(address agent, uint256 amount) external returns (uint256 used);
}

interface IAgentRegistry {
    function penalize(address agent, uint256 amount) external;
}

interface IRevenueRouterFactory {
    function createSplitter(address agent, address treasury) external returns (address);
}
