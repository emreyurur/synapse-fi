// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockAgentRegistry} from "../src/mocks/MockAgentRegistry.sol";
import {ScoreOracle} from "../src/ScoreOracle.sol";
import {InterestRateModel} from "../src/InterestRateModel.sol";
import {CreditPool} from "../src/CreditPool.sol";
import {CreditLineManager} from "../src/CreditLineManager.sol";
import {RevenueRouterFactory} from "../src/RevenueRouterFactory.sol";
import {
    IScoreOracle,
    IInterestRateModel,
    ICreditPool,
    IAgentRegistry,
    IRevenueRouterFactory
} from "../src/interfaces/ISynapseFi.sol";

/// @notice Deploys the full SynapseFi protocol to Arc Testnet and wires roles.
/// Usage:
///   forge script script/Deploy.s.sol --rpc-url arc_testnet --broadcast --verify
/// Env:
///   USDC_ADDRESS  — canonical ERC-20 USDC on the target chain; if unset, a
///                   MockUSDC is deployed (testnet only).
///   ORACLE_UPDATER — address allowed to push scores (defaults to deployer).
contract DeployScript is Script {
    function run() external {
        address deployer = msg.sender;
        address usdcAddr = vm.envOr("USDC_ADDRESS", address(0));
        address updater = vm.envOr("ORACLE_UPDATER", deployer);

        vm.startBroadcast();

        IERC20 usdc = usdcAddr != address(0) ? IERC20(usdcAddr) : IERC20(address(new MockUSDC()));

        ScoreOracle oracle = new ScoreOracle(deployer);
        oracle.setUpdater(updater, true);

        // 2% base, kink at 80% → 10%, 19% at full utilization (bps).
        InterestRateModel rateModel = new InterestRateModel(200, 8000, 1000, 1900);

        CreditPool pool = new CreditPool(usdc, deployer);
        RevenueRouterFactory factory = new RevenueRouterFactory(usdc);
        MockAgentRegistry registry = new MockAgentRegistry(deployer);

        CreditLineManager manager = new CreditLineManager(
            usdc, IScoreOracle(oracle), IInterestRateModel(rateModel), ICreditPool(pool), deployer
        );
        manager.setRegistry(IAgentRegistry(address(registry)));
        manager.setFactory(IRevenueRouterFactory(address(factory)));

        pool.setManager(address(manager));
        factory.setManager(address(manager));
        registry.setPenalizer(address(manager), true);

        vm.stopBroadcast();

        console.log("USDC:               ", address(usdc));
        console.log("ScoreOracle:        ", address(oracle));
        console.log("InterestRateModel:  ", address(rateModel));
        console.log("CreditPool:         ", address(pool));
        console.log("CreditLineManager:  ", address(manager));
        console.log("RevenueRouterFactory:", address(factory));
        console.log("MockAgentRegistry:  ", address(registry));
    }
}
