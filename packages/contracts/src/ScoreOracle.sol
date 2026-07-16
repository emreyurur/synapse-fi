// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IScoreOracle} from "./interfaces/ISynapseFi.sol";

/// @title ScoreOracle
/// @notice Epoch-based credit scores (0–1000) for agents, written by an
///         authorized off-chain oracle worker that aggregates ERC-8004
///         reputation, ERC-8183 job history and nanopayment inflows.
///         Consumers must treat scores older than `maxScoreAge` as stale.
contract ScoreOracle is Ownable, IScoreOracle {
    struct ScoreData {
        uint16 score; // 0–1000
        uint64 epoch;
        uint64 updatedAt;
        bytes32 factorsHash; // keccak256 of the factor breakdown (off-chain reproducible)
    }

    mapping(address agent => ScoreData) private _scores;
    mapping(address updater => bool) public isUpdater;

    uint16 public constant MAX_SCORE = 1000;
    uint64 public maxScoreAge = 1 days;

    event ScoreUpdated(address indexed agent, uint16 score, uint64 indexed epoch, bytes32 factorsHash);
    event UpdaterSet(address indexed updater, bool allowed);
    event MaxScoreAgeSet(uint64 maxScoreAge);

    error NotUpdater();
    error ScoreOutOfRange();
    error LengthMismatch();

    modifier onlyUpdater() {
        if (!isUpdater[msg.sender]) revert NotUpdater();
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setUpdater(address updater, bool allowed) external onlyOwner {
        isUpdater[updater] = allowed;
        emit UpdaterSet(updater, allowed);
    }

    function setMaxScoreAge(uint64 age) external onlyOwner {
        maxScoreAge = age;
        emit MaxScoreAgeSet(age);
    }

    function setScore(address agent, uint16 score, uint64 epoch, bytes32 factorsHash) public onlyUpdater {
        if (score > MAX_SCORE) revert ScoreOutOfRange();
        _scores[agent] =
            ScoreData({score: score, epoch: epoch, updatedAt: uint64(block.timestamp), factorsHash: factorsHash});
        emit ScoreUpdated(agent, score, epoch, factorsHash);
    }

    /// @notice Batch write for one oracle epoch.
    function setScores(address[] calldata agents, uint16[] calldata scores, uint64 epoch, bytes32[] calldata hashes)
        external
        onlyUpdater
    {
        if (agents.length != scores.length || agents.length != hashes.length) revert LengthMismatch();
        for (uint256 i; i < agents.length; ++i) {
            setScore(agents[i], scores[i], epoch, hashes[i]);
        }
    }

    /// @inheritdoc IScoreOracle
    function getScore(address agent) external view returns (uint16 score, bool fresh) {
        ScoreData storage s = _scores[agent];
        score = s.score;
        fresh = s.updatedAt != 0 && block.timestamp - s.updatedAt <= maxScoreAge;
    }

    function getScoreData(address agent) external view returns (ScoreData memory) {
        return _scores[agent];
    }
}
