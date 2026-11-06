// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// The slice of ENSv2's UserRegistry (PermissionedRegistry) this contract calls.
interface IUserRegistry {
    function register(
        string calldata label,
        address owner,
        address registry,
        address resolver,
        uint256 roleBitmap,
        uint64 expiry
    ) external returns (uint256 tokenId);

    /// 0 = AVAILABLE, 1 = RESERVED, 2 = REGISTERED.
    function getStatus(uint256 anyId) external view returns (uint8);
}

/// The slice of ENSv2's PermissionedResolver this contract calls.
interface IPermissionedResolver {
    /// `name` is DNS-encoded.
    function setAddress(bytes calldata name, uint256 coinType, bytes calldata addressBytes) external;
}

/// @title RumaRegistrar
/// @notice Gives each Ruma wallet one permanent username under rumalatam.eth.
///
///         ENS is the only record of who owns which name, so this contract
///         enforces the rules a database would otherwise enforce:
///         - one name per address (`labelOf`),
///         - a name is never issued twice, even after an admin unregisters it (`used`),
///         - names are 3-20 characters of a-z and 0-9.
///
///         Roles it needs:
///         - `ROLE_REGISTRAR` on the UserRegistry attached to rumalatam.eth,
///         - `ROLE_SET_ADDRESS` (root) on the PermissionedResolver used for subnames.
///
///         Only `claimer` (the server's writer wallet) can claim. If that key
///         leaks, `admin` (a cold wallet or Safe) replaces it with `setClaimer`.
///         A leaked claimer can create new names but cannot change existing ones.
contract RumaRegistrar {
    uint256 public constant COIN_TYPE_ETH = 60;
    /// ENSIP-11 coin type for Base (chain 8453).
    uint256 public constant COIN_TYPE_BASE = 0x80000000 | 8453;
    uint256 public constant MIN_LENGTH = 3;
    uint256 public constant MAX_LENGTH = 20;

    uint64 private constant NEVER_EXPIRES = type(uint64).max;
    uint8 private constant STATUS_AVAILABLE = 0;

    IUserRegistry public immutable registry;
    IPermissionedResolver public immutable resolver;
    /// DNS-encoded parent, e.g. 0x0972756d616c6174616d0365746800 for "rumalatam.eth".
    bytes public parentName;

    address public admin;
    address public claimer;

    mapping(address account => string label) public labelOf;
    mapping(bytes32 labelHash => bool) public used;

    event Claimed(string label, address indexed account);
    event ClaimerChanged(address indexed claimer);
    event AdminChanged(address indexed admin);

    error Unauthorized();
    error ZeroAddress();
    error InvalidLabel(string label);
    error AlreadyHasName(address account);
    error LabelUsed(string label);

    constructor(
        IUserRegistry registry_,
        IPermissionedResolver resolver_,
        bytes memory parentName_,
        address admin_,
        address claimer_
    ) {
        if (address(registry_) == address(0) || address(resolver_) == address(0)) revert ZeroAddress();
        if (admin_ == address(0) || claimer_ == address(0)) revert ZeroAddress();
        registry = registry_;
        resolver = resolver_;
        parentName = parentName_;
        admin = admin_;
        claimer = claimer_;
        emit AdminChanged(admin_);
        emit ClaimerChanged(claimer_);
    }

    /// @notice Registers `label`.rumalatam.eth to `account` and points its
    ///         Ethereum and Base addresses at it.
    function claim(string calldata label, address account) external {
        if (msg.sender != claimer) revert Unauthorized();
        if (account == address(0)) revert ZeroAddress();
        if (!isValidLabel(label)) revert InvalidLabel(label);
        if (bytes(labelOf[account]).length != 0) revert AlreadyHasName(account);

        bytes32 labelHash = keccak256(bytes(label));
        if (used[labelHash]) revert LabelUsed(label);
        used[labelHash] = true;
        labelOf[account] = label;

        // Reverts with LabelAlreadyRegistered / LabelAlreadyReserved if taken.
        // Role bitmap 0: the owner cannot transfer the name or repoint it.
        registry.register(label, account, address(0), address(resolver), 0, NEVER_EXPIRES);

        bytes memory name = abi.encodePacked(uint8(bytes(label).length), label, parentName);
        bytes memory addressBytes = abi.encodePacked(account);
        resolver.setAddress(name, COIN_TYPE_ETH, addressBytes);
        resolver.setAddress(name, COIN_TYPE_BASE, addressBytes);

        emit Claimed(label, account);
    }

    /// @notice Whether `label` could be claimed right now.
    function isAvailable(string calldata label) external view returns (bool) {
        if (!isValidLabel(label)) return false;
        bytes32 labelHash = keccak256(bytes(label));
        return !used[labelHash] && registry.getStatus(uint256(labelHash)) == STATUS_AVAILABLE;
    }

    /// @notice 3-20 characters, each a-z or 0-9. Plain ASCII rules out lookalike names.
    function isValidLabel(string calldata label) public pure returns (bool) {
        bytes calldata b = bytes(label);
        if (b.length < MIN_LENGTH || b.length > MAX_LENGTH) return false;
        for (uint256 i; i < b.length; ++i) {
            bytes1 c = b[i];
            bool digit = c >= "0" && c <= "9";
            bool lower = c >= "a" && c <= "z";
            if (!digit && !lower) return false;
        }
        return true;
    }

    function setClaimer(address claimer_) external {
        if (msg.sender != admin) revert Unauthorized();
        if (claimer_ == address(0)) revert ZeroAddress();
        claimer = claimer_;
        emit ClaimerChanged(claimer_);
    }

    function setAdmin(address admin_) external {
        if (msg.sender != admin) revert Unauthorized();
        if (admin_ == address(0)) revert ZeroAddress();
        admin = admin_;
        emit AdminChanged(admin_);
    }
}
