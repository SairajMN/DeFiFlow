// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Governance is Ownable {
    struct Proposal {
        uint256 id;
        address proposer;
        string description;
        address target;
        bytes data;
        uint256 value;
        uint256 startTime;
        uint256 endTime;
        uint256 forVotes;
        uint256 againstVotes;
        bool executed;
        bool canceled;
    }

    struct Vote {
        bool hasVoted;
        bool support;
        uint256 votes;
    }

    IERC20 public votingToken;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => Vote)) public votes;
    mapping(address => uint256) public votingPower;

    uint256 public proposalCount;
    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public constant PROPOSAL_THRESHOLD = 1000 * 10**18; // 1000 tokens
    uint256 public constant QUORUM_THRESHOLD = 10000 * 10**18; // 10000 tokens

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string description,
        address target,
        uint256 value
    );

    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 votes
    );

    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCanceled(uint256 indexed proposalId);

    /// @notice Contract constructor
    /// @param _votingToken The address of the token used for voting
    /// @dev Initializes the governance contract with voting token
    constructor(address _votingToken) Ownable(msg.sender) {
        votingToken = IERC20(_votingToken);
    }

    /// @notice Creates a new governance proposal
    /// @param description A description of the proposed change
    /// @param target The contract address to call if proposal passes
    /// @param data The encoded function call data
    /// @param value The amount of ETH to send with the call
    /// @return The ID of the created proposal
    /// @dev Requires proposer to have sufficient voting power
    function proposeChange(
        string memory description,
        address target,
        bytes memory data,
        uint256 value
    ) external returns (uint256) {
        require(votingToken.balanceOf(msg.sender) >= PROPOSAL_THRESHOLD, "Insufficient voting power");

        uint256 proposalId = ++proposalCount;
        proposals[proposalId] = Proposal({
            id: proposalId,
            proposer: msg.sender,
            description: description,
            target: target,
            data: data,
            value: value,
            startTime: block.timestamp,
            endTime: block.timestamp + VOTING_PERIOD,
            forVotes: 0,
            againstVotes: 0,
            executed: false,
            canceled: false
        });

        emit ProposalCreated(proposalId, msg.sender, description, target, value);
        return proposalId;
    }

    /// @notice Casts a vote on a governance proposal
    /// @param proposalId The ID of the proposal to vote on
    /// @param support Whether to vote for (true) or against (false) the proposal
    /// @dev Voter's token balance determines voting power
    function vote(uint256 proposalId, bool support) external {
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp >= proposal.startTime, "Voting not started");
        require(block.timestamp <= proposal.endTime, "Voting ended");
        require(!proposal.executed, "Proposal already executed");
        require(!proposal.canceled, "Proposal canceled");

        Vote storage userVote = votes[proposalId][msg.sender];
        require(!userVote.hasVoted, "Already voted");

        uint256 voterBalance = votingToken.balanceOf(msg.sender);
        require(voterBalance > 0, "No voting power");

        userVote.hasVoted = true;
        userVote.support = support;
        userVote.votes = voterBalance;

        if (support) {
            proposal.forVotes += voterBalance;
        } else {
            proposal.againstVotes += voterBalance;
        }

        emit VoteCast(proposalId, msg.sender, support, voterBalance);
    }

    /// @notice Executes a passed governance proposal
    /// @param proposalId The ID of the proposal to execute
    /// @dev Requires proposal to have passed and voting period to have ended
    function executeProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp > proposal.endTime, "Voting not ended");
        require(!proposal.executed, "Already executed");
        require(!proposal.canceled, "Proposal canceled");
        require(proposal.forVotes > proposal.againstVotes, "Proposal not passed");
        require(proposal.forVotes >= QUORUM_THRESHOLD, "Quorum not reached");

        proposal.executed = true;

        // Execute the proposal
        (bool success,) = proposal.target.call{value: proposal.value}(proposal.data);
        require(success, "Proposal execution failed");

        emit ProposalExecuted(proposalId);
    }

    /// @notice Cancels a governance proposal
    /// @param proposalId The ID of the proposal to cancel
    /// @dev Can only be called by the proposer or contract owner
    function cancelProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(msg.sender == proposal.proposer || msg.sender == owner(), "Not authorized");
        require(!proposal.executed, "Already executed");
        require(!proposal.canceled, "Already canceled");

        proposal.canceled = true;
        emit ProposalCanceled(proposalId);
    }

    /// @notice Gets detailed information about a proposal
    /// @param proposalId The ID of the proposal to query
    /// @return id The proposal ID
    /// @return proposer The address that created the proposal
    /// @return description The proposal description
    /// @return startTime The timestamp when voting started
    /// @return endTime The timestamp when voting ends
    /// @return forVotes The number of votes in favor
    /// @return againstVotes The number of votes against
    /// @return executed Whether the proposal has been executed
    /// @return canceled Whether the proposal has been canceled
    function getProposal(uint256 proposalId) external view returns (
        uint256 id,
        address proposer,
        string memory description,
        uint256 startTime,
        uint256 endTime,
        uint256 forVotes,
        uint256 againstVotes,
        bool executed,
        bool canceled
    ) {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.id,
            proposal.proposer,
            proposal.description,
            proposal.startTime,
            proposal.endTime,
            proposal.forVotes,
            proposal.againstVotes,
            proposal.executed,
            proposal.canceled
        );
    }

    /// @notice Gets voting information for a specific voter on a proposal
    /// @param proposalId The ID of the proposal
    /// @param voter The address of the voter
    /// @return hasVoted Whether the voter has cast a vote
    /// @return support Whether the voter voted for (true) or against (false)
    /// @return votes The number of votes cast by the voter
    function getVote(uint256 proposalId, address voter) external view returns (bool, bool, uint256) {
        Vote storage userVote = votes[proposalId][voter];
        return (userVote.hasVoted, userVote.support, userVote.votes);
    }

    /// @notice Gets the total number of proposals created
    /// @return The total count of proposals
    function getProposalCount() external view returns (uint256) {
        return proposalCount;
    }
}
