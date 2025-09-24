// Contract configuration
const CONTRACT_ADDRESS = '0xdD158B8A76566bC0c342893568e8fd3F08A9dAac';
const NFT_CONTRACT_ADDRESS = '0xd0f4E1265Edd221b5bb0e8667a59f31B587B2197';
const CHAIN_ID = 42161;
const RPC_URL = 'https://arb-mainnet.g.alchemy.com/v2/Q5MUXKn-PR2713ZRSm6L4';

// Contract ABI - only including the functions we need
const CONTRACT_ABI = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_operator",
                "type": "address"
            },
            {
                "internalType": "uint256[]",
                "name": "_tokenIds",
                "type": "uint256[]"
            }
        ],
        "name": "delegateNfts",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_address",
                "type": "address"
            },
            {
                "internalType": "uint256[]",
                "name": "_tokenIds",
                "type": "uint256[]"
            },
            {
                "internalType": "bool",
                "name": "_byOperator",
                "type": "bool"
            }
        ],
        "name": "undelegateNfts",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_delegator",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "_operator",
                "type": "address"
            }
        ],
        "name": "getDelegatorInfo",
        "outputs": [
            {
                "internalType": "uint256[]",
                "name": "",
                "type": "uint256[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

// ERC721 ABI for NFT contract
const NFT_ABI = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "owner",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "operator",
                "type": "address"
            }
        ],
        "name": "isApprovedForAll",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "operator",
                "type": "address"
            },
            {
                "internalType": "bool",
                "name": "approved",
                "type": "bool"
            }
        ],
        "name": "setApprovalForAll",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

let web3;
let contract;
let nftContract;
let userAccount;

// Initialize the app
window.addEventListener('load', async () => {
    const connectBtn = document.getElementById('connectWallet');
    const delegateBtn = document.getElementById('delegateBtn');
    const undelegateBtn = document.getElementById('undelegateBtn');
    const checkDelegationBtn = document.getElementById('checkDelegationBtn');
    const approveBtn = document.getElementById('approveBtn');

    connectBtn.addEventListener('click', handleWalletButton);
    delegateBtn.addEventListener('click', delegateNFTs);
    undelegateBtn.addEventListener('click', undelegateNFTs);
    checkDelegationBtn.addEventListener('click', checkDelegation);
    approveBtn.addEventListener('click', approveAll);

    // Check if Web3 is injected
    if (typeof window.ethereum !== 'undefined') {
        web3 = new Web3(window.ethereum);

        // Check if already connected
        const accounts = await web3.eth.getAccounts();
        if (accounts.length > 0) {
            await handleAccountsChanged(accounts);
        }

        // Listen for account changes
        window.ethereum.on('accountsChanged', handleAccountsChanged);

        // Listen for chain changes
        window.ethereum.on('chainChanged', () => {
            window.location.reload();
        });
    } else {
        alert('Please install MetaMask to use this application!');
    }
});

// Handle wallet button click (connect/disconnect)
function handleWalletButton() {
    if (userAccount) {
        disconnectWallet();
    } else {
        connectWallet();
    }
}

// Disconnect wallet
function disconnectWallet() {
    userAccount = null;

    // Update UI
    document.getElementById('connectWallet').textContent = 'Connect Wallet';
    document.getElementById('walletAddress').textContent = '';
    document.getElementById('delegateBtn').disabled = true;
    document.getElementById('undelegateBtn').disabled = true;
    document.getElementById('checkDelegationBtn').disabled = true;
    document.getElementById('approvalCard').style.display = 'none';
    document.getElementById('delegationInfo').style.display = 'none';
    document.getElementById('transactionStatus').style.display = 'none';

    // Clear form inputs
    document.getElementById('operatorAddress').value = '';
    document.getElementById('tokenIds').value = '';
}

async function connectWallet() {
    console.log("Connecting wallet...");

    // Verify the Ethereum provider exists
    if (typeof window.ethereum === 'undefined') {
        alert('Please install MetaMask or another Ethereum wallet.');
        return;
    }

    try {
        // Request account access
        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts'
        });

        // Ensure wallet has at least one account
        if (!accounts || accounts.length === 0) {
            throw new Error("No account found. Please ensure your wallet has at least one account.");
        }
        console.log("Connected accounts:", accounts);

        // Get the current chain ID (returned as a hex string)
        const currentChainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        const currentChainId = parseInt(currentChainIdHex, 16);

        // Check if on the correct chain; if not, attempt to switch networks
        if (currentChainId !== CHAIN_ID) {
            await switchNetwork();
        }

        console.log("Connected account:", accounts[0]);
        await handleAccountsChanged(accounts);

    } catch (error) {
        console.error('Error connecting wallet:', error);
        showStatus('Failed to connect wallet: ' + error.message, 'error');
    }
}

async function switchNetwork() {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xA4B1' }], // 16601 in hex
        });
    } catch (switchError) {
        // This error code indicates that the chain has not been added to MetaMask
        if (switchError.code === 4902) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: '0xA4B1', // 42161
                        chainName: 'Arbitrum One',
                        nativeCurrency: {
                            name: 'Ethereum',
                            symbol: 'ETH',
                            decimals: 18,
                        },
                        rpcUrls: [RPC_URL],
                        blockExplorerUrls: ['https://arbiscan.io'],
                    }],
                });
            } catch (addError) {
                throw new Error('Failed to add Arbitrum network to MetaMask');
            }
        } else {
            throw switchError;
        }
    }
}

async function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        // User disconnected
        userAccount = null;
        document.getElementById('connectWallet').textContent = 'Connect Wallet';
        document.getElementById('walletAddress').textContent = '';
        document.getElementById('delegateBtn').disabled = true;
        document.getElementById('undelegateBtn').disabled = true;
        document.getElementById('checkDelegationBtn').disabled = true;
    } else {
        userAccount = accounts[0];
        document.getElementById('connectWallet').textContent = 'Disconnect';
        document.getElementById('walletAddress').textContent =
            userAccount.substring(0, 6) + '...' + userAccount.substring(38);

        // Enable buttons
        document.getElementById('delegateBtn').disabled = false;
        document.getElementById('undelegateBtn').disabled = false;
        document.getElementById('checkDelegationBtn').disabled = false;

        // Initialize contracts
        if (CONTRACT_ADDRESS && NFT_CONTRACT_ADDRESS) {
            contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
            nftContract = new web3.eth.Contract(NFT_ABI, NFT_CONTRACT_ADDRESS);

            // Check approval status
            await checkApprovalStatus();
        } else {
            showStatus('Please add the contract addresses in app.js', 'error');
        }
    }
}

function parseTokenIds(input) {
    return input
        .split(',')
        .map(id => id.trim())
        .filter(id => id !== '')
        .map(id => {
            const num = parseInt(id);
            if (isNaN(num) || num < 0) {
                throw new Error(`Invalid token ID: ${id}`);
            }
            return num;
        });
}

async function delegateNFTs() {
    try {
        const operatorAddress = document.getElementById('operatorAddress').value.trim();
        const tokenIdsInput = document.getElementById('tokenIds').value.trim();

        // Validate inputs
        if (!web3.utils.isAddress(operatorAddress)) {
            throw new Error('Invalid operator address');
        }

        if (!tokenIdsInput) {
            throw new Error('Please enter token IDs');
        }

        const tokenIds = parseTokenIds(tokenIdsInput);

        if (tokenIds.length === 0) {
            throw new Error('Please enter at least one token ID');
        }

        if (!contract) {
            throw new Error('Contract not initialized. Please add contract address.');
        }

        showStatus('Preparing delegation transaction...', 'pending');

        // Call the delegate function
        const tx = await contract.methods
            .delegateNfts(operatorAddress, tokenIds)
            .send({ from: userAccount });

        showStatus('NFTs delegated successfully!', 'success');
        showTransactionHash(tx.transactionHash);

    } catch (error) {
        console.error('Error delegating NFTs:', error);
        showStatus('Failed to delegate NFTs: ' + error.message, 'error');
    }
}

async function undelegateNFTs() {
    try {
        const operatorAddress = document.getElementById('operatorAddress').value.trim();
        const tokenIdsInput = document.getElementById('tokenIds').value.trim();

        // Validate inputs
        if (!web3.utils.isAddress(operatorAddress)) {
            throw new Error('Invalid operator address');
        }

        if (!tokenIdsInput) {
            throw new Error('Please enter token IDs');
        }

        const tokenIds = parseTokenIds(tokenIdsInput);

        if (tokenIds.length === 0) {
            throw new Error('Please enter at least one token ID');
        }

        if (!contract) {
            throw new Error('Contract not initialized. Please add contract address.');
        }

        showStatus('Preparing undelegate transaction...', 'pending');

        console.log("operatorAddress", operatorAddress);
        console.log("tokenIds", tokenIds);
        console.log("byOperator", false);
        console.log("call from userAccount", userAccount);

        // Call the undelegate function (byOperator = false for user-initiated)
        const tx = await contract.methods
            .undelegateNfts(operatorAddress, tokenIds, false)
            .send({ from: userAccount });

        showStatus('NFTs undelegated successfully!', 'success');
        showTransactionHash(tx.transactionHash);

    } catch (error) {
        console.error('Error undelegating NFTs:', error);
        showStatus('Failed to undelegate NFTs: ' + error.message, 'error');
    }
}

function showStatus(message, type) {
    const statusDiv = document.getElementById('transactionStatus');
    const statusMessage = document.getElementById('statusMessage');

    statusDiv.style.display = 'block';
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;

    // Clear transaction hash if showing a new status
    if (type === 'pending') {
        document.getElementById('txHash').innerHTML = '';
    }
}

function showTransactionHash(hash) {
    const txHashDiv = document.getElementById('txHash');
    txHashDiv.innerHTML = `Transaction Hash: <a href="#" onclick="copyToClipboard('${hash}')">${hash}</a>`;
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Transaction hash copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

// Check delegation status
async function checkDelegation() {
    try {
        const operatorAddress = document.getElementById('operatorAddress').value.trim();

        // Validate operator address
        if (!web3.utils.isAddress(operatorAddress)) {
            throw new Error('Invalid operator address');
        }

        if (!contract) {
            throw new Error('Contract not initialized');
        }

        // Call getDelegatorInfo
        const delegatedTokens = await contract.methods
            .getDelegatorInfo(userAccount, operatorAddress)
            .call();

        // Display delegation info
        const delegationDiv = document.getElementById('delegationInfo');
        const delegationStatus = document.getElementById('delegationStatus');

        delegationDiv.style.display = 'block';

        if (delegatedTokens.length === 0) {
            delegationStatus.innerHTML = `
                <p>No tokens delegated to <code>${operatorAddress}</code></p>
            `;
        } else {
            const tokenList = delegatedTokens.join(', ');
            delegationStatus.innerHTML = `
                <p><strong>Delegated Tokens to ${operatorAddress.substring(0, 6)}...${operatorAddress.substring(38)}:</strong></p>
                <p class="token-list">Token IDs: ${tokenList}</p>
                <p class="token-count">Total: ${delegatedTokens.length} token(s)</p>
            `;
        }

    } catch (error) {
        console.error('Error checking delegation:', error);
        showStatus('Failed to check delegation: ' + error.message, 'error');
    }
}

// Check if user has approved the contract
async function checkApprovalStatus() {
    try {
        const isApproved = await nftContract.methods
            .isApprovedForAll(userAccount, CONTRACT_ADDRESS)
            .call();

        const approvalCard = document.getElementById('approvalCard');
        const delegateBtn = document.getElementById('delegateBtn');
        const undelegateBtn = document.getElementById('undelegateBtn');

        if (!isApproved) {
            // Show approval card
            approvalCard.style.display = 'block';
            // Disable delegate/undelegate buttons
            delegateBtn.disabled = true;
            undelegateBtn.disabled = true;
            delegateBtn.title = 'Please approve the contract first';
            undelegateBtn.title = 'Please approve the contract first';
        } else {
            // Hide approval card
            approvalCard.style.display = 'none';
            // Enable buttons (if wallet is connected)
            if (userAccount) {
                delegateBtn.disabled = false;
                undelegateBtn.disabled = false;
                delegateBtn.title = '';
                undelegateBtn.title = '';
            }
        }
    } catch (error) {
        console.error('Error checking approval status:', error);
    }
}

// Approve all NFTs to the contract
async function approveAll() {
    try {
        showStatus('Preparing approval transaction...', 'pending');

        const tx = await nftContract.methods
            .setApprovalForAll(CONTRACT_ADDRESS, true)
            .send({ from: userAccount });

        showStatus('NFTs approved successfully!', 'success');
        showTransactionHash(tx.transactionHash);

        // Check approval status again
        await checkApprovalStatus();

    } catch (error) {
        console.error('Error approving NFTs:', error);
        showStatus('Failed to approve NFTs: ' + error.message, 'error');
    }
}