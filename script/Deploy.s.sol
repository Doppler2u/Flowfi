// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {FlowFi} from "../src/FlowFi.sol";

contract DeployFlowFi is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Start broadcasting transactions using the specified private key
        vm.startBroadcast(deployerPrivateKey);

        FlowFi flowFi = new FlowFi();
        console.log("FlowFi deployed to:", address(flowFi));

        vm.stopBroadcast();
    }
}
