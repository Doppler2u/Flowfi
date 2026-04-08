// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FlowFi
 * @notice Programmable Payment Hub for Arc Testnet
 * @dev Combines pay-to-access content, usage-based subscriptions, and advanced routing.
 */
contract FlowFi {
    // --- State Variables ---

    /// @dev 1. Balance System
    mapping(address => uint256) public balances;

    /// @dev 2. Pay-to-Access Content
    struct Content {
        address creator;
        uint256 price;
        bool exists;
    }
    
    mapping(uint256 => Content) public contents;
    mapping(address => mapping(uint256 => bool)) public hasAccess;

    /// @dev 3. Advanced Payment Routing
    struct Route {
        address primaryRecipient;
        address secondaryRecipient;
        uint256 splitPercent; // 0 to 100
    }

    // --- Events ---
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event ContentCreated(uint256 indexed contentId, address indexed creator, uint256 price);
    event ContentUnlocked(address indexed user, uint256 indexed contentId);
    event ServiceUsed(address indexed user, uint256 cost);
    event PaymentRouted(address indexed from, address indexed toPrimary, address indexed toSecondary, uint256 amount);

    // --- Custom Errors ---
    error InsufficientBalance();
    error ContentAlreadyExists();
    error ContentDoesNotExist();
    error ContentAlreadyUnlocked();
    error InvalidSplitPercent();
    error TransferFailed();

    // --- Core Logic ---

    /**
     * @notice Deposit native tokens into the hub
     */
    function deposit() external payable {
        require(msg.value > 0, "Zero deposit");
        balances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @notice Withdraw available balance natively
     * @param amount Amount to withdraw
     */
    function withdraw(uint256 amount) external {
        if (balances[msg.sender] < amount) revert InsufficientBalance();
        
        balances[msg.sender] -= amount;
        
        (bool success, ) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();
        
        emit Withdraw(msg.sender, amount);
    }

    /**
     * @notice Create a new pay-to-access content
     * @param id Unique content identifier
     * @param price Cost to unlock
     */
    function createContent(uint256 id, uint256 price) external {
        if (contents[id].exists) revert ContentAlreadyExists();
        
        contents[id] = Content({
            creator: msg.sender,
            price: price,
            exists: true
        });
        
        emit ContentCreated(id, msg.sender, price);
    }

    /**
     * @notice Unlock content using available contract balance
     * @param id Content identifier
     */
    function unlockContent(uint256 id) external {
        Content memory content = contents[id];
        if (!content.exists) revert ContentDoesNotExist();
        if (hasAccess[msg.sender][id]) revert ContentAlreadyUnlocked();
        if (balances[msg.sender] < content.price) revert InsufficientBalance();
        
        // Deduct from user
        balances[msg.sender] -= content.price;
        
        // Credit creator internally
        balances[content.creator] += content.price;
        hasAccess[msg.sender][id] = true;
        
        emit ContentUnlocked(msg.sender, id);
    }

    /**
     * @notice Deduct balance based on arbitrary service usage
     * @param cost Cost of the service usage
     */
    function useService(uint256 cost) external {
        if (balances[msg.sender] < cost) revert InsufficientBalance();
        
        balances[msg.sender] -= cost;
        emit ServiceUsed(msg.sender, cost);
    }

    /**
     * @notice Deduct balance and route payment according to routing rules
     * @param amount Total amount to route
     * @param route The routing instructions
     */
    function routePayment(uint256 amount, Route calldata route) external {
        if (balances[msg.sender] < amount) revert InsufficientBalance();
        
        balances[msg.sender] -= amount;
        _routePayment(amount, route);
    }

    /**
     * @notice Internal logic for conditional payment routing with fallback safety
     * @param amount Total amount to route
     * @param route The routing instructions
     */
    function _routePayment(uint256 amount, Route memory route) internal {
        if (route.splitPercent > 100) revert InvalidSplitPercent();
        
        uint256 primaryAmount = (amount * route.splitPercent) / 100;
        uint256 secondaryAmount = amount - primaryAmount;

        // Try to route to primary recipient
        if (primaryAmount > 0) {
            (bool success, ) = route.primaryRecipient.call{value: primaryAmount}("");
            if (!success) {
                // Fallback: refund sender internally instead of locking
                balances[msg.sender] += primaryAmount;
            }
        }

        // Try to route to secondary recipient
        if (secondaryAmount > 0) {
            (bool success, ) = route.secondaryRecipient.call{value: secondaryAmount}("");
            if (!success) {
                // Fallback: refund sender internally
                balances[msg.sender] += secondaryAmount;
            }
        }

        emit PaymentRouted(msg.sender, route.primaryRecipient, route.secondaryRecipient, amount);
    }
}
