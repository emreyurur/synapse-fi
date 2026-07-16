// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {
    IScoreOracle,
    IInterestRateModel,
    ICreditPool,
    ICreditLineManager,
    IAgentRegistry,
    IRevenueRouterFactory
} from "./interfaces/ISynapseFi.sol";

/// @title CreditLineManager
/// @notice Opens and services uncollateralized credit lines for agents.
///         Limits and pricing come from the ScoreOracle + InterestRateModel;
///         repayments flow in through each agent's RevenueSplitter (or any
///         caller). Defaulting agents are penalized in the agent registry.
contract CreditLineManager is Ownable, ReentrancyGuard, ICreditLineManager {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    enum Status {
        None,
        Active,
        Delinquent,
        Closed
    }

    struct Line {
        uint128 principal;
        uint128 interestAccrued;
        uint64 lastAccrual;
        uint64 breachSince; // when debt first exceeded the limit; 0 = no breach
        uint16 aprBps; // last applied APR snapshot
        Status status;
        address treasury;
        address splitter;
    }

    IERC20 public immutable asset;
    IScoreOracle public immutable oracle;
    IInterestRateModel public immutable rateModel;
    ICreditPool public immutable pool;
    IAgentRegistry public registry;
    IRevenueRouterFactory public factory;

    mapping(address agent => Line) public lines;

    // ── Risk parameters ──────────────────────────────────────
    uint16 public minScore = 500;
    /// @notice Credit limit granted per score point above `minScore` (asset units).
    uint256 public limitPerPoint;
    /// @notice Share of agent revenue routed to repayment while in debt.
    uint16 public repaymentShareBps = 1200; // 12%
    /// @notice Extra APR per score point below MAX_SCORE (risk premium).
    uint16 public premiumPerPointBps = 0;
    uint64 public gracePeriod = 3 days;
    /// @notice Reputation penalty applied on default.
    uint256 public defaultPenalty = 200;

    uint256 internal constant BPS = 10_000;
    uint16 internal constant MAX_SCORE = 1000;
    uint256 internal constant YEAR = 365 days;

    event LineOpened(address indexed agent, address indexed treasury, address splitter, uint256 limit);
    event Drawn(address indexed agent, uint256 amount, uint16 aprBps);
    event Repaid(address indexed agent, address indexed payer, uint256 principal, uint256 interest);
    event Accrued(address indexed agent, uint256 interest, uint16 newAprBps);
    event LineClosed(address indexed agent);
    event Defaulted(address indexed agent, uint256 debt);
    event ParamsSet(
        uint16 minScore, uint256 limitPerPoint, uint16 repaymentShareBps, uint16 premiumPerPointBps, uint64 gracePeriod
    );
    event RegistrySet(address registry);
    event FactorySet(address factory);

    error LineExists();
    error NoLine(Status status);
    error ScoreTooLowOrStale();
    error ExceedsLimit(uint256 debt, uint256 limit);
    error NotDelinquent();
    error DebtOutstanding();
    error ZeroAmount();
    error ZeroAddress();

    constructor(
        IERC20 asset_,
        IScoreOracle oracle_,
        IInterestRateModel rateModel_,
        ICreditPool pool_,
        address initialOwner
    ) Ownable(initialOwner) {
        asset = asset_;
        oracle = oracle_;
        rateModel = rateModel_;
        pool = pool_;
        limitPerPoint = 50 * 10 ** 6; // 50 USDC per point by default (6-decimal asset)
    }

    // ── Admin ────────────────────────────────────────────────

    function setRegistry(IAgentRegistry registry_) external onlyOwner {
        registry = registry_;
        emit RegistrySet(address(registry_));
    }

    function setFactory(IRevenueRouterFactory factory_) external onlyOwner {
        factory = factory_;
        emit FactorySet(address(factory_));
    }

    function setParams(
        uint16 minScore_,
        uint256 limitPerPoint_,
        uint16 repaymentShareBps_,
        uint16 premiumPerPointBps_,
        uint64 gracePeriod_
    ) external onlyOwner {
        require(repaymentShareBps_ <= BPS, "share>100%");
        minScore = minScore_;
        limitPerPoint = limitPerPoint_;
        repaymentShareBps = repaymentShareBps_;
        premiumPerPointBps = premiumPerPointBps_;
        gracePeriod = gracePeriod_;
        emit ParamsSet(minScore_, limitPerPoint_, repaymentShareBps_, premiumPerPointBps_, gracePeriod_);
    }

    // ── Agent actions ────────────────────────────────────────

    /// @notice Opens a credit line for the caller. Requires a fresh score ≥ minScore.
    /// @param treasury Where drawn funds and the agent's revenue share are sent.
    function openLine(address treasury) external nonReentrant returns (address splitter) {
        if (treasury == address(0)) revert ZeroAddress();
        Line storage line = lines[msg.sender];
        if (line.status == Status.Active || line.status == Status.Delinquent) revert LineExists();

        (uint16 score, bool fresh) = oracle.getScore(msg.sender);
        if (!fresh || score < minScore) revert ScoreTooLowOrStale();

        splitter = address(factory) != address(0) ? factory.createSplitter(msg.sender, treasury) : address(0);

        lines[msg.sender] = Line({
            principal: 0,
            interestAccrued: 0,
            lastAccrual: uint64(block.timestamp),
            breachSince: 0,
            aprBps: _currentAprBps(score).toUint16(),
            status: Status.Active,
            treasury: treasury,
            splitter: splitter
        });
        emit LineOpened(msg.sender, treasury, splitter, creditLimit(msg.sender));
    }

    /// @notice Draws funds from the pool up to the score-based limit.
    function draw(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        Line storage line = lines[msg.sender];
        if (line.status != Status.Active) revert NoLine(line.status);

        (uint16 score, bool fresh) = oracle.getScore(msg.sender);
        if (!fresh || score < minScore) revert ScoreTooLowOrStale();

        _accrue(msg.sender, line);

        uint256 debt = uint256(line.principal) + line.interestAccrued + amount;
        uint256 limit = creditLimit(msg.sender);
        if (debt > limit) revert ExceedsLimit(debt, limit);

        line.principal += amount.toUint128();
        pool.lendOut(line.treasury, amount);
        // Re-snapshot the APR at post-draw utilization so the new debt accrues
        // at the correct (higher) rate.
        line.aprBps = _currentAprBps(score).toUint16();
        emit Drawn(msg.sender, amount, line.aprBps);
    }

    /// @notice Closes a fully repaid line so a new one can be opened later.
    function closeLine() external {
        Line storage line = lines[msg.sender];
        if (line.status != Status.Active) revert NoLine(line.status);
        _accrue(msg.sender, line);
        if (uint256(line.principal) + line.interestAccrued != 0) revert DebtOutstanding();
        line.status = Status.Closed;
        emit LineClosed(msg.sender);
    }

    // ── Repayment (splitter or anyone) ───────────────────────

    /// @inheritdoc ICreditLineManager
    /// @notice Pulls up to `amount` from the caller (interest first, then
    ///         principal) and forwards it to the pool. Returns the amount used.
    function repay(address agent, uint256 amount) external nonReentrant returns (uint256 used) {
        Line storage line = lines[agent];
        if (line.status != Status.Active && line.status != Status.Delinquent) revert NoLine(line.status);
        _accrue(agent, line);

        uint256 interestDue = line.interestAccrued;
        uint256 principalDue = line.principal;
        uint256 debt = interestDue + principalDue;
        used = amount > debt ? debt : amount;
        if (used == 0) return 0;

        uint256 interestPaid = used > interestDue ? interestDue : used;
        uint256 principalPaid = used - interestPaid;

        line.interestAccrued = (interestDue - interestPaid).toUint128();
        line.principal = (principalDue - principalPaid).toUint128();

        asset.safeTransferFrom(msg.sender, address(this), used);
        asset.forceApprove(address(pool), used);
        pool.receiveRepayment(principalPaid, interestPaid);

        if (uint256(line.principal) + line.interestAccrued == 0) {
            line.breachSince = 0;
            if (line.status == Status.Delinquent) line.status = Status.Active;
        }
        // Re-snapshot the APR at post-repayment utilization.
        (uint16 score,) = oracle.getScore(agent);
        line.aprBps = _currentAprBps(score).toUint16();
        emit Repaid(agent, msg.sender, principalPaid, interestPaid);
    }

    // ── Default handling ─────────────────────────────────────

    /// @notice Marks an agent delinquent after the grace period. Callable by
    ///         anyone (keeper). Slashes reputation and sweeps 100% of future
    ///         revenue until the debt clears.
    function markDelinquent(address agent) external {
        Line storage line = lines[agent];
        if (line.status != Status.Active) revert NoLine(line.status);
        _accrue(agent, line);
        if (line.breachSince == 0 || block.timestamp < uint256(line.breachSince) + gracePeriod) {
            revert NotDelinquent();
        }
        line.status = Status.Delinquent;
        if (address(registry) != address(0)) {
            registry.penalize(agent, defaultPenalty);
        }
        emit Defaulted(agent, uint256(line.principal) + line.interestAccrued);
    }

    /// @notice Public accrual poke (keepers / UI refresh).
    function poke(address agent) external {
        Line storage line = lines[agent];
        if (line.status != Status.Active && line.status != Status.Delinquent) revert NoLine(line.status);
        _accrue(agent, line);
    }

    // ── Views ────────────────────────────────────────────────

    function creditLimit(address agent) public view returns (uint256) {
        (uint16 score,) = oracle.getScore(agent);
        if (score <= minScore) return 0;
        return uint256(score - minScore) * limitPerPoint;
    }

    function totalDebt(address agent) external view returns (uint256) {
        Line storage line = lines[agent];
        return uint256(line.principal) + line.interestAccrued + _pendingInterest(line);
    }

    /// @inheritdoc ICreditLineManager
    function revenueShareBps(address agent) external view returns (uint256) {
        Line storage line = lines[agent];
        if (line.status == Status.Delinquent) return BPS; // full sweep
        if (line.status != Status.Active) return 0;
        uint256 debt = uint256(line.principal) + line.interestAccrued + _pendingInterest(line);
        return debt == 0 ? 0 : repaymentShareBps;
    }

    function currentAprBps(address agent) external view returns (uint256) {
        (uint16 score,) = oracle.getScore(agent);
        return _currentAprBps(score);
    }

    // ── Internals ────────────────────────────────────────────

    function _currentAprBps(uint16 score) internal view returns (uint256) {
        uint256 premium = score >= MAX_SCORE ? 0 : uint256(MAX_SCORE - score) * premiumPerPointBps;
        return rateModel.aprBps(pool.utilizationBps()) + premium;
    }

    function _pendingInterest(Line storage line) internal view returns (uint256) {
        uint256 debt = uint256(line.principal) + line.interestAccrued;
        if (debt == 0 || line.lastAccrual == 0) return 0;
        uint256 dt = block.timestamp - line.lastAccrual;
        return (debt * line.aprBps * dt) / (BPS * YEAR);
    }

    function _accrue(address agent, Line storage line) internal {
        uint256 interest = _pendingInterest(line);
        if (interest != 0) {
            line.interestAccrued += interest.toUint128();
        }
        line.lastAccrual = uint64(block.timestamp);

        // Refresh the APR snapshot from current utilization + score.
        (uint16 score,) = oracle.getScore(agent);
        line.aprBps = _currentAprBps(score).toUint16();

        // Track limit breaches for delinquency.
        uint256 debt = uint256(line.principal) + line.interestAccrued;
        if (debt > creditLimit(agent)) {
            if (line.breachSince == 0) line.breachSince = uint64(block.timestamp);
        } else {
            line.breachSince = 0;
        }
        if (interest != 0) emit Accrued(agent, interest, line.aprBps);
    }
}
