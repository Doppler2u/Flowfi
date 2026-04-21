// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {FlowFi} from "../src/FlowFi.sol";

contract FlowFiTest is Test {
    FlowFi public flowFi;

    address alice = address(0x111);
    address bob = address(0x222);
    address charlie = address(0x333);

    function setUp() public {
        flowFi = new FlowFi();
        vm.deal(alice, 1000 ether);
        vm.deal(bob, 1000 ether);
        vm.deal(charlie, 1000 ether);
    }

    function testDepositAndWithdraw() public {
        vm.startPrank(alice);
        flowFi.deposit{value: 100 ether}();
        assertEq(flowFi.balances(alice), 100 ether);

        flowFi.withdraw(40 ether);
        assertEq(flowFi.balances(alice), 60 ether);
        vm.stopPrank();
    }

    function testStaking() public {
        vm.startPrank(bob);
        flowFi.stake{value: 5 ether}();
        assertEq(flowFi.stakedBalances(bob), 5 ether);
        
        flowFi.unstake(2 ether);
        assertEq(flowFi.stakedBalances(bob), 3 ether);
        vm.stopPrank();
    }

    function testContentCreationAndUnlock() public {
        // Bob stakes 5 USDC to be able to create content
        vm.startPrank(bob);
        flowFi.stake{value: 5 ether}();
        flowFi.createContent(1, 20 ether, "ipfs://test");
        vm.stopPrank();

        (address creator, uint256 price, string memory uri, bool exists) = flowFi.contents(1);
        assertEq(creator, bob);
        assertEq(price, 20 ether);
        assertEq(uri, "ipfs://test");
        assertTrue(exists);

        // Alice deposits money to buy content
        vm.startPrank(alice);
        flowFi.deposit{value: 50 ether}();
        flowFi.unlockContent(1);
        
        // Verify NFT ownership
        assertEq(flowFi.balanceOf(alice, 1), 1);
        
        // Alice balance: 50 - 20 = 30
        assertEq(flowFi.balances(alice), 30 ether);
        vm.stopPrank();
        
        // Fee recipient (contract owner/deployer) gets the 2.5% fee
        // Price = 20, Fee = 20 * 0.025 = 0.5
        // Creator gets 19.5
        address owner = flowFi.owner();
        assertEq(flowFi.balances(owner), 0.5 ether);
        
        // Bob payout is in ESCROW, not balances yet
        assertEq(flowFi.balances(bob), 0);
        
        // Check Payout in escrow
        (address pCreator, uint256 pAmount, uint256 pRelease, bool pDisp, bool pRes) = flowFi.contentPayouts(1, 0);
        assertEq(pCreator, bob);
        assertEq(pAmount, 19.5 ether);
        assertTrue(pRelease > block.timestamp);
        assertFalse(pDisp);
        assertFalse(pRes);
    }

    function testDisputeAndResolution() public {
        // Setup content
        vm.prank(bob);
        flowFi.stake{value: 5 ether}();
        vm.prank(bob);
        flowFi.createContent(1, 20 ether, "ipfs://test");

        // Alice buys
        vm.prank(alice);
        flowFi.deposit{value: 50 ether}();
        vm.prank(alice);
        flowFi.unlockContent(1);

        // Alice disputes (requires 2 ether deposit)
        vm.startPrank(alice);
        flowFi.dispute{value: 2 ether}(1, 0);
        
        // Correctly destructure Payout struct (5 components)
        {
            (,,,bool isDisputed,) = flowFi.contentPayouts(1, 0);
            assertTrue(isDisputed);
        }
        vm.stopPrank();

        // Admin resolves in favor of buyer (refund)
        address owner = flowFi.owner();
        vm.prank(owner);
        flowFi.resolveDispute(1, 0, true, alice);

        // Alice gets back her purchase price (effectively but p.amount is creator share)
        // Wait, in my resolveDispute: balances[buyer] += (p.amount + DISPUTE_DEPOSIT);
        // p.amount is 19.5. Dispute deposit was 2. Total = 21.5. 
        // Note: the 0.5 fee remains with platform (or could be refunded, but current code keeps it simple).
        
        assertEq(flowFi.balances(alice), 30 ether + 21.5 ether);
    }

    function testReleasePayout() public {
        vm.prank(bob);
        flowFi.stake{value: 5 ether}();
        vm.prank(bob);
        flowFi.createContent(1, 20 ether, "ipfs://test");

        vm.prank(alice);
        flowFi.deposit{value: 50 ether}();
        vm.prank(alice);
        flowFi.unlockContent(1);

        // Warp time past 24 hours
        vm.warp(block.timestamp + 25 hours);

        flowFi.releasePayout(1, 0);
        assertEq(flowFi.balances(bob), 19.5 ether);
    }
}
