// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {BaseTest} from "./BaseTest.sol";
import {RevenueSplitter} from "../src/RevenueSplitter.sol";

contract RevenueSplitterTest is BaseTest {
    RevenueSplitter internal splitter;

    function setUp() public override {
        super.setUp();
        splitter = _openLine();
    }

    /// @dev Simulates an ERC-8183 job payout / nanopayment landing at the
    ///      agent's payout address (the splitter).
    function _pay(uint256 amount) internal {
        usdc.mint(address(splitter), amount);
    }

    function test_FlushSplits12to88WhileInDebt() public {
        _draw(10_000e6);
        _pay(100e6);

        (uint256 toPool, uint256 toTreasury) = splitter.flush();
        assertEq(toPool, 12e6, "12% to the credit pool");
        assertEq(toTreasury, 88e6, "88% to the agent treasury");
        assertEq(usdc.balanceOf(treasury), 10_000e6 + 88e6);
        assertEq(manager.totalDebt(agent), 10_000e6 - 12e6);
    }

    function test_FlushSendsEverythingToTreasuryWhenDebtFree() public {
        _pay(50e6);
        (uint256 toPool, uint256 toTreasury) = splitter.flush();
        assertEq(toPool, 0);
        assertEq(toTreasury, 50e6);
        assertEq(usdc.balanceOf(treasury), 50e6);
    }

    function test_FlushLeftoverGoesToTreasuryWhenShareExceedsDebt() public {
        _draw(5e6); // tiny debt
        _pay(100e6); // 12% share = 12e6 > 5e6 debt

        (uint256 toPool, uint256 toTreasury) = splitter.flush();
        assertEq(toPool, 5e6, "capped at the debt");
        assertEq(toTreasury, 95e6, "leftover swept to treasury");
        assertEq(manager.totalDebt(agent), 0);
    }

    function test_FlushSweepsEverythingWhenDelinquent() public {
        _draw(14_000e6);
        _setScore(500); // limit collapses below debt
        manager.poke(agent);
        vm.warp(block.timestamp + 3 days + 1);
        manager.markDelinquent(agent);

        _pay(1_000e6);
        (uint256 toPool, uint256 toTreasury) = splitter.flush();
        assertEq(toPool, 1_000e6, "100% sweep while delinquent");
        assertEq(toTreasury, 0);
    }

    function test_FlushOnEmptyBalanceIsNoop() public {
        (uint256 toPool, uint256 toTreasury) = splitter.flush();
        assertEq(toPool, 0);
        assertEq(toTreasury, 0);
    }

    function test_CannotReinitialize() public {
        vm.expectRevert(RevenueSplitter.AlreadyInitialized.selector);
        splitter.initialize(usdc, agent, address(manager), treasury);
    }

    function testFuzz_FlushConservesFunds(uint256 drawAmount, uint256 payment) public {
        drawAmount = bound(drawAmount, 1e6, 14_000e6);
        payment = bound(payment, 1, 1_000_000e6);

        _draw(drawAmount);
        uint256 treasuryBefore = usdc.balanceOf(treasury);
        _pay(payment);

        (uint256 toPool, uint256 toTreasury) = splitter.flush();
        assertEq(toPool + toTreasury, payment, "nothing lost or stuck");
        assertEq(usdc.balanceOf(address(splitter)), 0, "splitter fully drained");
        assertEq(usdc.balanceOf(treasury), treasuryBefore + toTreasury);
    }
}
