// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {RevenueSplitter} from "./RevenueSplitter.sol";
import {IRevenueRouterFactory} from "./interfaces/ISynapseFi.sol";

/// @title RevenueRouterFactory
/// @notice Deploys one RevenueSplitter clone per agent (EIP-1167). The clone
///         address becomes the agent's payout address for all revenue.
contract RevenueRouterFactory is IRevenueRouterFactory {
    IERC20 public immutable asset;
    address public immutable implementation;
    address public manager;

    mapping(address agent => address splitter) public splitterOf;

    event SplitterCreated(address indexed agent, address indexed splitter, address indexed treasury);
    event ManagerSet(address manager);

    error NotManager();
    error ManagerAlreadySet();

    constructor(IERC20 asset_) {
        asset = asset_;
        implementation = address(new RevenueSplitter());
    }

    /// @notice One-time wiring; called during deployment.
    function setManager(address manager_) external {
        if (manager != address(0)) revert ManagerAlreadySet();
        manager = manager_;
        emit ManagerSet(manager_);
    }

    /// @inheritdoc IRevenueRouterFactory
    function createSplitter(address agent, address treasury) external returns (address splitter) {
        if (msg.sender != manager) revert NotManager();
        splitter = splitterOf[agent];
        if (splitter != address(0)) return splitter; // reuse across re-opened lines

        splitter = Clones.clone(implementation);
        RevenueSplitter(splitter).initialize(asset, agent, manager, treasury);
        splitterOf[agent] = splitter;
        emit SplitterCreated(agent, splitter, treasury);
    }
}
