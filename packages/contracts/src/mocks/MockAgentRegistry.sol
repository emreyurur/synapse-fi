// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IAgentRegistry} from "../interfaces/ISynapseFi.sol";

/// @title MockAgentRegistry
/// @notice ERC-8004 stand-in until the canonical registry is available on Arc
///         Testnet. Tracks a simple reputation figure per agent; the
///         CreditLineManager slashes it on default.
contract MockAgentRegistry is Ownable, IAgentRegistry {
    struct Agent {
        uint256 id;
        uint256 reputation;
        bool registered;
    }

    mapping(address agent => Agent) public agents;
    mapping(address caller => bool) public isPenalizer;
    uint256 public nextId = 1;

    event AgentRegistered(address indexed agent, uint256 indexed id);
    event ReputationChanged(address indexed agent, uint256 newReputation);
    event PenalizerSet(address indexed caller, bool allowed);

    error NotPenalizer();
    error NotRegistered();

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setPenalizer(address caller, bool allowed) external onlyOwner {
        isPenalizer[caller] = allowed;
        emit PenalizerSet(caller, allowed);
    }

    function register() external returns (uint256 id) {
        Agent storage a = agents[msg.sender];
        if (a.registered) return a.id;
        id = nextId++;
        agents[msg.sender] = Agent({id: id, reputation: 500, registered: true});
        emit AgentRegistered(msg.sender, id);
    }

    /// @inheritdoc IAgentRegistry
    function penalize(address agent, uint256 amount) external {
        if (!isPenalizer[msg.sender]) revert NotPenalizer();
        Agent storage a = agents[agent];
        if (!a.registered) revert NotRegistered();
        a.reputation = a.reputation > amount ? a.reputation - amount : 0;
        emit ReputationChanged(agent, a.reputation);
    }
}
