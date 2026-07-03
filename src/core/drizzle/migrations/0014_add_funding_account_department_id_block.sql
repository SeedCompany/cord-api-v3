-- Links each funding account to its (deterministic) department ID block so
-- SetDepartmentId can resolve project → primary location → funding account →
-- block. Blocks are created/maintained by the funding account repository:
-- range [accountNumber * 10000 + 11, (accountNumber + 1) * 10000 - 1],
-- programs {MomentumTranslation, Internship}.
ALTER TABLE "funding_accounts"
  ADD COLUMN "department_id_block_id" text REFERENCES "department_id_blocks"("id");

-- FK index up front (mono backfilled it in 0028; index-every-FK standard).
CREATE INDEX "funding_accounts_department_id_block_id_idx"
  ON "funding_accounts" ("department_id_block_id");
