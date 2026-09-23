/**
 * Récupère le solde d'un utilisateur
 *
 * @param {string} userId - L'ID Discord de l'utilisateur
 * @param {import('pg').Pool} pool - Le pool de connexion PostgreSQL
 * @returns {Promise<number>} Le solde actuel (0 si non trouvé)
 */
export async function getBalance(userId, pool) {
  try {
    const res = await pool.query(
      'SELECT balance FROM balances WHERE user_id = $1',
      [userId],
    );
    return res.rows.length ? Number(res.rows[0].balance) : 0;
  } catch (error) {
    console.error('❌ Erreur SQL lors de la récupération du solde :', error);
    throw new Error('Impossible de récupérer le solde.');
  }
}

/**
 * Ajoute un montant au solde d'un utilisateur et met à jour son nom
 *
 * @param {string} userId - L'ID Discord de l'utilisateur
 * @param {number} amount - Le montant à ajouter
 * @param {import('pg').Pool} pool - Le pool de connexion PostgreSQL
 * @param {string|null} username - Le pseudo Discord (optionnel)
 * @returns {Promise<void>}
 */
export async function addBalance(userId, amount, pool, username = null) {
  try {
    if (username) {
      await pool.query(
        `INSERT INTO balances (user_id, balance, username)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id)
         DO UPDATE SET
           balance = balances.balance + EXCLUDED.balance,
           username = EXCLUDED.username`,
        [userId, amount, username],
      );
    } else {
      await pool.query(
        `INSERT INTO balances (user_id, balance)
         VALUES ($1, $2)
         ON CONFLICT (user_id)
         DO UPDATE SET balance = balances.balance + EXCLUDED.balance`,
        [userId, amount],
      );
    }
  } catch (error) {
    console.error('❌ Erreur SQL lors de l’ajout de solde :', error);
    throw new Error('Impossible de modifier le solde.');
  }
}

/**
 * Retire un montant au solde d'un utilisateur
 *
 * @param {string} userId - L'ID Discord de l'utilisateur
 * @param {number} amount - Le montant à retirer
 * @param {import('pg').Pool} pool - Le pool de connexion PostgreSQL
 * @returns {Promise<void>}
 */
export async function removeBalance(userId, amount, pool) {
  try {
    await pool.query(
      `INSERT INTO balances (user_id, balance)
       VALUES ($1, 0)
       ON CONFLICT (user_id)
       DO UPDATE SET balance = GREATEST(0, balances.balance - $2)`,
      [userId, amount],
    );
  } catch (error) {
    console.error('❌ Erreur SQL lors du retrait de solde :', error);
    throw new Error('Impossible de modifier le solde.');
  }
}

/**
 * Incrémente le compteur de parties jouées (+1)
 *
 * @param {string} userId - L'ID Discord de l'utilisateur
 * @param {import('pg').Pool} pool - Le pool de connexion PostgreSQL
 * @param {string|null} username - Le pseudo Discord (optionnel)
 * @returns {Promise<void>}
 */
export async function incrementGamesPlayed(userId, pool, username = null) {
  try {
    if (username) {
      await pool.query(
        `INSERT INTO balances (user_id, balance, games_played, username)
         VALUES ($1, 0, 1, $2)
         ON CONFLICT (user_id)
         DO UPDATE SET
           games_played = COALESCE(balances.games_played, 0) + 1,
           username = EXCLUDED.username`,
        [userId, username],
      );
    } else {
      await pool.query(
        `INSERT INTO balances (user_id, balance, games_played)
         VALUES ($1, 0, 1)
         ON CONFLICT (user_id)
         DO UPDATE SET games_played = COALESCE(balances.games_played, 0) + 1`,
        [userId],
      );
    }
  } catch (error) {
    console.error(
      '❌ Erreur SQL lors de l’incrémentation des parties :',
      error,
    );
    throw new Error('Impossible d’incrémenter le nombre de parties.');
  }
}

/**
 * Incrémente le nombre de victoires d'un joueur
 *
 * @param {string} userId - L'ID Discord de l'utilisateur
 * @param {import('pg').Pool} pool - Le pool de connexion PostgreSQL
 * @returns {Promise<void>}
 */
export async function incrementGamesWin(userId, pool) {
  try {
    await pool.query(
      `INSERT INTO balances (user_id, balance, games_win)
       VALUES ($1, 0, 1)
       ON CONFLICT (user_id)
       DO UPDATE SET games_win = COALESCE(balances.games_win, 0) + 1`,
      [userId],
    );
  } catch (error) {
    console.error(
      '❌ Erreur SQL lors de l’incrémentation des victoires :',
      error,
    );
    throw new Error('Impossible d’incrémenter les victoires.');
  }
}

/**
 * Incrémente le nombre de défaites d'un joueur
 *
 * @param {string} userId - L'ID Discord de l'utilisateur
 * @param {import('pg').Pool} pool - Le pool de connexion PostgreSQL
 * @returns {Promise<void>}
 */
export async function incrementGamesLoose(userId, pool) {
  try {
    await pool.query(
      `INSERT INTO balances (user_id, balance, games_loose)
       VALUES ($1, 0, 1)
       ON CONFLICT (user_id)
       DO UPDATE SET games_loose = COALESCE(balances.games_loose, 0) + 1`,
      [userId],
    );
  } catch (error) {
    console.error(
      '❌ Erreur SQL lors de l’incrémentation des défaites :',
      error,
    );
    throw new Error('Impossible d’incrémenter les défaites.');
  }
}

/**
 * Incrémente le nombre d'égalités d'un joueur
 *
 * @param {string} userId - L'ID Discord de l'utilisateur
 * @param {import('pg').Pool} pool - Le pool de connexion PostgreSQL
 * @returns {Promise<void>}
 */
export async function incrementGamesTied(userId, pool) {
  try {
    await pool.query(
      `INSERT INTO balances (user_id, balance, games_tied)
       VALUES ($1, 0, 1)
       ON CONFLICT (user_id)
       DO UPDATE SET games_tied = COALESCE(balances.games_tied, 0) + 1`,
      [userId],
    );
  } catch (error) {
    console.error(
      '❌ Erreur SQL lors de l’incrémentation des égalités :',
      error,
    );
    throw new Error('Impossible d’incrémenter les égalités.');
  }
}

/**
 * Récupère le classement complet
 *
 * @param {import('pg').Pool} pool - Le pool de connexion PostgreSQL
 * @returns {Promise<Array<{user_id: string, balance: number, username: string, games_played: number, games_win: number, games_loose: number, games_tied: number}>>}
 */
export async function getRanking(pool) {
  try {
    const res = await pool.query(
      'SELECT user_id, username, balance, games_played, games_win, games_loose, games_tied FROM balances ORDER BY balance DESC',
    );
    return res.rows;
  } catch (error) {
    console.error(
      '❌ Erreur SQL lors de la récupération du classement :',
      error,
    );
    throw new Error('Impossible de récupérer le classement.');
  }
}

/**
 * Supprime le solde d'un utilisateur
 *
 * @param {string} userId - L'ID Discord de l'utilisateur
 * @param {import('pg').Pool} pool - Le pool de connexion PostgreSQL
 * @returns {Promise<void>}
 */
export async function deleteBalance(userId, pool) {
  try {
    await pool.query('DELETE FROM balances WHERE user_id = $1', [userId]);
  } catch (error) {
    console.error('❌ Erreur SQL lors de la suppression du solde :', error);
    throw new Error('Impossible de supprimer le solde.');
  }
}

/**
 * Récupère le solde et les statistiques d'un utilisateur
 *
 * @param {string} userId - L'ID Discord de l'utilisateur
 * @param {import('pg').Pool} pool - Le pool de connexion PostgreSQL
 * @returns {Promise<{balance: number, gamesPlayed: number, gamesWin: number, gamesLoose: number, gamesTied: number}>}
 */
export async function getUserStats(userId, pool) {
  try {
    const res = await pool.query(
      'SELECT balance, games_played, games_win, games_loose, games_tied FROM balances WHERE user_id = $1',
      [userId],
    );

    if (!res.rows.length) {
      return {
        balance: 0,
        gamesPlayed: 0,
        gamesWin: 0,
        gamesLoose: 0,
        gamesTied: 0,
      };
    }

    const row = res.rows[0];
    return {
      balance: Number(row.balance) || 0,
      gamesPlayed: Number(row.games_played) || 0,
      gamesWin: Number(row.games_win) || 0,
      gamesLoose: Number(row.games_loose) || 0,
      gamesTied: Number(row.games_tied) || 0,
    };
  } catch (error) {
    console.error('❌ Erreur SQL lors de la récupération des stats :', error);
    throw new Error('Impossible de récupérer les statistiques.');
  }
}

/**
 * Vérifie si le joueur a atteint son quota quotidien (12 parties) et incrémente son compteur si autorisé.
 *
 * @param {string} userId - L'ID Discord du joueur
 * @param {import('pg').Pool} pool - Le pool de connexion PostgreSQL
 * @param {string|null} username - Le pseudo Discord
 * @returns {Promise<{ allowed: boolean, playedToday: number }>}
 */
export async function canPlayAndIncrement(userId, pool, username = null) {
  try {
    const res = await pool.query(
      `INSERT INTO balances (user_id, username, played_at, played_today)
       VALUES ($1, $2, CURRENT_DATE, 1)
       ON CONFLICT (user_id) DO UPDATE
       SET
         played_today = CASE
           WHEN balances.played_at < CURRENT_DATE THEN 1
           ELSE balances.played_today + 1
         END,
         played_at = CURRENT_DATE,
         username = COALESCE(EXCLUDED.username, balances.username)
       RETURNING played_today`,
      [userId, username],
    );

    const currentPlayed = res.rows[0].played_today;

    if (currentPlayed > 12) {
      // Si la limite était déjà atteinte, on annule l'incrément abusif
      await pool.query(
        'UPDATE balances SET played_today = 12 WHERE user_id = $1',
        [userId],
      );
      return { allowed: false, playedToday: 12 };
    }

    return { allowed: true, playedToday: currentPlayed };
  } catch (error) {
    console.error(
      '❌ Erreur lors de la vérification du quota journalier :',
      error,
    );
    throw new Error('Impossible de vérifier le quota de parties.');
  }
}
