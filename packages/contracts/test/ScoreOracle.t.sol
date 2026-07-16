// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {ScoreOracle} from "../src/ScoreOracle.sol";

contract ScoreOracleTest is Test {
    ScoreOracle internal oracle;
    address internal admin = makeAddr("admin");
    address internal updater = makeAddr("updater");
    address internal agent = makeAddr("agent");

    function setUp() public {
        oracle = new ScoreOracle(admin);
        vm.prank(admin);
        oracle.setUpdater(updater, true);
    }

    function test_SetAndGetScore() public {
        vm.prank(updater);
        oracle.setScore(agent, 782, 1204, keccak256("factors"));
        (uint16 score, bool fresh) = oracle.getScore(agent);
        assertEq(score, 782);
        assertTrue(fresh);
    }

    function test_ScoreGoesStale() public {
        vm.prank(updater);
        oracle.setScore(agent, 782, 1204, keccak256("factors"));
        vm.warp(block.timestamp + 1 days + 1);
        (, bool fresh) = oracle.getScore(agent);
        assertFalse(fresh);
    }

    function test_UnknownAgentIsNotFresh() public view {
        (uint16 score, bool fresh) = oracle.getScore(agent);
        assertEq(score, 0);
        assertFalse(fresh);
    }

    function test_OnlyUpdaterCanWrite() public {
        vm.expectRevert(ScoreOracle.NotUpdater.selector);
        oracle.setScore(agent, 500, 1, bytes32(0));
    }

    function test_RejectsOutOfRangeScore() public {
        vm.prank(updater);
        vm.expectRevert(ScoreOracle.ScoreOutOfRange.selector);
        oracle.setScore(agent, 1001, 1, bytes32(0));
    }

    function test_BatchWrite() public {
        address[] memory agents = new address[](2);
        agents[0] = agent;
        agents[1] = makeAddr("agent2");
        uint16[] memory scores = new uint16[](2);
        scores[0] = 700;
        scores[1] = 650;
        bytes32[] memory hashes = new bytes32[](2);

        vm.prank(updater);
        oracle.setScores(agents, scores, 7, hashes);
        (uint16 s1,) = oracle.getScore(agents[1]);
        assertEq(s1, 650);
    }
}
