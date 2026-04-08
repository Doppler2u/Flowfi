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
    }

    function testDepositAndWithdraw() public {
        vm.startPrank(alice);
        flowFi.deposit{value: 100}();
        assertEq(flowFi.balances(alice), 100);

        flowFi.withdraw(40);
        assertEq(flowFi.balances(alice), 60);
        vm.stopPrank();
    }

    function testDepositZero() public {
        vm.startPrank(alice);
        vm.expectRevert("Zero deposit");
        flowFi.deposit{value: 0}();
        vm.stopPrank();
    }

    function testWithdrawInsufficient() public {
        vm.startPrank(alice);
        flowFi.deposit{value: 50}();
        vm.expectRevert(FlowFi.InsufficientBalance.selector);
        flowFi.withdraw(100);
        vm.stopPrank();
    }

    function testContentCreationAndUnlock() public {
        vm.prank(bob);
        flowFi.createContent(1, 20);

        (address creator, uint256 price, bool exists) = flowFi.contents(1);
        assertEq(creator, bob);
        assertEq(price, 20);
        assertTrue(exists);

        vm.startPrank(alice);
        flowFi.deposit{value: 50}();
        flowFi.unlockContent(1);
        
        assertTrue(flowFi.hasAccess(alice, 1));
        assertEq(flowFi.balances(alice), 30);
        vm.stopPrank();
        
        assertEq(flowFi.balances(bob), 20); // bob as creator should get credited
    }

    function testUnlockAlreadyUnlocked() public {
        vm.prank(bob);
        flowFi.createContent(1, 20);

        vm.startPrank(alice);
        flowFi.deposit{value: 50}();
        flowFi.unlockContent(1);
        
        vm.expectRevert(FlowFi.ContentAlreadyUnlocked.selector);
        flowFi.unlockContent(1);
        vm.stopPrank();
    }

    function testUnlockNonExistent() public {
        vm.startPrank(alice);
        flowFi.deposit{value: 50}();
        vm.expectRevert(FlowFi.ContentDoesNotExist.selector);
        flowFi.unlockContent(99);
        vm.stopPrank();
    }

    function testUseService() public {
        vm.startPrank(alice);
        flowFi.deposit{value: 100}();
        flowFi.useService(30);
        assertEq(flowFi.balances(alice), 70);
        vm.stopPrank();
    }

    function testUseServiceInsufficient() public {
        vm.startPrank(alice);
        flowFi.deposit{value: 20}();
        vm.expectRevert(FlowFi.InsufficientBalance.selector);
        flowFi.useService(30);
        vm.stopPrank();
    }

    function testRoutePayment() public {
        vm.startPrank(alice);
        flowFi.deposit{value: 100}();
        
        FlowFi.Route memory route = FlowFi.Route({
            primaryRecipient: bob,
            secondaryRecipient: charlie,
            splitPercent: 80
        });

        uint256 bobPre = bob.balance;
        uint256 charliePre = charlie.balance;

        flowFi.routePayment(100, route);

        assertEq(flowFi.balances(alice), 0);
        assertEq(bob.balance - bobPre, 80);
        assertEq(charlie.balance - charliePre, 20);
        vm.stopPrank();
    }

    function testRoutePaymentInvalidSplit() public {
        vm.startPrank(alice);
        flowFi.deposit{value: 100}();
        
        FlowFi.Route memory route = FlowFi.Route({
            primaryRecipient: bob,
            secondaryRecipient: charlie,
            splitPercent: 110 // invalid
        });

        vm.expectRevert(FlowFi.InvalidSplitPercent.selector);
        flowFi.routePayment(100, route);
        vm.stopPrank();
    }

    function testRoutePaymentFallback() public {
        // Create a contract that rejects ETH/native transfers to test fallback
        RejectingRecipient rejector = new RejectingRecipient();
        
        vm.startPrank(alice);
        flowFi.deposit{value: 100}();
        
        FlowFi.Route memory route = FlowFi.Route({
            primaryRecipient: address(rejector),
            secondaryRecipient: charlie,
            splitPercent: 80
        });

        flowFi.routePayment(100, route); // 80 to primary, 20 to charlie

        // The 80 to primary should fail and fallback to alice's balance
        assertEq(flowFi.balances(alice), 80);
        assertEq(address(rejector).balance, 0);
        vm.stopPrank();
    }
}

contract RejectingRecipient {
    // Has no receive() or fallback(), so native transfers to it will revert
}
