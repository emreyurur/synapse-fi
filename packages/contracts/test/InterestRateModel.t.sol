// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {InterestRateModel} from "../src/InterestRateModel.sol";

contract InterestRateModelTest is Test {
    InterestRateModel internal model;

    function setUp() public {
        model = new InterestRateModel(200, 8000, 1000, 1900);
    }

    function test_KnownPoints() public view {
        assertEq(model.aprBps(0), 200, "base");
        assertEq(model.aprBps(4000), 600, "midpoint below kink");
        assertEq(model.aprBps(8000), 1000, "at kink");
        assertEq(model.aprBps(10_000), 1900, "full utilization");
        // Prototype reference point: 71.3% utilization -> ~9.13% APR.
        assertApproxEqAbs(model.aprBps(7130), 913, 1, "prototype point");
    }

    function test_ClampsAboveFullUtilization() public view {
        assertEq(model.aprBps(15_000), 1900);
    }

    function testFuzz_MonotonicallyIncreasing(uint256 a, uint256 b) public view {
        a = bound(a, 0, 10_000);
        b = bound(b, a, 10_000);
        assertLe(model.aprBps(a), model.aprBps(b));
    }

    function test_RevertsOnInvalidParams() public {
        vm.expectRevert(InterestRateModel.InvalidParams.selector);
        new InterestRateModel(200, 0, 1000, 1900); // zero kink
        vm.expectRevert(InterestRateModel.InvalidParams.selector);
        new InterestRateModel(1200, 8000, 1000, 1900); // base > atKink
        vm.expectRevert(InterestRateModel.InvalidParams.selector);
        new InterestRateModel(200, 8000, 1000, 900); // max < atKink
    }
}
