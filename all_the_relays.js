const https = require('https');
const { ethers, Wallet, providers } = require('ethers');
const { FlashbotsBundleProvider } = require('@flashbots/ethers-provider-bundle');

const ETHEREUM_RPC_URL = 'https://virtual.mainnet.rpc.tenderly.co/c4e60e60-6398-4e23-9ffc-f48f66d9706e';
const PRIVATE_KEY = '03680460bd83d52a2be9932b4b1e1f2251d6d56481eaa23e5f364194ca04fbf3';

const relays = [
    'boost-relay.flashbots.net',
    'relay.edennetwork.io',
    'mainnet-relay.securerpc.com',
    'relay.ultrasound.money',
    'relay.wenmerge.com',
    'proof-relay.ponrelay.com'
];

const addresses = [
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
    '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
    '0x16e3B07f69fc42eF99bcfb1CE9CA15BEa61e2F97'  // Arbitrage Executor
];

const [
    WETH_ADDRESS,
    USDC_ADDRESS,
    DAI_ADDRESS,
    ARBITRAGE_EXECUTOR_ADDRESS
] = addresses.map(address => ethers.utils.getAddress(address));

const provider = new providers.JsonRpcProvider(ETHEREUM_RPC_URL);
const wallet = new Wallet(PRIVATE_KEY, provider);

const authSigner = Wallet.createRandom();

async function fetchAndVerifyNonce() {
    const nonce = await provider.getTransactionCount(wallet.address, 'latest');
    console.log(`Fetched Nonce: ${nonce}`);
    return nonce;
}

async function monitorBundleStatus(bundleHash, startBlockNumber) {
    console.log(`Monitoring bundle status for ${bundleHash} starting from block ${startBlockNumber}`);
    while (true) {
        const currentBlockNumber = await provider.getBlockNumber();
        if (currentBlockNumber > startBlockNumber + 1) {
            console.log(`Bundle ${bundleHash} was not included in block ${startBlockNumber + 1}`);
            break;
        }
        const statusPayload = {
            method: "eth_callBundle",
            params: [{
                txs: [],
                blockNumber: ethers.utils.hexlify(currentBlockNumber),
                stateBlockNumber: "latest"
            }],
            id: 1,
            jsonrpc: "2.0"
        };

        const options = {
            hostname: FLASHBOTS_RELAY_URL,
            port: 443,
            path: '/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(JSON.stringify(statusPayload))
            }
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.result && response.result.bundleHash === bundleHash) {
                        console.log(`Bundle ${bundleHash} included in block ${currentBlockNumber}`);
                        console.log('Response:', response);
                        process.exit(0);
                    } else {
                        console.log(`Bundle ${bundleHash} not included in block ${currentBlockNumber}`);
                    }
                } catch (e) {
                    console.error('Error parsing response:', data);
                }
            });
        });

        req.on('error', (e) => {
            console.error('Request Error:', e);
        });

        req.write(JSON.stringify(statusPayload));
        req.end();

        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait for 10 seconds before next check
    }
}
async function testRelays() {
    for (const relay of relays) {
        console.log(`Testing relay: ${relay}`);
        await submitBundle(relay);
    }
}
async function submitBundle(relayUrl) {
    try {
        const abi = new ethers.utils.Interface([
            "function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut)"
        ]);

        const swapWETHToUSDCData = abi.encodeFunctionData("exactInputSingle", [{
            tokenIn: WETH_ADDRESS,
            tokenOut: USDC_ADDRESS,
            fee: 3000,
            recipient: wallet.address,
            deadline: Math.floor(Date.now() / 1000) + 60 * 20,
            amountIn: ethers.utils.parseUnits('1', 18),
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        }]);

        const swapUSDCToDAIData = abi.encodeFunctionData("exactInputSingle", [{
            tokenIn: USDC_ADDRESS,
            tokenOut: DAI_ADDRESS,
            fee: 3000,
            recipient: wallet.address,
            deadline: Math.floor(Date.now() / 1000) + 60 * 20,
            amountIn: ethers.utils.parseUnits('1000', 6),
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        }]);

        const swapDAIToWETHData = abi.encodeFunctionData("exactInputSingle", [{
            tokenIn: DAI_ADDRESS,
            tokenOut: WETH_ADDRESS,
            fee: 3000,
            recipient: wallet.address,
            deadline: Math.floor(Date.now() / 1000) + 60 * 20,
            amountIn: ethers.utils.parseUnits('1000', 18),
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        }]);

        const nonce = await fetchAndVerifyNonce();
        console.log(`Current Nonce: ${nonce}`);

        const transactions = [
            {
                to: ARBITRAGE_EXECUTOR_ADDRESS,
                data: swapWETHToUSDCData,
                value: ethers.utils.parseEther('0').toHexString(),
                gasLimit: ethers.utils.hexlify(500000),
                gasPrice: ethers.utils.hexlify(ethers.utils.parseUnits('200', 'gwei')),
                nonce: nonce
            },
            {
                to: ARBITRAGE_EXECUTOR_ADDRESS,
                data: swapUSDCToDAIData,
                value: ethers.utils.parseEther('0').toHexString(),
                gasLimit: ethers.utils.hexlify(500000),
                gasPrice: ethers.utils.hexlify(ethers.utils.parseUnits('200', 'gwei')),
                nonce: nonce + 1
            },
            {
                to: ARBITRAGE_EXECUTOR_ADDRESS,
                data: swapDAIToWETHData,
                value: ethers.utils.parseEther('0').toHexString(),
                gasLimit: ethers.utils.hexlify(500000),
                gasPrice: ethers.utils.hexlify(ethers.utils.parseUnits('200', 'gwei')),
                nonce: nonce + 2
            }
        ];

        console.log('Transaction Objects:', transactions);

        const signedTransactions = await Promise.all(transactions.map(async (tx, index) => {
            const signedTx = await wallet.signTransaction(tx);
            console.log(`Signed Transaction ${index + 1}: ${signedTx}`);
            return signedTx;
        }));

        const blockNumber = await provider.getBlockNumber();
        const targetBlockNumber = ethers.utils.hexStripZeros(ethers.utils.hexlify(blockNumber + 1));
        const payload = {
            method: "eth_sendBundle",
            params: [
                {
                    txs: signedTransactions,
                    blockNumber: targetBlockNumber
                }
            ],
            id: 42,
            jsonrpc: "2.0"
        };

        const payloadString = JSON.stringify(payload);
        const payloadHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(payloadString));
        const signature = await authSigner.signMessage(payloadHash);

        console.log('Constructed Payload:', payload);
        console.log('Payload Hash:', payloadHash);
        console.log('Generated Signature:', signature);

        const options = {
            hostname: relayUrl,
            port: 443,
            path: '/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payloadString),
                'X-Flashbots-Signature': `${authSigner.address}:${signature}`
            }
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                console.log('Raw Response:', data);
                try {
                    const response = JSON.parse(data);
                    console.log('Response:', response);
                    if (response.result && response.result.bundleHash) {
                        monitorBundleStatus(response.result.bundleHash, blockNumber);
                    }
                } catch (e) {
                    console.error('Error parsing response:', data);
                }
            });
        });

        req.on('error', (e) => {
            console.error('Request Error:', e);
        });

        req.write(payloadString);
        req.end();

    } catch (error) {
        console.error('Error:', error);
    }
}

testRelays().catch((error) => {
    console.error('Unhandled Error:', error);
});

console.log(`Auth Signer Address: ${authSigner.address}`);
console.log(`Auth Signer Private Key: ${authSigner.privateKey}`);