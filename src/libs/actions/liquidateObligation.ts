import {
  ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  Account,
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { Market } from '@solendprotocol/common';
import { getTokenInfo } from 'libs/utils';
import { findWhere, map } from 'underscore';
import { refreshReserveInstruction } from 'models/instructions/refreshReserve';
import { liquidateObligationInstruction } from 'models/instructions/liquidateObligation';
import { refreshObligationInstruction } from 'models/instructions/refreshObligation';
import { config } from 'config';

export const liquidateObligation = async (
  connection: Connection,
  payer: Account,
  liquidityAmount: number,
  repayTokenSymbol: string,
  withdrawTokenSymbol: string,
  lendingMarket: Market,
  obligation: any,
) => {
  const ixs: TransactionInstruction[] = [];

  const depositReserves = map(obligation.info.deposits, (deposit) => deposit.depositReserve);
  const borrowReserves = map(obligation.info.borrows, (borrow) => borrow.borrowReserve);
  const uniqReserveAddresses = [...new Set<String>(map(depositReserves.concat(borrowReserves), (reserve) => reserve.toString()))];
  uniqReserveAddresses.forEach((reserveAddress) => {
    const reserveInfo = findWhere(lendingMarket!.reserves, {
      address: reserveAddress,
    });
    const oracleInfo = findWhere(config.oracles.assets, {
      asset: reserveInfo!.asset,
    });
    const refreshReserveIx = refreshReserveInstruction(
      new PublicKey(reserveAddress),
      new PublicKey(oracleInfo!.priceAddress),
      new PublicKey(oracleInfo!.switchboardFeedAddress),
    );
    ixs.push(refreshReserveIx);
  });
  const refreshObligationIx = refreshObligationInstruction(
    obligation.pubkey,
    depositReserves,
    borrowReserves,
  );
  ixs.push(refreshObligationIx);

  const repayTokenInfo = getTokenInfo(repayTokenSymbol);

  // get account that will be repaying the reserve liquidity
  const repayAccount = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    new PublicKey(repayTokenInfo.mintAddress),
    payer.publicKey,
  );

  console.log("**DEBUG LOG*** //get account that will be repaying the reserve liquidity");
  console.log("***DEBUG LOG*** " + "repayAccount: " + repayAccount);
  console.log("***DEBUG LOG*** " + "ASSOCIATED_TOKEN_PROGRAM_ID: " + ASSOCIATED_TOKEN_PROGRAM_ID);
  console.log("***DEBUG LOG*** " + "TOKEN_PROGRAM_ID: " + TOKEN_PROGRAM_ID);
  console.log("***DEBUG LOG*** " + "new PublicKey(repayTokenInfo.mintAddress");
  console.log("***DEBUG LOG*** " + "repayTokenInfo.mintAddress: " + repayTokenInfo);
  console.log("***DEBUG LOG*** " + "payer.PublicKey: " + payer.publicKey);
 
  const repayReserve = findWhere(lendingMarket.reserves, { asset: repayTokenSymbol });
  const withdrawReserve = findWhere(lendingMarket.reserves, { asset: withdrawTokenSymbol });

  // get account that will be getting the obligation's token account in return
  const rewardedWithdrawalCollateralAccount = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    new PublicKey(withdrawReserve.collateralMintAddress),
    payer.publicKey,
  );

  console.log("***DEBUG LOG*** " + "rewardedWithdrawlCollateralAccount: " + rewardedWithdrawalCollateralAccount);
  console.log("***DEBUG LOG*** " + "Token.getAssociatedTokenAddress: " + Token.getAssociatedTokenAddress);
  console.log("***DEBUG LOG*** " + "ASSOCIATED_TOKEN_PROGRAM_ID: "+ ASSOCIATED_TOKEN_PROGRAM_ID);
  console.log("***DEBUG LOG*** " + "TOKEN PROGRAM_ID: " + TOKEN_PROGRAM_ID);
  console.log("***DEBUG LOG*** " + "new PublicKey(withdrawReserve.collateralMintAddress");
  console.log("***DEBUG LOG*** " + "withdrawReserve.collateralMintAddress" + withdrawReserve.collateralMintAddress);
  console.log("***DEBUG LOG*** " + "payer.publicKey: " + payer.publicKey);

  const rewardedWithdrawalCollateralAccountInfo = await connection.getAccountInfo(
    rewardedWithdrawalCollateralAccount,
  );
  if (!rewardedWithdrawalCollateralAccountInfo) {
    const createUserCollateralAccountIx = Token.createAssociatedTokenAccountInstruction(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      withdrawReserve.collateralMintAddress,
      rewardedWithdrawalCollateralAccount,
      payer.publicKey,
      payer.publicKey,
    );
    ixs.push(createUserCollateralAccountIx);
  }

  console.log("***DEBUG LOG***" + "rewardWithdrawalCollateralAccountInfo: " + rewardedWithdrawalCollateralAccountInfo);
  console.log("***DEBUG LOG***" + "connect.getAccountInfo: " + connection.getAccountInfo);
  console.log("***DEBUG LOG***" + "Token.createAssociatedTokenAccountInstruction: " + Token.createAssociatedTokenAccountInstruction);
  console.log("***DEBUG LOG***" + "ASSOCIATED_TOKEN_PROGRAM_ID: " + ASSOCIATED_TOKEN_PROGRAM_ID);
  console.log("***DEBUG LOG***" + "TOKEN_PROGRAM_ID" + TOKEN_PROGRAM_ID);
  console.log("***DEBUG LOG***" + "withdrawReserve.collateralMintAddress: " + withdrawReserve.collateralMintAddress);
  console.log("***DEBUG LOG***" + "rewardedWithdrawalCollateralAccount: " + rewardedWithdrawalCollateralAccount);
  console.log("***DEBUG LOG***" + "payer.publicKey: " + payer.publicKey);

  ixs.push(
    liquidateObligationInstruction(
      liquidityAmount,
      repayAccount,
      rewardedWithdrawalCollateralAccount,
      new PublicKey(repayReserve.address),
      new PublicKey(repayReserve.liquidityAddress),
      new PublicKey(withdrawReserve.address),
      new PublicKey(withdrawReserve.collateralSupplyAddress),
      obligation.pubkey,
      new PublicKey(lendingMarket.address),
      new PublicKey(lendingMarket.authorityAddress),
      payer.publicKey,
    ),
  );

  console.log("***DEBUG LOG***" + "liquidateObligationInstruction: " + liquidateObligationInstruction);
  console.log("***DEBUG LOG***" + "liquidityAccount: " + liquidityAmount);
  console.log("***DEBUG LOG***" + "repayAccount: " + repayAccount);
  console.log("***DEBUG LOG***" + "rewardedWithdrawalCollateralAccount: " + rewardedWithdrawalCollateralAccount);
  console.log("***DEBUG LOG***" + "repayReserve.address: " + repayReserve.address);
  console.log("***DEBUG LOG***" + "repayReserve.liquidityAddress: " + repayReserve.liquidityAddress);
  console.log("***DEBUG LOG***" + "withdrawReserve.address: " + withdrawReserve.address);
  console.log("***DEBUG LOG***" + "withdrawReserve.collateralSupplyAddress: " + withdrawReserve.collateralSupplyAddress);
  console.log("***DEBUG LOG***" + "obligation.pubkey: " + obligation.pubkey);
  console.log("***DEBUG LOG***" + "lendingMarket.address: " + lendingMarket.address);
  console.log("***DEBUG LOG***" + "lendingMarket.authorityAddress: " + lendingMarket.authorityAddress);
  console.log("***DEBUG LOG***" + "payer.publicKey: " + payer.publicKey);

  const tx = new Transaction().add(...ixs);
  const { blockhash } = await connection.getRecentBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer.publicKey;
  tx.sign(payer);

  console.log("***DEBUG LOG***" + "blockhash: " + blockhash);
  console.log("***DEBUG LOG***" + "tx.recentBlockhash: " + tx.recentBlockhash);
  console.log("***DEBUG LOG***" + "tx.feePayer: " + tx.feePayer);
  console.log("***DEBUG LOG***" + "tx.sign(payer): " + tx.sign(payer));

  const txHash = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(txHash, 'finalized');
  console.log(`liquidated obligation ${obligation.pubkey.toString()} in ${txHash}.
     repayToken: ${repayTokenSymbol}. withdrawToken: ${withdrawTokenSymbol}`);

  console.log("***DEBUG LOG***" + "txHash: " + txHash);
  console.log("***DEBUG LOG***" + "connection.sendRawTransaction(tx.serialize()): " + connection.sendRawTransaction(tx.serialize()));
  console.log("***DEBUG LOG***" + "connection.confirmTransaction(txHash, 'finalized'): " + connection.confirmTransaction(txHash, 'finalized'));
};
