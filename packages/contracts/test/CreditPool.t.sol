// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {BaseTest} from "./BaseTest.sol";
import {CreditPool} from "../src/CreditPool.sol";

contract CreditPoolTest is BaseTest {
    function test_DepositMintsShares() public view {
        assertEq(pool.totalAssets(), LP_DEPOSIT);
        assertEq(pool.maxWithdraw(lp), LP_DEPOSIT);
        assertEq(pool.utilizationBps(), 0);
    }

    function test_OnlyManagerCanLendOut() public {
        vm.expectRevert(CreditPool.NotManager.selector);
        pool.lendOut(agent, 1e6);
    }

    function test_LendOutUpdatesUtilization() public {
        vm.prank(address(manager));
        pool.lendOut(treasury, 20_000e6);
        assertEq(pool.totalLent(), 20_000e6);
        assertEq(pool.totalAssets(), LP_DEPOSIT, "lent principal still counts as LP assets");
        assertEq(pool.utilizationBps(), 2000); // 20%
        assertEq(usdc.balanceOf(treasury), 20_000e6);
    }

    function test_LendOutCappedByLiquidity() public {
        vm.prank(address(manager));
        vm.expectRevert(CreditPool.InsufficientLiquidity.selector);
        pool.lendOut(treasury, LP_DEPOSIT + 1);
    }

    function test_RepaymentAccruesYieldAndReserves() public {
        vm.prank(address(manager));
        pool.lendOut(treasury, 10_000e6);

        // Manager sends back 10,000 principal + 500 interest.
        uint256 interest = 500e6;
        usdc.mint(address(manager), 10_000e6 + interest);
        vm.startPrank(address(manager));
        usdc.approve(address(pool), 10_000e6 + interest);
        pool.receiveRepayment(10_000e6, interest);
        vm.stopPrank();

        uint256 expectedReserves = (interest * 1000) / 10_000; // 10%
        assertEq(pool.reserves(), expectedReserves);
        assertEq(pool.totalLent(), 0);
        // LPs own principal + 90% of interest.
        assertEq(pool.totalAssets(), LP_DEPOSIT + interest - expectedReserves);
        assertGt(pool.maxWithdraw(lp), LP_DEPOSIT, "share price increased");
    }

    function test_WithdrawCappedByIdleCash() public {
        vm.prank(address(manager));
        pool.lendOut(treasury, 60_000e6);
        // Only 40k idle; LP owns 100k of assets but can only pull the cash.
        assertEq(pool.maxWithdraw(lp), 40_000e6);
        vm.prank(lp);
        pool.withdraw(40_000e6, lp, lp);
        assertEq(usdc.balanceOf(lp), 1_000_000e6 - LP_DEPOSIT + 40_000e6);
    }

    function test_WithdrawReservesOnlyOwner() public {
        vm.prank(lp);
        vm.expectRevert();
        pool.withdrawReserves(lp, 1);
    }
}
