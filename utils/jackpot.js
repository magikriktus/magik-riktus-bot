/**
 * Récupère le montant actuel du Jackpot progressif
 */
export async function getJackpot(pool) {
  const res = await pool.query('SELECT amount FROM jackpot_pool WHERE id = 1');
  return Number(res.rows[0]?.amount || 0);
}

/**
 * Ajoute du montant au Jackpot (ex: 50% de la perte d'un joueur)
 */
export async function addToJackpot(amount, pool) {
  if (amount <= 0) return;
  await pool.query(
    'UPDATE jackpot_pool SET amount = amount + $1 WHERE id = 1',
    [amount],
  );
}

/**
 * Retire un montant spécifique du Jackpot (en gardant au minimum le montant de départ)
 */
export async function removeFromJackpot(amount, pool) {
  if (amount <= 0) return;
  await pool.query(
    'UPDATE jackpot_pool SET amount = GREATEST(100, amount - $1) WHERE id = 1',
    [amount],
  );
}

/**
 * Réinitialise le Jackpot après qu'il a été intégralement remporté
 */
export async function resetJackpot(startingAmount = 100, pool) {
  await pool.query('UPDATE jackpot_pool SET amount = $1 WHERE id = 1', [
    startingAmount,
  ]);
}
