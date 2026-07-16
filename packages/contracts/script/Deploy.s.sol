// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {Counter} from "../src/Counter.sol";

/// @notice Faz 0 smoke deploy: proves the toolchain can reach Arc Testnet.
/// Usage:
///   forge script script/Deploy.s.sol --rpc-url arc_testnet --broadcast
/// Replaced in Faz 1 by the real protocol deploy (ScoreOracle, CreditPool, ...).
contract DeployScript is Script {
    function run() external {
        vm.startBroadcast();
        Counter counter = new Counter();
        console.log("Counter deployed at:", address(counter));
        vm.stopBroadcast();
    }
}
