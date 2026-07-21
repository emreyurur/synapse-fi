// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title MockJobBoard
/// @notice ERC-8183 stand-in for Arc Testnet: an escrowed job market plus a
///         nanopayment channel. It exists so the indexer (Faz 2) has an
///         on-chain source for job history and revenue inflows until the
///         canonical ERC-8183 contracts are live on Arc.
///
///         Jobs escrow USDC from the poster and release it to the agent's
///         payout address (`payTo` — normally the agent's RevenueSplitter) on
///         completion. `payNano` streams small direct payments to the same
///         address. Both feed the four scoring factors:
///         completion rate, revenue continuity, dispute-free rate, stability.
contract MockJobBoard {
    using SafeERC20 for IERC20;

    enum Status {
        None,
        Posted,
        Completed,
        Disputed
    }

    struct Job {
        address poster;
        address agent;
        address payTo;
        uint256 amount;
        Status status;
    }

    IERC20 public immutable asset;
    uint256 public nextJobId = 1;
    mapping(uint256 jobId => Job) public jobs;

    event JobPosted(uint256 indexed jobId, address indexed poster, address indexed agent, address payTo, uint256 amount);
    event JobCompleted(uint256 indexed jobId, address indexed agent, address payTo, uint256 amount);
    event JobDisputed(uint256 indexed jobId, address indexed agent, uint256 amount);
    event NanoPayment(address indexed payer, address indexed agent, address payTo, uint256 amount);

    error NotPoster();
    error BadStatus(Status status);
    error ZeroAddress();
    error ZeroAmount();

    constructor(IERC20 asset_) {
        asset = asset_;
    }

    /// @notice Poster escrows `amount` USDC for a job routed to `payTo`.
    function postJob(address agent, address payTo, uint256 amount) external returns (uint256 jobId) {
        if (agent == address(0) || payTo == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        jobId = nextJobId++;
        jobs[jobId] = Job({poster: msg.sender, agent: agent, payTo: payTo, amount: amount, status: Status.Posted});
        asset.safeTransferFrom(msg.sender, address(this), amount);
        emit JobPosted(jobId, msg.sender, agent, payTo, amount);
    }

    /// @notice Releases escrow to the agent's payout address. Callable by the
    ///         poster (accepting delivery).
    function completeJob(uint256 jobId) external {
        Job storage job = jobs[jobId];
        if (job.status != Status.Posted) revert BadStatus(job.status);
        if (msg.sender != job.poster) revert NotPoster();
        job.status = Status.Completed;
        asset.safeTransfer(job.payTo, job.amount);
        emit JobCompleted(jobId, job.agent, job.payTo, job.amount);
    }

    /// @notice Poster raises a dispute and reclaims the escrow.
    function disputeJob(uint256 jobId) external {
        Job storage job = jobs[jobId];
        if (job.status != Status.Posted) revert BadStatus(job.status);
        if (msg.sender != job.poster) revert NotPoster();
        job.status = Status.Disputed;
        asset.safeTransfer(job.poster, job.amount);
        emit JobDisputed(jobId, job.agent, job.amount);
    }

    /// @notice Streams a direct nanopayment to an agent's payout address.
    function payNano(address agent, address payTo, uint256 amount) external {
        if (agent == address(0) || payTo == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        asset.safeTransferFrom(msg.sender, payTo, amount);
        emit NanoPayment(msg.sender, agent, payTo, amount);
    }
}
