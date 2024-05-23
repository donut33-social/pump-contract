// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Nonces.sol";
import "./Token.sol";

contract Pump is Ownable(msg.sender), Nonces {

    event NewToken(string indexed name, string indexed symbol, address indexed creator);

    address public immutable tokenImplementation;

    mapping(address => bool) public createdTokens;

    uint256 public totalTokens;

    constructor() {
        tokenImplementation = address(new Token());
        Token(tokenImplementation).initialize("", "");
    }
    
    function createToken(string calldata name, string calldata symbol) external payable returns (address) {
        bytes32 salt;
        address creator = tx.origin;
        unchecked {
            salt = keccak256(abi.encodePacked(name, symbol, _useNonce(address(creator)), address(creator)));
        }

        address instance = Clones.cloneDeterministic(tokenImplementation, salt);
        Token(instance).initialize(name, symbol);

        createdTokens[instance] = true;
        totalTokens += 1;
        emit NewToken(name, symbol, creator);
        return instance;
    }
}