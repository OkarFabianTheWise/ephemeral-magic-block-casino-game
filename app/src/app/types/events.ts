import { web3, BN } from "@coral-xyz/anchor";

export interface DiceRolledEvent {
  player: web3.PublicKey;
  result: number;
  won: boolean;
  payout: BN;
}