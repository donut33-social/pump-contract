// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.13;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./Interfaces.sol";

// Events
contract IPShareevents {
    event CreateIPshare(
        uint256 indexed assetId,
        uint256 indexed amount,
        uint256 createFee
    );
    event ChangeHolder(
        uint256 indexed assetId,
        address indexed originalHolder,
        address indexed newHolder
    );
    event Trade(
        address indexed trader,
        uint256 indexed assetId,
        bool isBuy,
        uint256 shareAmount,
        uint256 ethAmount,
        uint256 protocolEthAmount,
        uint256 subjectEthAmount,
        uint256 supply
    );
    event ValueCaptured(
        uint256 indexed assetId,
        address indexed investor,
        uint256 indexed amount
    );
    event Stake(
        address indexed staker,
        uint256 indexed assetId,
        bool isStake,
        uint256 indexed amount,
        uint256 stakedAmount
    );
}

// This is a bonding curve share for KOL's content
contract IPShare is
    Ownable,
    Pausable,
    ReentrancyGuard,
    IPShareevents,
    IIPShare
{
    address private self;

    // This is the asset ON BTC include: BITIP or other inscriptions or rune
    // The type and id uniquely determine an IPShare
    struct Asset {
        // 1: BITIP 2-...: other types
        uint128 assetType; 
        // assetId, different types of assets have different types of IDs, ex: bitip's id is the bolck number
        uint128 id; 
        // asset holdre: the holder can share trading fee of IPShare, and it can be change if the owner on BTC changed
        address holder; 
    }

    mapping(uint128 => bool) registryAssetType;

    // assetId => user => balance
    mapping(uint256 => mapping(address => uint256)) public ipshareBalance;
    // assetId => supply
    mapping(uint256 => uint256) public ipshareSupply;
    // assetId => created
    mapping(uint256 => bool) public ipshareCreated;
    // assetId => asset
    mapping(uint256 => Asset) public assetMapping;
    // asset owner
    mapping(address => uint256) public assetHolding;

    uint256 minHoldShares = 10 ether;

    // buy and sell c-share will cost operator fee to the author and donut, 
    // the percent is a number from 0 - 10000, ex. 5000 means 50%
    uint256 public subjectFeePercent;
    uint256 public donutFeePercent;
    // part of the ipshare trade fee will dipost to the pool to distribute to the bitip block contributors
    uint256 public bitipFeePercent; 
    uint256 public createFee;
    // address that receive donut fee
    address public donutFeeDestination;
    IBitIPContributorFee public bitipFeeContract;

    // The new IPShare can change its fee receiver which is the owner of BITIP on BTC
    address public signer;

    mapping(uint256 => bool) private usedNonce;

    // ================================ stake =================================
    struct Staker {
        address staker;
        uint256 amount;
        uint256 redeemAmount;
        uint256 unlockTime;
        uint256 debts;
        uint256 profit;
    }

    // max heap for the max stake user: subject => heap
    mapping(uint256 => Staker[]) private stakerMaxHeap;
    // asset => staker => index
    mapping(uint256 => mapping(address => uint256)) private stakerIndex;
    // unlock day
    uint256 constant UNLOCK_PERIOD = 7 days;
    // asset => amount
    mapping(uint256 => uint256) public totalStakedIPshare;
    // asset => acc
    mapping(uint256 => uint256) private ipshareAcc;

    // ================================ Modifiers =================================

    modifier onlyStaker(uint256 assetId) {
        uint256 index = stakerIndex[assetId][msg.sender];
        require(
            stakerMaxHeap[assetId].length > 0 &&
                stakerMaxHeap[assetId][index].staker == msg.sender,
            "Not a staker"
        );
        _;
    }

    modifier onlyRegisteredAssetType(uint256 assetId) {
        (uint128 assetType, ) = getAssetById(assetId);
        require(registryAssetType[assetType], "Not a registered type");
        _;
    }

    constructor(address _bitipFeeContract, address _signer) {
        self = address(this);
        // initial the fee as 5.5% 1.5%,0%
        subjectFeePercent = 550;
        donutFeePercent = 150;
        bitipFeePercent = 0;
        createFee = 0;
        bitipFeeContract = IBitIPContributorFee(_bitipFeeContract);
        donutFeeDestination = msg.sender;
        signer = _signer;
        registryAssetType[1] = true;
    }

    // ================================ admin function =================================

    function adminSetSubjectFeePercent(
        uint256 _subjectFeePercent
    ) public onlyOwner {
        require(_subjectFeePercent < 1000, "Fee percent is greater than 10%");
        subjectFeePercent = _subjectFeePercent;
    }

    function adminSetDonutFeePercent(
        uint256 _donutFeePercent
    ) public onlyOwner {
        require(_donutFeePercent < 1000, "Fee percent is greater than 10%");
        donutFeePercent = _donutFeePercent;
    }

    function adminSetBitipFeePercent(
        uint256 _bitipFeePercent
    ) public onlyOwner {
        require(_bitipFeePercent < 1000, "Fee percent is greater than 10%");
        bitipFeePercent = _bitipFeePercent;
    }

    function adminSetDonutFeeDestination(
        address _donutFeeDestination
    ) public onlyOwner {
        donutFeeDestination = _donutFeeDestination;
    }

    function adminSetBItipFeeDestination(
        address _bitipFeeContract
    ) public onlyOwner {
        bitipFeeContract = IBitIPContributorFee(_bitipFeeContract);
    }

    function adminSetSinger(address _signer) public onlyOwner {
        signer = _signer;
    }

    function adminSetCreateFee(uint256 _createFee) public onlyOwner {
        require(_createFee < 0.01 ether, "Too much fee!");
        createFee = _createFee;
    }

    function adminUpdateNewAssetType(
        uint128 assetType,
        bool registry
    ) public onlyOwner {
        registryAssetType[assetType] = registry;
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    // need receive eth from donut and ft contracts
    receive() external payable {}

    // ================================ create IPShare =================================
    /**
     * @dev only user who hold BTC assets can create his ip share
     * @param amount the initial ipshare amount except minHoldShares free share
     */
    function createShare(
        uint256 assetId,
        uint256 amount,
        uint256 nonce,
        bytes calldata sign
    )
        public
        payable
        override
        nonReentrant
        whenNotPaused
        onlyRegisteredAssetType(assetId)
    {
        // check if ipshare already created
        require(!ipshareCreated[assetId], "IPShare already created");
        require(assetHolding[msg.sender] == 0, "User has ipshare");

        // check signature
        require(!usedNonce[nonce], "invalid nonce");
        bytes32 data = keccak256(
            abi.encodePacked(assetId, msg.sender, nonce, amount)
        );
        data = ECDSA.toEthSignedMessageHash(data);
        require(
            SignatureChecker.isValidSignatureNow(signer, data, sign),
            "invalid signature"
        );

        usedNonce[nonce] = true;

        ipshareCreated[assetId] = true;
        (uint128 assetType, uint128 id) = getAssetById(assetId);
        assetHolding[msg.sender] = assetId;
        assetMapping[assetId].assetType = assetType;
        assetMapping[assetId].id = id;
        assetMapping[assetId].holder = msg.sender;

        uint256 price = getPrice(minHoldShares, amount);
        require(msg.value >= price + createFee, "Insufficient payment");
        if (msg.value > price + createFee) {
            (bool success, ) = msg.sender.call{
                value: msg.value - price - createFee
            }("");
            require(success, "refund fail");
        }
        if (createFee > 0) {
            (bool success1, ) = donutFeeDestination.call{value: createFee}("");
            require(success1, "pay create fee fail");
        }
        // the owner can get 1 share free
        ipshareBalance[assetId][msg.sender] += amount + minHoldShares;
        ipshareSupply[assetId] = amount + minHoldShares;
        // create ipshare wont cost fees
        emit CreateIPshare(assetId, amount + minHoldShares, createFee);
    }

    function changeHolder(
        uint256 assetId,
        address newHolder,
        uint256 nonce,
        bytes calldata sign
    )
        public
        override
        nonReentrant
        whenNotPaused
        onlyRegisteredAssetType(assetId)
    {
        require(ipshareCreated[assetId], "IPShare not exist");
        require(assetHolding[newHolder] == 0, "New user already has ipshare");

        // check signature
        require(!usedNonce[nonce], "invalid nonce");

        bytes32 data = keccak256(abi.encodePacked(assetId, newHolder, nonce));
        data = ECDSA.toEthSignedMessageHash(data);
        require(
            SignatureChecker.isValidSignatureNow(signer, data, sign),
            "invalid signature"
        );
        usedNonce[nonce] = true;

        // change holder
        address originalHolder = assetMapping[assetId].holder;
        assetHolding[originalHolder] = 0;
        assetMapping[assetId].holder = newHolder;
        assetHolding[newHolder] = assetId;

        emit ChangeHolder(assetId, originalHolder, newHolder);
    }

    // ================================buy and sell=================================
    // every buy and sell operation will cost the operator's c-share as fee to the author
    // The subject addres always equal to the KOL/Author, one subject corresponding a c-share
    function buyShares(
        uint256 assetId
    )
        public
        payable
        override
        nonReentrant
        whenNotPaused
        onlyRegisteredAssetType(assetId)
        returns (uint256)
    {
        return _buyShares(assetId, msg.sender, msg.value);
    }

    function _buyShares(
        uint256 assetId,
        address buyer,
        uint256 value
    ) private returns (uint256) {
        // check subject exist
        require(ipshareCreated[assetId], "IPShare does not exist");
        uint256 supply = ipshareSupply[assetId];
        uint256 buyFunds = value;
        uint256 subjectFee = (buyFunds * subjectFeePercent) / 10000;
        uint256 donutFee = (buyFunds * donutFeePercent) / 10000;
        uint256 bitipFee = (buyFunds * bitipFeePercent) / 10000;

        if (assetMapping[assetId].assetType != 1) {
            subjectFee += bitipFee;
            bitipFee = 0;
        } else if (bitipFee > 0) {
            bitipFeeContract.depositFee{value: bitipFee}(assetId);
            // (bool success, ) = bitipFeeDestination.call{value: bitipFee}("");
            // require(success, "Cost bitip fee fail");
        }

        uint256 ipshareReceived = getBuyAmountByValue(
            supply,
            buyFunds - subjectFee - donutFee - bitipFee
        );

        (bool success1, ) = donutFeeDestination.call{value: donutFee}("");
        (bool success2, ) = assetMapping[assetId].holder.call{
            value: subjectFee
        }("");
        require(success1 && success2, "Cost trade fee fail");

        ipshareBalance[assetId][buyer] += ipshareReceived;
        ipshareSupply[assetId] = supply + ipshareReceived;

        supply = ipshareSupply[assetId];
        emit Trade(
            buyer,
            assetId,
            true,
            ipshareReceived,
            buyFunds,
            donutFee,
            subjectFee,
            supply
        );

        return ipshareReceived;
    }

    // every one can sell his c-shares
    function sellShares(
        uint256 assetId,
        uint256 shareAmount
    )
        public
        override
        nonReentrant
        whenNotPaused
        onlyRegisteredAssetType(assetId)
    {
        uint256 supply = ipshareSupply[assetId];
        uint sellAmount = shareAmount;
        if (ipshareBalance[assetId][msg.sender] < shareAmount) {
            sellAmount = ipshareBalance[assetId][msg.sender];
        }
        uint256 afterSupply = 0;
        afterSupply = supply - sellAmount;
        require(afterSupply >= minHoldShares, "Cannot sell the last 10 share");

        uint256 price = getPrice(afterSupply, sellAmount);
        ipshareBalance[assetId][msg.sender] -= sellAmount;
        ipshareSupply[assetId] -= sellAmount;

        uint256 subjectFee = (price * subjectFeePercent) / 10000;
        uint256 donutFee = (price * donutFeePercent) / 10000;
        uint256 bitipFee = (price * bitipFeePercent) / 10000;

        bool isBitip = assetMapping[assetId].assetType == 1;

        if (isBitip && bitipFee > 0) {
            bitipFeeContract.depositFee{value: bitipFee}(assetId);

            // (bool success, ) = bitipFeeDestination.call{value: bitipFee}("");
            // require(success, "Cost bitip fee fail");
        } else {
            subjectFee += bitipFee;
            bitipFee = 0;
        }
        {
            (bool success1, ) = donutFeeDestination.call{value: donutFee}("");
            (bool success2, ) = assetMapping[assetId].holder.call{
                value: subjectFee
            }("");
            (bool success3, ) = msg.sender.call{
                value: price - subjectFee - donutFee - bitipFee
            }("");
            require(success1 && success2 && success3, "Unable to send funds");
        }

        emit Trade(
            msg.sender,
            assetId,
            false,
            sellAmount,
            price,
            donutFee,
            subjectFee,
            afterSupply
        );
    }

    // value capture
    function valueCapture(
        uint256 assetId
    ) public payable override onlyRegisteredAssetType(assetId) whenNotPaused {
        // c-share value capture
        // the method receive eth to buy back c-shares and distribute the c-shares to all the c-share stakers
        require(msg.value > 0, "No funds");
        uint256 obtainedAmount = _buyShares(assetId, self, msg.value);
        // update acc
        if (totalStakedIPshare[assetId] > 0) {
            ipshareAcc[assetId] +=
                (obtainedAmount * 1e18) /
                totalStakedIPshare[assetId];
        }

        emit ValueCaptured(assetId, msg.sender, msg.value);
    }

    // ================================ stake =================================
    // User can stake his c-shares to earn voting rights and dividend rights
    // User can add more stake c-share
    function stake(
        uint256 assetId,
        uint256 amount
    ) public nonReentrant whenNotPaused onlyRegisteredAssetType(assetId) {
        require(
            amount > 0 && ipshareBalance[assetId][msg.sender] >= amount,
            "Insufficient shares"
        );

        uint256 index = stakerIndex[assetId][msg.sender];

        // updated total stake amount
        uint256 updatedAmount = 0;

        if (
            stakerMaxHeap[assetId].length == 0 ||
            stakerMaxHeap[assetId][index].staker != msg.sender
        ) {
            updatedAmount = amount;
            index = _insertStaker(assetId, msg.sender, amount);
        } else if (stakerMaxHeap[assetId][index].amount >= 0) {
            updatedAmount = stakerMaxHeap[assetId][index].amount + amount;
            stakerMaxHeap[assetId][index].profit +=
                (ipshareAcc[assetId] * stakerMaxHeap[assetId][index].amount) /
                1e18 -
                stakerMaxHeap[assetId][index].debts;
        }
        ipshareBalance[assetId][msg.sender] -= amount;
        totalStakedIPshare[assetId] += amount;

        // update debtes
        stakerMaxHeap[assetId][index].debts =
            (ipshareAcc[assetId] * updatedAmount) /
            1e18;

        _updateStake(assetId, msg.sender, updatedAmount);

        emit Stake(msg.sender, assetId, true, amount, updatedAmount);
    }

    // Staker start unstake his c-shares
    // Everyone can have only one unstaking stuts of one c-share
    // When the staker start unstaked c-shares, the part of c-shares is locked(no voting rights and dividend rights)
    function unstake(
        uint256 assetId,
        uint256 amount
    )
        public
        nonReentrant
        onlyStaker(assetId)
        whenNotPaused
        onlyRegisteredAssetType(assetId)
    {
        uint256 index = stakerIndex[assetId][msg.sender];
        require(
            stakerMaxHeap[assetId][index].redeemAmount == 0,
            "In un-staking period now."
        );
        require(
            amount > 0 && stakerMaxHeap[assetId][index].amount >= amount,
            "Wrong amount or insufficient stake amount"
        );

        // update profits
        stakerMaxHeap[assetId][index].profit +=
            (ipshareAcc[assetId] * stakerMaxHeap[assetId][index].amount) /
            1e18 -
            stakerMaxHeap[assetId][index].debts;

        // update stake info
        uint256 updatedAmount = stakerMaxHeap[assetId][index].amount - amount;
        stakerMaxHeap[assetId][index].redeemAmount = amount;
        stakerMaxHeap[assetId][index].unlockTime =
            block.timestamp +
            UNLOCK_PERIOD;
        totalStakedIPshare[assetId] -= amount;

        // update debtes
        stakerMaxHeap[assetId][index].debts =
            (ipshareAcc[assetId] * updatedAmount) /
            1e18;

        _updateStake(assetId, msg.sender, updatedAmount);

        emit Stake(msg.sender, assetId, false, amount, updatedAmount);
    }

    // Redeem the unstaked c-share
    // The staker can redeem them after 7days after the start unstaking
    function redeem(
        uint256 assetId
    )
        public
        nonReentrant
        onlyStaker(assetId)
        onlyRegisteredAssetType(assetId)
        whenNotPaused
    {
        uint256 index = stakerIndex[assetId][msg.sender];
        require(
            stakerMaxHeap[assetId][index].redeemAmount > 0,
            "No ipshare to redeem"
        );
        require(
            stakerMaxHeap[assetId][index].unlockTime <= block.timestamp,
            "The ipshare is in locking period"
        );
        ipshareBalance[assetId][msg.sender] += stakerMaxHeap[assetId][index]
            .redeemAmount;
        stakerMaxHeap[assetId][index].redeemAmount = 0;
    }

    // claim ipshare profit from captured value
    function claim(
        uint256 assetId
    )
        public
        nonReentrant
        onlyStaker(assetId)
        onlyRegisteredAssetType(assetId)
        whenNotPaused
    {
        uint256 index = stakerIndex[assetId][msg.sender];
        uint256 pendingProfits = getPendingProfits(assetId, msg.sender);
        require(pendingProfits > 0, "No profit to claim");
        ipshareBalance[assetId][msg.sender] += pendingProfits;
        ipshareBalance[assetId][self] -= pendingProfits;
        stakerMaxHeap[assetId][index].profit = 0;

        stakerMaxHeap[assetId][index].debts =
            (ipshareAcc[assetId] * stakerMaxHeap[assetId][index].amount) /
            1e18;
    }

    // get stakers' pending profilts from their staking
    function getPendingProfits(
        uint256 assetId,
        address staker
    ) public view override returns (uint256) {
        // if (stakerMaxHeap[assetId].length == 0) {
        //     return 0;
        // }
        // uint256 index = stakerIndex[assetId][staker];
        // Staker memory stakerInfo = stakerMaxHeap[assetId][index];

        Staker memory stakerInfo = getStakerInfo(assetId, staker);

        uint256 profits = (ipshareAcc[assetId] * stakerInfo.amount) /
            1e18 -
            stakerInfo.debts +
            stakerInfo.profit;
        return profits;
    }

    // ================================ Max heap tool =================================
    function getMaxStaker(
        uint256 assetId
    ) public view override returns (address, uint256) {
        if (stakerMaxHeap[assetId].length == 0) {
            return (address(0), 0);
        }
        return (
            stakerMaxHeap[assetId][0].staker,
            stakerMaxHeap[assetId][0].amount
        );
    }

    function getStakerInfo(
        uint256 assetId,
        address staker
    ) public view returns (Staker memory) {
        if (stakerMaxHeap[assetId].length == 0) {
            return Staker(staker, 0, 0, 0, 0, 0);
        }
        Staker memory _staker = stakerMaxHeap[assetId][
            stakerIndex[assetId][staker]
        ];

        if (_staker.staker == staker) {
            return _staker;
        }
        return Staker(staker, 0, 0, 0, 0, 0);
    }

    function _updateStake(
        uint256 assetId,
        address staker,
        uint256 amount
    ) private {
        uint256 heapLength = stakerMaxHeap[assetId].length;

        uint256 currentIndex = stakerIndex[assetId][staker];
        Staker memory currentStaker = stakerMaxHeap[assetId][currentIndex];

        // update stake info
        if (amount > currentStaker.amount) {
            stakerMaxHeap[assetId][currentIndex].amount = amount;
            // up
            while (currentIndex > 0) {
                uint256 parentIndex = (currentIndex - 1) / 2;
                if (
                    stakerMaxHeap[assetId][currentIndex].amount <=
                    stakerMaxHeap[assetId][parentIndex].amount
                ) {
                    break;
                }
                _swapStaker(assetId, currentIndex, parentIndex);
                currentIndex = parentIndex;
            }
        } else if (amount < currentStaker.amount) {
            stakerMaxHeap[assetId][currentIndex].amount = amount;
            // down
            while (true) {
                uint256 leftChildIndex = 2 * currentIndex + 1;
                uint256 rightChildIndex = 2 * currentIndex + 2;

                uint256 largestIndex = currentIndex;

                if (
                    leftChildIndex < heapLength &&
                    stakerMaxHeap[assetId][leftChildIndex].amount >
                    stakerMaxHeap[assetId][currentIndex].amount &&
                    (rightChildIndex >= heapLength ||
                        (stakerMaxHeap[assetId][leftChildIndex].amount >
                            stakerMaxHeap[assetId][rightChildIndex].amount))
                ) {
                    largestIndex = leftChildIndex;
                } else if (
                    rightChildIndex < heapLength &&
                    stakerMaxHeap[assetId][rightChildIndex].amount >
                    stakerMaxHeap[assetId][currentIndex].amount
                ) {
                    largestIndex = rightChildIndex;
                }

                if (largestIndex == currentIndex) {
                    break;
                }
                _swapStaker(assetId, largestIndex, currentIndex);
                currentIndex = largestIndex;
            }
        }
    }

    function _insertStaker(
        uint256 assetId,
        address staker,
        uint256 amount
    ) private returns (uint256) {
        Staker memory newStaker = Staker(staker, amount, 0, 0, 0, 0);
        stakerMaxHeap[assetId].push(newStaker);

        uint256 currentIndex = stakerMaxHeap[assetId].length - 1;
        stakerIndex[assetId][staker] = currentIndex;

        while (currentIndex > 0) {
            uint256 parentIndex = (currentIndex - 1) / 2;
            if (
                stakerMaxHeap[assetId][currentIndex].amount <=
                stakerMaxHeap[assetId][parentIndex].amount
            ) {
                break;
            }
            _swapStaker(assetId, currentIndex, parentIndex);
            currentIndex = parentIndex;
        }
        return currentIndex;
    }

    function _swapStaker(
        uint256 assetId,
        uint256 index1,
        uint256 index2
    ) private {
        // swap the nodes
        Staker memory temp = stakerMaxHeap[assetId][index1];
        stakerMaxHeap[assetId][index1] = stakerMaxHeap[assetId][index2];
        stakerMaxHeap[assetId][index2] = temp;

        // update index
        stakerIndex[assetId][stakerMaxHeap[assetId][index1].staker] = index1;
        stakerIndex[assetId][stakerMaxHeap[assetId][index2].staker] = index2;
    }

    // ================================ ip-share price calculate lib =================================
    /**
     * @dev calculate the eth price when user buy amount ipshares
     * @param supply the current supply of ipshare
     * @param amount the amount user will buy
     * @return price the eth amount as wei will cost
     */
    function getPrice(
        uint256 supply,
        uint256 amount
    ) public pure returns (uint256) {
        uint256 price = (amount *
            (amount ** 2 + 3 * amount * supply + 3 * (supply ** 2)));
        return price / 640000000 / 3e36;
    }

    function getBuyPrice(
        uint256 assetId,
        uint256 amount
    ) public view override returns (uint256) {
        return getPrice(ipshareSupply[assetId], amount);
    }

    function getSellPrice(
        uint256 assetId,
        uint256 amount
    ) public view override returns (uint256) {
        return getPrice((ipshareSupply[assetId] - amount), amount);
    }

    function getBuyPriceAfterFee(
        uint256 assetId,
        uint256 amount
    ) public view override returns (uint256) {
        uint256 price = getBuyPrice(assetId, amount);
        uint256 donutFee = (price * donutFeePercent) / 10000;
        uint256 subjectFee = (price * subjectFeePercent) / 10000;
        uint256 bitipFee = (price * bitipFeePercent) / 10000;
        return price + donutFee + subjectFee + bitipFee;
    }

    function getSellPriceAfterFee(
        uint256 assetId,
        uint256 amount
    ) public view override returns (uint256) {
        uint256 price = getSellPrice(assetId, amount);
        uint256 donutFee = (price * donutFeePercent) / 10000;
        uint256 subjectFee = (price * subjectFeePercent) / 10000;
        uint256 bitipFee = (price * bitipFeePercent) / 10000;
        return price - donutFee - subjectFee - bitipFee;
    }

    /**
     * Calculate how many ipshare received by payed eth
     */
    function getBuyAmountByValue(
        uint256 supply,
        uint256 ethAmount
    ) public pure override returns (uint256) {
        return floorCbrt(ethAmount * 640000000 * 3e36 + supply ** 3) - supply;
    }

    function floorCbrt(uint256 n) internal pure returns (uint256) {
        unchecked {
            uint256 x = 0;
            for (uint256 y = 1 << 255; y > 0; y >>= 3) {
                x <<= 1;
                uint256 z = 3 * x * (x + 1) + 1;
                if (n / y >= z) {
                    n -= y * z;
                    x += 1;
                }
            }
            return x;
        }
    }

    function getAssetId(
        uint128 assetType,
        uint128 id
    ) public pure returns (uint256) {
        uint256 newId = uint256(id);
        return newId + (uint256(assetType) << 128);
    }

    function getAssetById(
        uint256 assetId
    ) public pure returns (uint128, uint128) {
        return (uint128(assetId >> 128), uint128(assetId & ((1 << 128) - 1)));
    }
}
