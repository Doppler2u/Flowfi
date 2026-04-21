// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title FlowFi
 * @notice Production-Ready Programmable Payment Hub for Arc Testnet
 * @dev Implements IPFS metadata, ERC1155 access tokens, Escrowed payouts, and Dispute resolution.
 */
contract FlowFi is ERC1155, Ownable, ReentrancyGuard {
    // --- Constants ---
    uint256 public constant MIN_CREATOR_STAKE = 5 ether; // 5 USDC (18 decimals on Arc)
    uint256 public constant DISPUTE_DEPOSIT = 2 ether;    // 2 USDC
    uint256 public constant PAYOUT_WINDOW = 24 hours;
    uint256 public constant BPS_DENOMINATOR = 10000;

    // --- State Variables ---
    uint256 public platformFeeBps = 250; // 2.50%
    address public feeRecipient;

    struct Content {
        address creator;
        uint256 price;
        string metadataURI;
        bool exists;
    }

    struct Payout {
        address creator;
        uint256 amount;
        uint256 releaseTime;
        bool isDisputed;
        bool resolved;
    }

    mapping(uint256 => Content) public contents;
    mapping(uint256 => Payout[]) public contentPayouts; // contentId => array of pending payouts
    mapping(address => uint256) public balances;
    mapping(address => uint256) public stakedBalances;

    // --- Events ---
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event ContentCreated(uint256 indexed contentId, address indexed creator, uint256 price, string metadataURI);
    event UnlockInitiated(address indexed user, uint256 indexed contentId, uint256 payoutIndex);
    event DisputeRaised(uint256 indexed contentId, uint256 payoutIndex, address indexed reporter);
    event DisputeResolved(uint256 indexed contentId, uint256 payoutIndex, bool refunded);
    event PayoutReleased(uint256 indexed contentId, uint256 payoutIndex, address indexed creator, uint256 amount);

    // --- Custom Errors ---
    error InsufficientBalance();
    error ContentAlreadyExists();
    error ContentDoesNotExist();
    error InsufficientStake();
    error InvalidSplitPercent();
    error TransferFailed();
    error AlreadyUnlocked();
    error PayoutLocked();
    error AlreadyResolved();
    error Unauthorized();

    constructor() ERC1155("") Ownable(msg.sender) {
        feeRecipient = msg.sender;
    }

    // --- Core Logic ---

    function deposit() external payable {
        if (msg.value == 0) revert("Zero deposit");
        balances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external nonReentrant {
        if (balances[msg.sender] < amount) revert InsufficientBalance();
        balances[msg.sender] -= amount;
        (bool success, ) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();
        emit Withdraw(msg.sender, amount);
    }

    /**
     * @notice Creators must stake USDC to list content (Skin in the game)
     */
    function stake() external payable {
        stakedBalances[msg.sender] += msg.value;
        emit Staked(msg.sender, msg.value);
    }

    function unstake(uint256 amount) external nonReentrant {
        if (stakedBalances[msg.sender] < amount) revert InsufficientBalance();
        stakedBalances[msg.sender] -= amount;
        (bool success, ) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();
        emit Unstaked(msg.sender, amount);
    }

    /**
     * @notice Create content with IPFS metadata
     */
    function createContent(uint256 id, uint256 price, string calldata metadataURI) external {
        if (contents[id].exists) revert ContentAlreadyExists();
        if (stakedBalances[msg.sender] < MIN_CREATOR_STAKE) revert InsufficientStake();

        contents[id] = Content({
            creator: msg.sender,
            price: price,
            metadataURI: metadataURI,
            exists: true
        });

        emit ContentCreated(id, msg.sender, price, metadataURI);
    }

    /**
     * @notice Unlock content: Funds go to Escrow for 24h
     */
    function unlockContent(uint256 id) external nonReentrant {
        Content storage content = contents[id];
        if (!content.exists) revert ContentDoesNotExist();
        if (balanceOf(msg.sender, id) > 0) revert AlreadyUnlocked();
        if (balances[msg.sender] < content.price) revert InsufficientBalance();

        uint256 price = content.price;
        balances[msg.sender] -= price;

        // Calculate platform fee
        uint256 fee = (price * platformFeeBps) / BPS_DENOMINATOR;
        uint256 creatorAmount = price - fee;

        if (fee > 0) {
            balances[feeRecipient] += fee;
        }

        // Create Payout in Escrow
        uint256 payoutIndex = contentPayouts[id].length;
        contentPayouts[id].push(Payout({
            creator: content.creator,
            amount: creatorAmount,
            releaseTime: block.timestamp + PAYOUT_WINDOW,
            isDisputed: false,
            resolved: false
        }));

        // Mint access NFT
        _mint(msg.sender, id, 1, "");

        emit UnlockInitiated(msg.sender, id, payoutIndex);
    }

    /**
     * @notice Raise a dispute if content is fraudulent
     * @param id Content ID
     * @param payoutIndex The specific purchase index
     */
    function dispute(uint256 id, uint256 payoutIndex) external payable {
        if (msg.value < DISPUTE_DEPOSIT) revert InsufficientBalance();
        if (payoutIndex >= contentPayouts[id].length) revert ContentDoesNotExist();
        
        Payout storage p = contentPayouts[id][payoutIndex];
        if (p.resolved) revert AlreadyResolved();
        
        p.isDisputed = true;
        emit DisputeRaised(id, payoutIndex, msg.sender);
    }

    /**
     * @notice Release funds to creator after window expires
     */
    function releasePayout(uint256 id, uint256 payoutIndex) external nonReentrant {
        Payout storage p = contentPayouts[id][payoutIndex];
        if (block.timestamp < p.releaseTime) revert PayoutLocked();
        if (p.isDisputed) revert PayoutLocked();
        if (p.resolved) revert AlreadyResolved();

        p.resolved = true;
        balances[p.creator] += p.amount;

        emit PayoutReleased(id, payoutIndex, p.creator, p.amount);
    }

    /**
     * @notice Admin resolves a dispute (Phase 1 manual arbitration)
     */
    function resolveDispute(uint256 id, uint256 payoutIndex, bool refundBuyer, address buyer) external onlyOwner {
        Payout storage p = contentPayouts[id][payoutIndex];
        if (!p.isDisputed) revert Unauthorized();
        if (p.resolved) revert AlreadyResolved();

        p.resolved = true;
        
        if (refundBuyer) {
            // Refund price to buyer + their dispute deposit
            balances[buyer] += (p.amount + DISPUTE_DEPOSIT);
            // Optionally slash creator stake here if blatant fraud
        } else {
            // Favor creator: send payout to creator + platform takes dispute deposit
            balances[p.creator] += p.amount;
            balances[feeRecipient] += DISPUTE_DEPOSIT;
        }

        emit DisputeResolved(id, payoutIndex, refundBuyer);
    }

    // --- Admin Functions ---

    function setPlatformFee(uint256 newBps) external onlyOwner {
        if (newBps > 1000) revert InvalidSplitPercent(); // Cap at 10%
        platformFeeBps = newBps;
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        feeRecipient = newRecipient;
    }

    function uri(uint256 id) public view override returns (string memory) {
        return contents[id].metadataURI;
    }
}
