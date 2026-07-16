// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {BaseTest} from "./BaseTest.sol";
import {CreditLineManager} from "../src/CreditLineManager.sol";

contract CreditLineManagerTest is BaseTest {
    function test_OpenLineCreatesSplitterAndLimit() public {
        address splitter = address(_openLine());
        assertTrue(splitter != address(0));
        assertEq(factory.splitterOf(agent), splitter);
        // limit = (782 - 500) * 50 USDC = 14,100 USDC
        assertEq(manager.creditLimit(agent), 14_100e6);
    }

    function test_OpenLineRejectsLowOrStaleScore() public {
        _setScore(450);
        vm.prank(agent);
        vm.expectRevert(CreditLineManager.ScoreTooLowOrStale.selector);
        manager.openLine(treasury);

        _setScore(782);
        vm.warp(block.timestamp + 2 days); // score goes stale
        vm.prank(agent);
        vm.expectRevert(CreditLineManager.ScoreTooLowOrStale.selector);
        manager.openLine(treasury);
    }

    function test_DrawSendsFundsToTreasury() public {
        _openLine();
        _draw(7_800e6);
        assertEq(usdc.balanceOf(treasury), 7_800e6);
        assertEq(manager.totalDebt(agent), 7_800e6);
        assertEq(pool.utilizationBps(), 780); // 7.8%
    }

    function test_DrawRejectsAboveLimit() public {
        _openLine();
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(CreditLineManager.ExceedsLimit.selector, 14_100e6 + 1, 14_100e6));
        manager.draw(14_100e6 + 1);
    }

    function test_InterestAccruesOverTime() public {
        _openLine();
        _draw(10_000e6);
        // APR snapshot after draw: utilization 10% -> 200 + 800*1000/8000 = 300 bps.
        vm.warp(block.timestamp + 365 days);
        uint256 debt = manager.totalDebt(agent);
        assertApproxEqRel(debt, 10_300e6, 0.001e18, "one year of 3% APR");
    }

    function test_RepayInterestFirstThenPrincipal() public {
        _openLine();
        _draw(10_000e6);
        vm.warp(block.timestamp + 365 days);

        uint256 debtBefore = manager.totalDebt(agent);
        uint256 used = _repay(payer, 5_000e6);
        assertEq(used, 5_000e6);
        assertApproxEqAbs(manager.totalDebt(agent), debtBefore - 5_000e6, 1);
        // Interest (~300e6) went to the pool: reserves got 10% of it.
        assertGt(pool.reserves(), 0);
    }

    function test_OverpaymentOnlyPullsDebt() public {
        _openLine();
        _draw(1_000e6);
        uint256 used = _repay(payer, 5_000e6);
        assertEq(used, 1_000e6, "only the debt is pulled");
        assertEq(usdc.balanceOf(payer), 4_000e6, "rest stays with payer");
        assertEq(manager.totalDebt(agent), 0);
    }

    function test_FullRepaymentRestoresPoolAndAllowsClose() public {
        _openLine();
        _draw(10_000e6);
        vm.warp(block.timestamp + 30 days);
        _repay(payer, 20_000e6);
        assertEq(manager.totalDebt(agent), 0);
        assertEq(pool.totalLent(), 0);

        vm.prank(agent);
        manager.closeLine();
        // A closed line can be re-opened.
        _setScore(AGENT_SCORE);
        vm.prank(agent);
        address splitter = manager.openLine(treasury);
        assertEq(splitter, factory.splitterOf(agent), "splitter reused");
    }

    function test_DelinquencyFlow() public {
        _openLine();
        _draw(14_000e6); // near the 14,100 limit

        // Score collapses -> limit collapses -> breach starts on next accrual.
        _setScore(500);
        manager.poke(agent);

        // Cannot mark before the grace period ends.
        vm.expectRevert(CreditLineManager.NotDelinquent.selector);
        manager.markDelinquent(agent);

        vm.warp(block.timestamp + 3 days + 1);
        manager.markDelinquent(agent);

        (, uint256 reputation,) = registry.agents(agent);
        assertEq(reputation, 300, "500 - 200 default penalty");
        assertEq(manager.revenueShareBps(agent), 10_000, "full revenue sweep");

        // Paying the debt back restores the line.
        _repay(payer, 20_000e6);
        assertEq(manager.totalDebt(agent), 0);
        assertEq(manager.revenueShareBps(agent), 0);
    }

    function test_RevenueShareLifecycle() public {
        _openLine();
        assertEq(manager.revenueShareBps(agent), 0, "no debt, no share");
        _draw(1_000e6);
        assertEq(manager.revenueShareBps(agent), 1200, "12% while in debt");
        _repay(payer, 1_000e6);
        assertEq(manager.revenueShareBps(agent), 0, "debt cleared");
    }

    function testFuzz_RepayNeverPullsMoreThanDebt(uint256 drawAmount, uint256 repayAmount, uint256 dt) public {
        drawAmount = bound(drawAmount, 1e6, 14_000e6);
        repayAmount = bound(repayAmount, 1, 50_000e6);
        dt = bound(dt, 0, 180 days);

        _openLine();
        _draw(drawAmount);
        vm.warp(block.timestamp + dt);

        uint256 debtBefore = manager.totalDebt(agent);
        uint256 used = _repay(payer, repayAmount);

        assertLe(used, debtBefore, "never pulls more than debt");
        assertLe(used, repayAmount, "never pulls more than offered");
        assertApproxEqAbs(manager.totalDebt(agent), debtBefore - used, 1);
    }
}
