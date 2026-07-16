// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockAgentRegistry} from "../src/mocks/MockAgentRegistry.sol";
import {ScoreOracle} from "../src/ScoreOracle.sol";
import {InterestRateModel} from "../src/InterestRateModel.sol";
import {CreditPool} from "../src/CreditPool.sol";
import {CreditLineManager} from "../src/CreditLineManager.sol";
import {RevenueRouterFactory} from "../src/RevenueRouterFactory.sol";
import {RevenueSplitter} from "../src/RevenueSplitter.sol";
import {
    IScoreOracle,
    IInterestRateModel,
    ICreditPool,
    IAgentRegistry,
    IRevenueRouterFactory
} from "../src/interfaces/ISynapseFi.sol";

/// @notice Deploys the full protocol wired exactly like script/Deploy.s.sol.
abstract contract BaseTest is Test {
    MockUSDC internal usdc;
    ScoreOracle internal oracle;
    InterestRateModel internal rateModel;
    CreditPool internal pool;
    CreditLineManager internal manager;
    RevenueRouterFactory internal factory;
    MockAgentRegistry internal registry;

    address internal admin = makeAddr("admin");
    address internal lp = makeAddr("lp");
    address internal agent = makeAddr("agent");
    address internal treasury = makeAddr("treasury");
    address internal payer = makeAddr("payer");

    uint256 internal constant LP_DEPOSIT = 100_000e6;
    uint16 internal constant AGENT_SCORE = 782;

    function setUp() public virtual {
        vm.startPrank(admin);
        usdc = new MockUSDC();
        oracle = new ScoreOracle(admin);
        oracle.setUpdater(admin, true);
        rateModel = new InterestRateModel(200, 8000, 1000, 1900);
        pool = new CreditPool(usdc, admin);
        factory = new RevenueRouterFactory(usdc);
        registry = new MockAgentRegistry(admin);
        manager = new CreditLineManager(
            usdc,
            IScoreOracle(address(oracle)),
            IInterestRateModel(address(rateModel)),
            ICreditPool(address(pool)),
            admin
        );
        manager.setRegistry(IAgentRegistry(address(registry)));
        manager.setFactory(IRevenueRouterFactory(address(factory)));
        pool.setManager(address(manager));
        factory.setManager(address(manager));
        registry.setPenalizer(address(manager), true);
        vm.stopPrank();

        // Fund the pool with LP capital.
        usdc.mint(lp, 1_000_000e6);
        vm.startPrank(lp);
        usdc.approve(address(pool), type(uint256).max);
        pool.deposit(LP_DEPOSIT, lp);
        vm.stopPrank();

        // Register + score the agent.
        vm.prank(agent);
        registry.register();
        _setScore(AGENT_SCORE);
    }

    function _setScore(uint16 score) internal {
        vm.prank(admin);
        oracle.setScore(agent, score, 1, keccak256("factors"));
    }

    function _openLine() internal returns (RevenueSplitter splitter) {
        vm.prank(agent);
        return RevenueSplitter(manager.openLine(treasury));
    }

    function _draw(uint256 amount) internal {
        vm.prank(agent);
        manager.draw(amount);
    }

    function _repay(address from, uint256 amount) internal returns (uint256 used) {
        usdc.mint(from, amount);
        vm.startPrank(from);
        usdc.approve(address(manager), amount);
        used = manager.repay(agent, amount);
        vm.stopPrank();
    }
}
