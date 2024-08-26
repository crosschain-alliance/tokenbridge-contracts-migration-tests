// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

interface IPermittableToken {
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Burn(address indexed burner, uint256 value);
    event Mint(address indexed to, uint256 amount);
    event MintFinished();
    event OwnershipRenounced(address indexed previousOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Transfer(address indexed from, address indexed to, uint256 value, bytes data);
    event Transfer(address indexed from, address indexed to, uint256 value);

    function DOMAIN_SEPARATOR() external view returns (bytes32);
    function PERMIT_TYPEHASH() external view returns (bytes32);
    function PERMIT_TYPEHASH_LEGACY() external view returns (bytes32);
    function allowance(address _owner, address _spender) external view returns (uint256);
    function approve(address _to, uint256 _value) external returns (bool result);
    function balanceOf(address _owner) external view returns (uint256);
    function bridgeContract() external view returns (address);
    function burn(uint256 _value) external;
    function claimTokens(address _token, address _to) external;
    function decimals() external view returns (uint8);
    function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool);
    function decreaseApproval(address _spender, uint256 _subtractedValue) external returns (bool);
    function expirations(address, address) external view returns (uint256);
    function finishMinting() external returns (bool);
    function getTokenInterfacesVersion() external pure returns (uint64 major, uint64 minor, uint64 patch);
    function increaseAllowance(address _to, uint256 _addedValue) external returns (bool result);
    function increaseApproval(address _spender, uint256 _addedValue) external returns (bool);
    function isBridge(address _address) external view returns (bool);
    function mint(address _to, uint256 _amount) external returns (bool);
    function mintingFinished() external view returns (bool);
    function move(address _from, address _to, uint256 _amount) external;
    function name() external view returns (string memory);
    function nonces(address) external view returns (uint256);
    function owner() external view returns (address);
    function permit(
        address _holder,
        address _spender,
        uint256 _nonce,
        uint256 _expiry,
        bool _allowed,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external;
    function permit(
        address _holder,
        address _spender,
        uint256 _value,
        uint256 _deadline,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external;
    function pull(address _from, uint256 _amount) external;
    function push(address _to, uint256 _amount) external;
    function renounceOwnership() external;
    function setBridgeContract(address _bridgeContract) external;
    function symbol() external view returns (string memory);
    function totalSupply() external view returns (uint256);
    function transfer(address _to, uint256 _value) external returns (bool);
    function transferAndCall(address _to, uint256 _value, bytes memory _data) external returns (bool);
    function transferFrom(address _sender, address _recipient, uint256 _amount) external returns (bool);
    function transferOwnership(address _newOwner) external;
    function version() external view returns (string memory);
}
