import { BN, web3 } from "@coral-xyz/anchor";

export interface PlatformStats {
  lastReset: BN;
  withdrawnToday: BN;
  admin: web3.PublicKey;
}

export interface Player {
  lastResult: number;
  currentBet: number;
  lastBetAmount: BN;
  pendingWithdrawal: BN;
  wins: number;
  losses: number;
  totalGames: number;
}